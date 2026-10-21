"""SDK product authorization. Online grants are deliberately short lived.

The offline signature authenticates the original base64 payload text, matching
the existing key manager. No legacy AES decryption key belongs in the SDK.
"""

import base64
import binascii
from datetime import datetime
import ipaddress
import json
import math
import re
from threading import RLock, Timer
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import weakref

from .errors import ShroomDependencyError, ShroomLicenseError, invalid_config

PRODUCT_TYPE = "shroom-sdk"
DEFAULT_SERVER_URL = "https://shroom.jq-industries.com"
DEFAULT_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0xly+Gg/8LvoWV0VRO/k
l1dEQRt7N6yilC2yiza+W1V2aXWKoiLlkPcJa9KQmNArjcHq8nBLlEppHjwEm2u5
SrgADP/frf1n8GZpRejZo6Ab1psppUm/neVcoxsK+0z6a00B9syv8AEIt2jrN4ZZ
zz51MgJqzgXmqPaibtzGl8RFr1jYJ2JpXNes6BqFpjQng1S8hu4VgWBIljkE3jKF
fHwTP9KPtEcoH/uSPmW5X7IuwpDW2QO6sO61uv/luLI4Wx4upX4CIUepwIzDyG6B
fYx2AAZJ1oNEBW28wIUf7i5sVT0FsWRsR55Q3KUcsiqAUVduKiKTQN3dnmbyC1Fg
AQIDAQAB
-----END PUBLIC KEY-----"""
_MAX_LEASE_SECONDS = 60.0
_RECHECK_SECONDS = 30.0
_DEVICE_ID = re.compile(r"[a-f0-9]{64}\Z")
_FEATURES = frozenset(("serial", "stream", "recording", "serial.raw"))
_DENIED = frozenset(("EXPIRED", "REVOKED", "SUSPENDED", "TAMPERED", "INVALID",
                     "PRODUCT_MISMATCH", "LICENSE_INACTIVE", "DEVICE_LIMIT_REACHED",
                     "DEVICE_REVOKED", "DEVICE_ID_REQUIRED", "LICENSE_NOT_REGISTERED"))


def _failure(code: str, message: str, *, status: str | None = None) -> ShroomLicenseError:
    return ShroomLicenseError(message, code=code, stage="license",
                              suggestion="请在同一授权后台签发或续期 shroom-sdk 产品密钥，核对有效期、功能权限和电脑名额后重新激活。",
                              details={"status": status} if status else {})


def _milliseconds(value, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (float, int)):
        raise _failure("LICENSE_INVALID", f"License {name} must be a timestamp")
    try:
        valid = math.isfinite(value) and value > 0
    except OverflowError:
        valid = False
    if not valid:
        raise _failure("LICENSE_INVALID", f"License {name} must be a finite positive timestamp")
    return float(value)


def _features(value) -> tuple[str, ...]:
    if not isinstance(value, list) or any(not isinstance(item, str) or item not in _FEATURES for item in value):
        raise _failure("LICENSE_INVALID", "SDK license features are missing or invalid")
    # Every verified SDK key covers custom serial protocols, including older
    # signed keys that predate this policy. Other features remain explicit.
    return tuple(dict.fromkeys([*value, "serial.raw"]))


def _server_url(value: str) -> str:
    if not isinstance(value, str):
        raise invalid_config("server_url must be an HTTPS URL", option="server_url")
    try:
        parsed = urlsplit(value)
        host = parsed.hostname
        port = parsed.port
        loopback = host == "localhost"
        if host and not loopback:
            try:
                loopback = ipaddress.ip_address(host).is_loopback
            except ValueError:
                pass
        if not host or parsed.username or parsed.password or parsed.query or parsed.fragment or (
                parsed.scheme != "https" and not (parsed.scheme == "http" and loopback)):
            raise ValueError("invalid server URL")
        if port is not None and not 0 < port < 65536:
            raise ValueError("invalid port")
    except ValueError as exc:
        raise invalid_config("server_url requires HTTPS (HTTP is allowed only on loopback)",
                             option="server_url", cause=exc) from exc
    return value.rstrip("/")


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # A redirect must never forward a software key to a different service.
        return None


def _post(url: str, body: dict) -> dict:
    request = Request(url, data=json.dumps(body).encode("utf-8"), method="POST",
                      headers={"Content-Type": "application/json", "Accept": "application/json"})
    try:
        with build_opener(_NoRedirect()).open(request, timeout=5.0) as response:
            data = response.read(1_048_577)
        if len(data) > 1_048_576:
            raise ValueError("response too large")
        result = json.loads(data)
        if not isinstance(result, dict):
            raise ValueError("response must be an object")
        return result
    except HTTPError as exc:
        exc.close()
        raise _failure("LICENSE_UNAVAILABLE", "SDK license service is unavailable") from exc
    except (URLError, TimeoutError, OSError) as exc:
        # Do not retain the request object or include the key in diagnostics.
        raise _failure("LICENSE_UNAVAILABLE", "SDK license service is unavailable") from exc
    except (ValueError, UnicodeError) as exc:
        raise _failure("LICENSE_INVALID", "SDK license service returned an invalid response") from exc


def _offline_payload(key: str, public_key: str) -> dict:
    try:
        from cryptography.exceptions import InvalidSignature
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding, rsa
    except ImportError as exc:
        raise ShroomDependencyError("Offline activation requires python -m pip install cryptography",
                                     code="DEPENDENCY_MISSING", stage="license",
                                     suggestion="请安装 Python SDK 的 [license] 可选依赖或 cryptography。",
                                     cause=exc) from exc
    try:
        envelope = json.loads(base64.b64decode(key, validate=True))
        payload_text, signature = envelope["payload"], envelope["signature"]
        if not isinstance(payload_text, str) or not isinstance(signature, str):
            raise ValueError("invalid envelope")
        verifier = serialization.load_pem_public_key(public_key.encode("ascii"))
        if not isinstance(verifier, rsa.RSAPublicKey):
            raise ValueError("RSA public key required")
        verifier.verify(base64.b64decode(signature, validate=True), payload_text.encode("utf-8"),
                        padding.PKCS1v15(), hashes.SHA256())
        payload = json.loads(base64.b64decode(payload_text, validate=True))
        if not isinstance(payload, dict):
            raise ValueError("invalid payload")
        return payload
    except (ValueError, TypeError, KeyError, AttributeError, UnicodeError, binascii.Error,
            InvalidSignature) as exc:
        raise _failure("LICENSE_INVALID", "Offline SDK license signature or payload is invalid") from exc


def _offline_grant(payload: dict) -> dict:
    if payload.get("productType") != PRODUCT_TYPE:
        raise _failure("LICENSE_PRODUCT_MISMATCH", "This license does not authorize the shroom-sdk product")
    expiry = payload.get("expireDate")
    if isinstance(expiry, str):
        try:
            date = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
            if date.tzinfo is None:
                raise ValueError("timezone required")
            expiry = date.timestamp() * 1000
        except (ValueError, OverflowError) as exc:
            raise _failure("LICENSE_INVALID", "Offline license expiry is invalid") from exc
    expiry = _milliseconds(expiry, "expireDate")
    limit = payload.get("deviceLimit", 0)
    if isinstance(limit, bool) or not isinstance(limit, int) or not 0 <= limit <= 10000:
        raise _failure("LICENSE_INVALID", "Offline license device limit is invalid")
    seconds = expiry / 1000 - time.time()
    if seconds <= 0:
        raise _failure("LICENSE_EXPIRED", "SDK license has expired")
    features = _features(payload.get("sdkFeatures"))
    return {"scope": ("all",), "features": features, "expiry": expiry, "limit": limit,
            "deadline": time.monotonic() + seconds, "status": "VALID"}


def _online_grant(response: dict, elapsed: float = 0) -> dict:
    if response.get("productType") != PRODUCT_TYPE:
        raise _failure("LICENSE_PRODUCT_MISMATCH", "License service did not authorize the shroom-sdk product")
    status = response.get("status")
    if response.get("valid") is not True or not isinstance(status, str) or status in _DENIED:
        code = "LICENSE_DEVICE_REQUIRED" if status == "DEVICE_ID_REQUIRED" else (
            "LICENSE_EXPIRED" if status == "EXPIRED" else "LICENSE_REJECTED")
        raise _failure(code, "SDK license is inactive or access was denied", status=status if isinstance(status, str) else None)
    now = _milliseconds(response.get("time"), "time")
    expiry = _milliseconds(response.get("expireTimestamp"), "expireTimestamp")
    lease = _milliseconds(response.get("leaseExpiresAt"), "leaseExpiresAt")
    seconds = min(_MAX_LEASE_SECONDS, (lease - now) / 1000, (expiry - now) / 1000) - elapsed
    if seconds <= 0:
        raise _failure("LICENSE_EXPIRED", "SDK license or its online lease has expired")
    features = _features(response.get("sdkFeatures"))
    return {"scope": ("all",), "features": features, "expiry": expiry,
            "deadline": time.monotonic() + seconds, "status": status, "lease_expiry": min(lease, now + 60000)}


def _constrain_grant(grant: dict, signed: dict | None) -> dict:
    if signed is None:
        return grant
    # A device-registration reply must never renew the RSA-signed key itself.
    grant["expiry"] = min(grant["expiry"], signed["expiry"])
    grant["deadline"] = min(grant["deadline"], signed["deadline"])
    grant["lease_expiry"] = min(grant["lease_expiry"], signed["expiry"])
    grant["features"] = tuple(item for item in grant["features"] if item in signed["features"])
    if grant["deadline"] <= time.monotonic():
        raise _failure("LICENSE_EXPIRED", "The signed SDK license expired during device verification")
    return grant


def _fetch_grant(online: dict, body: dict) -> dict:
    started = time.monotonic()
    response = _post(online["url"], body)
    return _constrain_grant(_online_grant(response, max(0, time.monotonic() - started)), online["signed"])


class _LicenseManager:
    def __init__(self):
        self._lock = RLock()
        self._generation = 0
        self._grant = self._online = self._timer = None
        self._error = None
        self._listeners: dict[int, weakref.WeakMethod] = {}
        self._listener_id = 0

    def _notify(self):
        with self._lock:
            listeners = tuple(self._listeners.items())
        for identifier, reference in listeners:
            callback = reference()
            if callback is None:
                with self._lock:
                    self._listeners.pop(identifier, None)
            else:
                try:
                    callback()
                except Exception:
                    # Device cleanup must not prevent other devices from closing.
                    pass

    def subscribe(self, callback):
        with self._lock:
            self._listener_id += 1
            identifier = self._listener_id
            self._listeners[identifier] = weakref.WeakMethod(callback)

        def unsubscribe():
            with self._lock:
                self._listeners.pop(identifier, None)
        return unsubscribe

    def _schedule_locked(self):
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None
        if not self._grant:
            return
        next_at = self._grant["deadline"]
        if self._online:
            next_at = min(next_at, self._online["next_check"])
        self._timer = Timer(max(0.01, next_at - time.monotonic()), self._tick)
        self._timer.daemon = True
        self._timer.start()

    def clear(self, error=None):
        with self._lock:
            self._generation += 1
            self._grant = self._online = None
            self._error = error
            self._schedule_locked()
        self._notify()

    def activate(self, key, *, mode, server_url, device_id, public_key):
        # A failed replacement must not keep an old, broader grant active.
        self.clear()
        with self._lock:
            generation = self._generation
        try:
            if not isinstance(key, str) or not key.strip() or len(key) > 8192:
                raise invalid_config("key must be a non-empty license string of at most 8192 characters", option="key")
            if mode not in ("online", "offline"):
                raise invalid_config("mode must be 'online' or 'offline'", option="mode")
            if device_id is not None and (not isinstance(device_id, str) or not _DEVICE_ID.fullmatch(device_id)):
                raise invalid_config("device_id must be 64 lowercase hexadecimal characters", option="device_id")
            if not isinstance(public_key, str) or not public_key.strip():
                raise invalid_config("public_key must be trusted RSA public-key PEM text", option="public_key")
            key, url = key.strip(), _server_url(server_url)
            online = None
            signed = None
            if mode == "offline":
                grant = _offline_grant(_offline_payload(key, public_key))
                signed = dict(grant)
                if grant["limit"]:
                    if device_id is None:
                        raise _failure("LICENSE_DEVICE_REQUIRED", "A stable device_id is required for this limited license")
                    endpoint = "/api/license/devices/check"
                else:
                    endpoint = None
            else:
                endpoint = "/licenseCheck"
            if endpoint:
                online = {"key": key, "url": url + endpoint, "device_id": device_id,
                          "next_check": time.monotonic() + _RECHECK_SECONDS, "signed": signed}
                grant = _fetch_grant(online, self._request_body(online))
            grant["mode"] = mode
            with self._lock:
                if generation != self._generation:
                    raise _failure("LICENSE_REJECTED", "License activation was replaced or cleared")
                self._grant, self._online, self._error = grant, online, None
                self._schedule_locked()
            self._notify()
            return self.status()
        except Exception as exc:
            with self._lock:
                current = generation == self._generation
            if current:
                self.clear(exc if isinstance(exc, ShroomLicenseError) else None)
            raise

    @staticmethod
    def _request_body(online):
        body = {"key": online["key"], "productType": PRODUCT_TYPE, "clientTime": int(time.time() * 1000)}
        if online["device_id"] is not None:
            body["deviceId"] = online["device_id"]
        return body

    def _tick(self):
        try:
            self.assert_feature()
        except ShroomLicenseError:
            return
        with self._lock:
            if not self._online or time.monotonic() < self._online["next_check"]:
                self._schedule_locked()
                return
            generation, online = self._generation, dict(self._online)
            self._online["next_check"] = time.monotonic() + _RECHECK_SECONDS
            # The expiry timer remains active while the network request is pending.
            self._schedule_locked()
        try:
            grant = _fetch_grant(online, self._request_body(online))
        except ShroomLicenseError as exc:
            with self._lock:
                current = generation == self._generation and self._grant is not None
            if current and exc.code != "LICENSE_UNAVAILABLE":
                self.clear(exc)
            return
        with self._lock:
            if generation != self._generation or self._grant is None:
                return
            grant["mode"] = self._grant["mode"]
            self._grant = grant
            self._schedule_locked()
        self._notify()

    def assert_feature(self, feature=None):
        with self._lock:
            error = None
            expired = False
            if self._grant and time.monotonic() >= self._grant["deadline"]:
                self._generation += 1
                self._grant = self._online = None
                self._error = _failure("LICENSE_EXPIRED", "SDK license or its online verification lease has expired")
                self._schedule_locked()
                error = self._error
                expired = True
            elif not self._grant:
                error = self._error or _failure("LICENSE_REQUIRED", "Activate a shroom-sdk license before connecting real hardware")
            elif feature == "serial.raw" and "serial" not in self._grant["features"]:
                error = _failure("LICENSE_FEATURE_DENIED", "SDK license does not authorize serial")
            elif feature is not None and feature not in self._grant["features"]:
                error = _failure("LICENSE_FEATURE_DENIED", f"SDK license does not authorize {feature}")
        if error:
            if expired:
                self._notify()
            raise error

    def status(self):
        try:
            self.assert_feature()
        except ShroomLicenseError:
            pass
        with self._lock:
            grant = self._grant
            return {"valid": grant is not None, "product_type": PRODUCT_TYPE,
                    "mode": grant["mode"] if grant else None,
                    "status": grant["status"] if grant else "INACTIVE",
                    "expires_at": grant["expiry"] if grant else None,
                    "lease_expires_at": grant.get("lease_expiry") if grant else None,
                    "sensor_types": list(grant["scope"]) if grant else [],
                    "all_products": grant is not None,
                    "sdk_features": list(grant["features"]) if grant else [],
                    "error": self._error.code if self._error else None}


_manager = _LicenseManager()


def activate_license(key: str, *, mode: str = "online", server_url: str = DEFAULT_SERVER_URL,
                     device_id: str | None = None, public_key: str = DEFAULT_PUBLIC_KEY) -> dict:
    """Activate a product-specific key; callers must explicitly persist limited-key device IDs.

    ``public_key`` is trusted application configuration, never a field read from a
    license. Limited offline keys also require online device checks every 30 s.
    """
    return _manager.activate(key, mode=mode, server_url=server_url,
                             device_id=device_id, public_key=public_key)


def get_license_status() -> dict:
    """Return an independent status snapshot without the software key."""
    return _manager.status()


def clear_license() -> None:
    """Forget the current grant and close real serial devices using it."""
    _manager.clear()


def _assert_license(feature="serial.raw"):
    _manager.assert_feature(feature)


def _subscribe_license(callback):
    return _manager.subscribe(callback)
