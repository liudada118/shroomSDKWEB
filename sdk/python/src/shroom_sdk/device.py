"""Synchronous devices: one reader, explicit lifetime and bounded serial reads."""

from collections import deque
from dataclasses import dataclass
from math import cos, exp, sin
from random import Random
from threading import Event, RLock
from time import monotonic
from typing import Iterator

from .errors import (ShroomDependencyError, ShroomError, ShroomIOError,
                     ShroomParseError, ShroomPortAmbiguousError, ShroomStateError,
                     invalid_config, serial_error)
from .frame import Frame, _integer, _number, _validate_decode_options, decode_frame
from .framer import DEFAULT_DELIMITER, Framer
from .license import _assert_license, _subscribe_license

# Match the signed 32-bit millisecond timer range used by the JavaScript SDK.
MIN_MOCK_FPS = 1000 / 2_147_483_647
MAX_MOCK_FPS = 1000


def _timeout(value: float | None) -> float | None:
    if value is not None:
        _number(value, "timeout", 0, inclusive=False)
    return value


class Device:
    """Use with a context manager; read in one thread only. No background acquisition."""

    def __init__(self, info: dict):
        self.info = info
        self._closed = Event()
        self._state = "open"
        self._bytes_received = self._frame_count = self._parse_dropped = 0
        self._last_error: ShroomError | None = None

    @property
    def state(self) -> str:
        """Read-only lifecycle state: open, error or closed."""
        return self._state

    @property
    def closed(self) -> bool:
        return self._closed.is_set()

    def _record_error(self, error: ShroomError) -> None:
        self._last_error = error
        self._state = "error"

    def _ensure_open(self, stage: str = "read") -> None:
        if self.closed:
            error = ShroomStateError("Device is closed", code="DISCONNECTED", stage=stage,
                                     suggestion="设备已关闭；请创建一个新的连接后再操作。")
            # A rejected operation must not change a successfully closed lifecycle.
            if self.state != "error":
                self._last_error = error
            raise error

    @property
    def bytes_received(self) -> int:
        return self._bytes_received

    @property
    def frame_count(self) -> int:
        return self._frame_count

    @property
    def dropped_count(self) -> int:
        return self._parse_dropped

    @property
    def frame_length(self) -> int:
        return 0

    def get_diagnostics(self) -> dict:
        """Return an independent snapshot; timeouts do not become failures."""
        if self.state == "error":
            status = "error"
            hint = self._last_error.suggestion if self._last_error else "请检查设备和串口连接。"
        elif self.closed:
            status, hint = "closed", "设备已关闭。"
        elif self.frame_count:
            status = "streaming"
            hint = f"已累计收到完整帧 {self.frame_count} 帧；累计计数不表示设备仍在持续发送数据。"
            if self.dropped_count:
                hint += " 已丢弃异常帧，请检查波特率、帧长度和分隔符。"
        elif self.bytes_received:
            status, hint = "waiting-frame", "已收到字节但尚无完整帧，请检查波特率、分隔符和帧长度。"
            if self.dropped_count:
                hint += " 已丢弃异常帧。"
        else:
            status, hint = "waiting-data", "尚未收到字节，请检查端口、供电和设备是否开始发送数据。"
        return {"source": self.info["source"], "state": self.state,
                "bytes_received": self.bytes_received, "frame_count": self.frame_count,
                "dropped_count": self.dropped_count, "frame_length": self.frame_length,
                "last_error": self._last_error.to_dict() if self._last_error else None,
                "status": status, "hint": hint}

    def _decode(self, payload: bytes) -> Frame:
        try:
            frame = decode_frame(payload, **self._options)
        except Exception as exc:
            error = ShroomParseError(str(exc) or "Could not decode frame", code="PARSE_FAILED",
                                     stage="parse", suggestion="请检查数据帧、行列数、points 和线序配置。",
                                     details={"payload_length": len(payload)}, cause=exc)
            self._parse_dropped += 1
            self._record_error(error)
            raise error from exc
        self._state = "open"
        return frame

    def read_frame(self, timeout: float | None = 1.0) -> Frame | None:
        raise NotImplementedError

    def frames(self, timeout: float | None = 1.0) -> Iterator[Frame]:
        """Keep waiting through timeouts; close/break/KeyboardInterrupt ends iteration."""
        _timeout(timeout)
        while not self.closed:
            frame = self.read_frame(timeout)
            if frame is not None:
                yield frame

    def __iter__(self) -> Iterator[Frame]:
        return self.frames()

    def close(self) -> None:
        self._closed.set()
        if self.state != "error":
            self._state = "closed"

    def __enter__(self):
        self._ensure_open("connect")
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        try:
            self.close()
        except ShroomError:
            if exc_type is None:
                raise
            # close() records its failure; keep the original business exception primary.
        return False


