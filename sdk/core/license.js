/** SDK licenses share the key server with the desktop product, with a separate product boundary. */
import { ShroomError } from './errors.js';

export const SDK_PRODUCT_TYPE = 'shroom-sdk';
export const DEFAULT_LICENSE_SERVER = 'https://shroom.jq-industries.com';
export const DEFAULT_LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0xly+Gg/8LvoWV0VRO/k
l1dEQRt7N6yilC2yiza+W1V2aXWKoiLlkPcJa9KQmNArjcHq8nBLlEppHjwEm2u5
SrgADP/frf1n8GZpRejZo6Ab1psppUm/neVcoxsK+0z6a00B9syv8AEIt2jrN4ZZ
zz51MgJqzgXmqPaibtzGl8RFr1jYJ2JpXNes6BqFpjQng1S8hu4VgWBIljkE3jKF
fHwTP9KPtEcoH/uSPmW5X7IuwpDW2QO6sO61uv/luLI4Wx4upX4CIUepwIzDyG6B
fYx2AAZJ1oNEBW28wIUf7i5sVT0FsWRsR55Q3KUcsiqAUVduKiKTQN3dnmbyC1Fg
AQIDAQAB
-----END PUBLIC KEY-----`;

const sdkLicenseWatchers = new Set();
const sdkLicensedDevices = new WeakMap();
let sdkLicenseSession = null;
let sdkLicenseRevision = 0;
let sdkLicenseWatchTimer = null;
let sdkLicenseLastError = null;
const sdkLicenseMonotonic = () => globalThis.performance?.now() ?? Date.now();
const sdkLicenseFailure = (code, message) => new ShroomError(code, message, {
  stage: 'license', suggestion: '请在共用授权后台签发或续期 Shroom SDK 产品密钥，核对有效期、功能权限与电脑名额后重新激活。',
});

function sdkLicenseTime(session) {
  session.highWater = Math.max(session.highWater, Date.now(), session.localStart + Math.max(0, sdkLicenseMonotonic() - session.monotonicStart));
  return session.mode === 'offline-local' ? session.highWater
    : session.serverStart + Math.max(0, sdkLicenseMonotonic() - session.monotonicStart);
}

function sdkLicenseExpiry(value) {
  const expires = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(expires) || expires <= 0) throw sdkLicenseFailure('LICENSE_INVALID', '许可证没有有效的到期时间。');
  return expires;
}

function sdkLicenseFeatures(value) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw sdkLicenseFailure('LICENSE_INVALID', 'SDK 许可证缺少功能授权。');
  }
  // SDK licenses cover every device model, including custom serial protocols.
  // Older signed SDK keys need not be reissued merely to add serial.raw.
  return [...new Set([...value, 'serial.raw'])];
}

/** Return only public entitlement metadata; never the key or transport credentials. */
export function getLicenseStatus() {
  try { assertLicense(); } catch (error) {
    return { valid: false, productType: SDK_PRODUCT_TYPE, code: error.code, message: error.message };
  }
  const session = sdkLicenseSession;
  return {
    valid: true, productType: SDK_PRODUCT_TYPE, mode: session.mode,
    expiresAt: session.expiresAt, leaseExpiresAt: session.leaseExpiresAt,
    products: [...session.products], allProducts: session.all, features: [...session.features],
  };
}

/** Synchronous so Web Serial can retain the caller's click gesture. */
export function assertLicense(requirement = {}) {
  const session = sdkLicenseSession;
  if (!session) throw sdkLicenseLastError ?? sdkLicenseFailure('LICENSE_REQUIRED', '连接真实设备前请先激活 SDK 产品密钥。');
  const now = sdkLicenseTime(session);
  if (now >= session.expiresAt) throw sdkLicenseFailure('LICENSE_EXPIRED', 'SDK 许可证已到期，采集已停止。');
  if (now >= session.leaseExpiresAt) throw sdkLicenseFailure('LICENSE_UNAVAILABLE', '无法续验在线授权，当前授权时限已结束。');
  if (requirement.feature === 'serial.raw' && !session.features.includes('serial')) {
    throw sdkLicenseFailure('LICENSE_FEATURE_DENIED', 'SDK 许可证未包含功能 serial。');
  }
  if (requirement.feature && !session.features.includes(requirement.feature)) {
    throw sdkLicenseFailure('LICENSE_FEATURE_DENIED', `SDK 许可证未包含功能 ${requirement.feature}。`);
  }
}

function sdkLicenseNotify() {
  for (const watcher of [...sdkLicenseWatchers]) {
    if (!sdkLicenseWatchers.has(watcher)) continue;
    try { assertLicense(watcher.requirement); } catch (error) {
      sdkLicenseWatchers.delete(watcher);
      try { watcher.onInvalid(error); } catch { /* A customer callback cannot block other sessions closing. */ }
    }
  }
  if (!sdkLicenseWatchers.size && sdkLicenseWatchTimer) {
    clearInterval(sdkLicenseWatchTimer);
    sdkLicenseWatchTimer = null;
  }
}

/** Notify once on expiry, revocation, clear or an entitlement change. */
export function watchLicense(requirement, onInvalid) {
  const watcher = { requirement: { ...requirement }, onInvalid };
  sdkLicenseWatchers.add(watcher);
  if (!sdkLicenseWatchTimer) {
    sdkLicenseWatchTimer = setInterval(sdkLicenseNotify, 250);
    sdkLicenseWatchTimer.unref?.();
  }
  sdkLicenseNotify();
  return () => {
    sdkLicenseWatchers.delete(watcher);
    sdkLicenseNotify();
  };
}

/** Internal identity metadata cannot be changed by rewriting a device's public info. */
export function markLicensedDevice(device, requirement) {
  sdkLicensedDevices.set(device, Object.freeze({ ...requirement }));
  return device;
}

export function getDeviceLicenseRequirement(device) {
  const requirement = sdkLicensedDevices.get(device);
  return requirement ? { ...requirement } : null;
}

/** Clear runtime credentials and stop sources using them. Keys are never persisted by the SDK. */
export function clearLicense() {
  sdkLicenseRevision += 1;
  if (sdkLicenseSession?.refreshTimer) clearTimeout(sdkLicenseSession.refreshTimer);
  sdkLicenseSession = null;
  sdkLicenseLastError = null;
  sdkLicenseNotify();
}

function sdkLicenseServer(value) {
  let url;
  try { url = new URL(value ?? DEFAULT_LICENSE_SERVER); } catch { throw sdkLicenseFailure('INVALID_CONFIG', '授权服务地址无效。'); }
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:'
    && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw sdkLicenseFailure('INVALID_CONFIG', '授权服务必须使用 HTTPS，本机调试可以使用 localhost HTTP。');
  }
  return url.href.replace(/\/$/, '');
}

function sdkLicenseDecodeBase64(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw sdkLicenseFailure('LICENSE_INVALID', '许可证的 Base64 格式无效。');
  }
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function sdkLicenseVerifyOffline(key, publicKey) {
  try {
    const envelope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(sdkLicenseDecodeBase64(key)));
    if (typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string') throw new Error('envelope');
    const pem = publicKey ?? DEFAULT_LICENSE_PUBLIC_KEY;
    if (typeof pem !== 'string') throw new Error('publicKey');
    const der = sdkLicenseDecodeBase64(pem.replace(/-----[A-Z ]+-----|\s/g, ''));
    const subtle = globalThis.crypto?.subtle ?? (await import('node:crypto')).webcrypto.subtle;
    const trustedKey = await subtle.importKey('spki', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await subtle.verify('RSASSA-PKCS1-v1_5', trustedKey, sdkLicenseDecodeBase64(envelope.signature), new TextEncoder().encode(envelope.payload))) {
      throw new Error('signature');
    }
    const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(sdkLicenseDecodeBase64(envelope.payload)));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('payload');
    return payload;
  } catch {
    throw sdkLicenseFailure('LICENSE_INVALID', '离线许可证格式或 RSA 签名无效。');
  }
}

function sdkLicenseProduct(productType) {
  if (productType !== SDK_PRODUCT_TYPE) throw sdkLicenseFailure('LICENSE_PRODUCT_MISMATCH', '此密钥不属于 Shroom SDK；上位机密钥不能启用 SDK。');
}

async function sdkLicenseRequest(config) {
  const controller = new AbortController();
  const requestStart = sdkLicenseMonotonic();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${config.serverUrl}${config.path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', redirect: 'error', signal: controller.signal,
      body: JSON.stringify({ key: config.key, productType: SDK_PRODUCT_TYPE, clientTime: Date.now(),
        ...(config.deviceId ? { deviceId: config.deviceId } : {}) }),
    });
    if (!response.ok) throw sdkLicenseFailure('LICENSE_UNAVAILABLE', '授权服务暂时不可用，请检查网络或联系管理员。');
    const result = await response.json();
    if (result.valid !== true) {
      const code = result.status === 'PRODUCT_MISMATCH' || result.status === 'LICENSE_PRODUCT_MISMATCH' ? 'LICENSE_PRODUCT_MISMATCH'
        : result.status === 'EXPIRED' ? 'LICENSE_EXPIRED'
          : result.status === 'DEVICE_ID_REQUIRED' ? 'LICENSE_DEVICE_REQUIRED' : 'LICENSE_REJECTED';
      throw sdkLicenseFailure(code, `授权未通过（${String(result.status ?? 'INVALID').slice(0, 64)}）。请核对产品、有效期和电脑名额。`);
    }
    sdkLicenseProduct(result.productType);
    const serverTime = sdkLicenseExpiry(result.time);
    const expiresAt = sdkLicenseExpiry(result.expireTimestamp ?? config.offlinePayload?.expireDate);
    const leaseExpiresAt = Math.min(expiresAt, serverTime + 60000, result.leaseExpiresAt == null ? Infinity : sdkLicenseExpiry(result.leaseExpiresAt));
    const effectiveServerTime = serverTime + Math.max(0, sdkLicenseMonotonic() - requestStart);
    if (expiresAt <= effectiveServerTime || leaseExpiresAt <= effectiveServerTime) throw sdkLicenseFailure('LICENSE_EXPIRED', 'SDK 授权已过期。');
    const entitlement = { all: true, products: [], features: sdkLicenseFeatures(result.sdkFeatures),
      expiresAt, leaseExpiresAt, serverStart: effectiveServerTime };
    if (config.offlinePayload) {
      const signedExpiry = sdkLicenseExpiry(config.offlinePayload.expireDate);
      const signedFeatures = sdkLicenseFeatures(config.offlinePayload.sdkFeatures);
      entitlement.expiresAt = Math.min(signedExpiry, entitlement.expiresAt);
      entitlement.leaseExpiresAt = Math.min(signedExpiry, entitlement.leaseExpiresAt);
      entitlement.features = entitlement.features.filter((feature) => signedFeatures.includes(feature));
    }
    return entitlement;
  } catch (error) {
    if (error instanceof ShroomError) throw error;
    throw sdkLicenseFailure('LICENSE_UNAVAILABLE', '授权服务连接失败，未获得新的授权时限。');
  } finally { clearTimeout(timer); }
}

function sdkLicenseScheduleRefresh(session, revision) {
  const remaining = session.leaseExpiresAt - sdkLicenseTime(session);
  session.refreshTimer = setTimeout(async () => {
    if (sdkLicenseRevision !== revision || sdkLicenseSession !== session) return;
    try {
      const next = await sdkLicenseRequest(session.config);
      if (sdkLicenseRevision !== revision || sdkLicenseSession !== session) return;
      Object.assign(session, next, { localStart: Date.now(), highWater: Date.now(), monotonicStart: sdkLicenseMonotonic() });
      sdkLicenseLastError = null;
      sdkLicenseNotify();
    } catch (error) {
      if (sdkLicenseRevision !== revision || sdkLicenseSession !== session) return;
      if (error.code !== 'LICENSE_UNAVAILABLE') {
        sdkLicenseSession = null;
        sdkLicenseLastError = error;
      }
      sdkLicenseNotify();
    }
    if (sdkLicenseSession === session && sdkLicenseRevision === revision && sdkLicenseTime(session) < session.leaseExpiresAt) {
      sdkLicenseScheduleRefresh(session, revision);
    }
  }, Math.max(50, Math.min(30000, remaining / 2)));
  session.refreshTimer.unref?.();
}

/** Activate before connecting. Offline mode denotes the RSA code format; limited codes still require online device checks. */
export async function activateLicense(key, options = {}) {
  if (typeof key !== 'string' || !key.trim() || key.length > 16384 || !options || typeof options !== 'object' || Array.isArray(options)) {
    throw sdkLicenseFailure('INVALID_CONFIG', '请提供有效的许可证和激活参数。');
  }
  const mode = options.mode ?? 'online';
  if (!['online', 'offline'].includes(mode)) throw sdkLicenseFailure('INVALID_CONFIG', '授权方式应为 online 或 offline。');
  if (options.deviceId !== undefined && (typeof options.deviceId !== 'string' || !/^[a-f0-9]{64}$/.test(options.deviceId))) {
    throw sdkLicenseFailure('INVALID_CONFIG', 'deviceId 必须是稳定的 64 位小写十六进制电脑标识。');
  }
  clearLicense();
  const revision = sdkLicenseRevision;
  try {
    let config = null;
    let entitlement;
    if (mode === 'offline') {
      const payload = await sdkLicenseVerifyOffline(key.trim(), options.publicKey);
      sdkLicenseProduct(payload.productType);
      const expiresAt = sdkLicenseExpiry(payload.expireDate);
      const features = sdkLicenseFeatures(payload.sdkFeatures);
      if (payload.deviceLimit != null && (!Number.isInteger(payload.deviceLimit) || payload.deviceLimit < 0)) throw sdkLicenseFailure('LICENSE_INVALID', '电脑数量限制无效。');
      if (payload.deviceLimit > 0) {
        if (!options.deviceId) throw sdkLicenseFailure('LICENSE_DEVICE_REQUIRED', '此离线码限定电脑数量，请提供稳定的 deviceId 并联网激活。');
        config = { key: key.trim(), deviceId: options.deviceId, serverUrl: sdkLicenseServer(options.serverUrl), path: '/api/license/devices/check', offlinePayload: payload };
        entitlement = await sdkLicenseRequest(config);
      } else entitlement = { all: true, products: [], features, expiresAt, leaseExpiresAt: expiresAt, serverStart: Date.now() };
    } else {
      config = { key: key.trim(), deviceId: options.deviceId, serverUrl: sdkLicenseServer(options.serverUrl), path: '/licenseCheck' };
      entitlement = await sdkLicenseRequest(config);
    }
    if (revision !== sdkLicenseRevision) throw sdkLicenseFailure('LICENSE_REJECTED', '此激活请求已被后续操作取消。');
    sdkLicenseSession = { ...entitlement, config, mode: config ? (mode === 'offline' ? 'offline-device' : 'online') : 'offline-local',
      localStart: Date.now(), highWater: Date.now(), monotonicStart: sdkLicenseMonotonic() };
    assertLicense();
    if (config) sdkLicenseScheduleRefresh(sdkLicenseSession, revision);
    return getLicenseStatus();
  } catch (error) {
    if (revision === sdkLicenseRevision) {
      sdkLicenseSession = null;
      sdkLicenseLastError = error;
      sdkLicenseNotify();
    }
    throw error;
  }
}