@dataclass(frozen=True)
class PortInfo:
    path: str
    description: str | None
    manufacturer: str | None
    serial_number: str | None
    vendor_id: int | None
    product_id: int | None


def _serial_module(stage: str = "connect"):
    try:
        import serial
    except ImportError as exc:
        raise ShroomDependencyError("Serial support requires pySerial: python -m pip install pyserial",
                                     code="DEPENDENCY_MISSING", stage=stage,
                                     suggestion="请运行 python -m pip install pyserial 安装串口依赖。",
                                     cause=exc) from exc
    if not hasattr(serial, "serial_for_url"):
        raise ShroomDependencyError("Install 'pyserial', not the unrelated package named 'serial'",
                                     code="DEPENDENCY_MISSING", stage=stage,
                                     suggestion="请移除同名 serial 包，并安装 pyserial。")
    return serial


def list_ports() -> list[PortInfo]:
    _serial_module("query")
    try:
        from serial.tools.list_ports import comports
    except ImportError as exc:
        raise ShroomDependencyError("Serial port enumeration requires pySerial: python -m pip install pyserial",
                                     code="DEPENDENCY_MISSING", stage="query",
                                     suggestion="请安装 pyserial，并检查是否存在同名 serial 包冲突。",
                                     cause=exc) from exc
    try:
        return [PortInfo(p.device, p.description, p.manufacturer, p.serial_number, p.vid, p.pid)
                for p in sorted(comports(), key=lambda port: port.device)]
    except Exception as exc:
        raise serial_error(exc, "query") from exc


class SerialDevice(Device):
    def __init__(self, path: str | None = None, *, baud_rate: int = 1_000_000,
                 delimiter: bytes = DEFAULT_DELIMITER, min_length: int = 8,
                 max_length: int = 8192, lock_length: bool = True, **decode_options):
        # Validate before opening a port, so invalid options cannot leak a serial handle.
        _integer(baud_rate, "baud_rate", 1)
        if path is not None and (not isinstance(path, str) or not path.strip()):
            raise invalid_config("path must be a non-empty string or None", option="path")
        options = _validate_decode_options(decode_options)
        self._framer = Framer(delimiter=delimiter, min_length=min_length,
                              max_length=max_length, lock_length=lock_length)
        _assert_license()
        serial = _serial_module()
        if path is None:
            ports = list_ports()
            if not ports:
                raise ShroomIOError("No serial ports found; connect the device and check drivers/permissions",
                                     code="PORT_NOT_FOUND", stage="query",
                                     suggestion="请连接设备、检查驱动，并用 list_ports() 确认端口。")
            if len(ports) != 1:
                raise ShroomPortAmbiguousError("Multiple serial ports found; pass path explicitly: "
                                                + ", ".join(p.path for p in ports),
                                                code="PORT_AMBIGUOUS", stage="query",
                                                suggestion="请用 list_ports() 查询后显式传入目标 path。",
                                                details={"ports": [p.path for p in ports]})
            path = ports[0].path
        super().__init__({"source": "python-serial", "path": path, "baud_rate": baud_rate,
                          "rows": decode_options.get("rows"), "cols": decode_options.get("cols")})
        self._options = options
        self._pending: deque[bytes] = deque()
        self._serial_close_lock = RLock()
        # serial_for_url accepts normal OS port names and loop:// for hardware-free tests.
        try:
            self._port = serial.serial_for_url(path, baudrate=baud_rate, timeout=0.1, write_timeout=1.0)
        except Exception as exc:
            raise serial_error(exc, "connect", path=path) from exc
        self._license_unsubscribe = _subscribe_license(self._license_changed)
        self._check_license()

    def _license_changed(self) -> None:
        if not self.closed:
            try:
                self._check_license()
            except ShroomError:
                pass

    def _ensure_open(self, stage: str = "read") -> None:
        if self.closed and self._last_error and self._last_error.stage == "license":
            raise self._last_error
        super()._ensure_open(stage)

    def _check_license(self) -> None:
        try:
            _assert_license()
        except ShroomError as error:
            self._record_error(error)
            try:
                self.close()
            except ShroomError:
                # Keep the authorization failure primary if driver cleanup also fails.
                self._record_error(error)
            raise

    @property
    def dropped_count(self) -> int:
        return self._framer.dropped_count + self._parse_dropped

    @property
    def frame_length(self) -> int:
        return self._framer.frame_length

    def read_frame(self, timeout: float | None = 1.0) -> Frame | None:
        self._ensure_open()
        _timeout(timeout)
        self._check_license()
        deadline = monotonic() + timeout if timeout is not None else None
        while not self.closed:
            self._check_license()
            if self._pending:
                return self._decode(self._pending.popleft())
            remaining = deadline - monotonic() if deadline is not None else 0.1
            if remaining <= 0:
                return None
            try:
                if getattr(self._port, "is_open", True) is False:
                    raise OSError("Serial device is disconnected")
                self._port.timeout = min(0.1, remaining)
                # Read buffered bytes immediately; otherwise block for only one byte.
                chunk = self._port.read(min(4096, max(1, self._port.in_waiting)))
            except Exception as exc:
                self._check_license()
                error = serial_error(exc, "read", path=self.info["path"])
                self._record_error(error)
                raise error from exc
            self._check_license()
            try:
                payloads = self._framer.push(chunk)
            except Exception as exc:
                error = ShroomParseError(str(exc) or "Could not frame serial data", code="PARSE_FAILED",
                                         stage="parse", suggestion="请检查串口读取的数据类型和分帧配置。",
                                         cause=exc)
                self._parse_dropped += 1
                self._record_error(error)
                raise error from exc
            self._bytes_received += len(chunk)
            self._frame_count += len(payloads)
            self._pending.extend(payloads)
        self._check_license()
        return None

    def write(self, data: bytes) -> int:
        """Send a caller-supplied device command. No start/calibration command is invented."""
        self._ensure_open("write")
        if not isinstance(data, (bytes, bytearray, memoryview)):
            raise invalid_config("data must be bytes, bytearray or memoryview", option="data")
        self._check_license()
        try:
            if getattr(self._port, "is_open", True) is False:
                raise OSError("Serial device is disconnected")
            written = self._port.write(data)
        except Exception as exc:
            self._check_license()
            error = serial_error(exc, "write", path=self.info["path"])
            self._record_error(error)
            raise error from exc
        self._check_license()
        self._state = "open"
        return written

    def close(self) -> None:
        # A license timer may close an idle port concurrently with caller cleanup.
        with self._serial_close_lock:
            if not self.closed:
                unsubscribe = getattr(self, "_license_unsubscribe", None)
                if unsubscribe is not None:
                    unsubscribe()
                super().close()
                self._pending.clear()
                try:
                    self._port.close()
                except Exception as exc:
                    error = serial_error(exc, "close", path=self.info["path"])
                    self._record_error(error)
                    raise error from exc


class MockDevice(Device):
    def __init__(self, *, rows: int = 32, cols: int = 32, fps: float = 30,
                 seed: int | None = None, **decode_options):
        _integer(rows, "rows", 1)
        _integer(cols, "cols", 1)
        _number(fps, "fps", MIN_MOCK_FPS)
        if fps > MAX_MOCK_FPS:
            raise invalid_config(f"fps must be <= {MAX_MOCK_FPS}", option="fps")
        self._options = _validate_decode_options({**decode_options, "rows": rows, "cols": cols})
        super().__init__({"source": "mock", "rows": rows, "cols": cols, "fps": fps})
        try:
            self._random = Random(seed)
        except (TypeError, ValueError) as exc:
            raise invalid_config(str(exc), option="seed", cause=exc) from exc
        self._phase = 0.0
        self._next_frame = monotonic()

    def read_frame(self, timeout: float | None = 1.0) -> Frame | None:
        self._ensure_open()
        _timeout(timeout)
        delay = max(0.0, self._next_frame - monotonic())
        if timeout is not None and delay > timeout:
            self._closed.wait(timeout)
            return None
        if self._closed.wait(delay):
            return None
        rows, cols = self.info["rows"], self.info["cols"]
        self._phase += 0.08
        phase = self._phase
        blobs = ((0.5 + 0.28 * cos(phase), 0.5 + 0.28 * sin(phase), 0.18, 235),
                 (0.5 + 0.22 * cos(-phase * 1.7), 0.5 + 0.22 * sin(-phase * 1.7), 0.12, 180))
        raw = bytearray()
        for y in range(rows):
            for x in range(cols):
                nx, ny = (x / (cols - 1) if cols > 1 else 0.5), (y / (rows - 1) if rows > 1 else 0.5)
                v = sum(peak * exp(-((nx - bx) ** 2 + (ny - by) ** 2) / (2 * radius ** 2))
                        for bx, by, radius, peak in blobs)
                raw.append(min(255, int(v + 3 * self._random.random())))
        self._next_frame = monotonic() + 1.0 / self.info["fps"]
        self._bytes_received += len(raw)
        self._frame_count += 1
        return self._decode(raw)

    @property
    def frame_length(self) -> int:
        return self.info["rows"] * self.info["cols"] if self.frame_count else 0


def connect(path: str | None = None, **options) -> SerialDevice:
    return SerialDevice(path, **options)


def mock(**options) -> MockDevice:
    return MockDevice(**options)
