import { createRequire } from 'node:module';
import { BackendSdkClient as SharedBackendSdkClient } from '../backend/client.js';

export { DEFAULT_HTTP_BASE_URL, DEFAULT_WS_URL, DEFAULT_ROUTES, normalizeHttpResult } from '../backend/client.js';

function nodeWebSocket() {
  if (typeof globalThis.WebSocket === 'function') return globalThis.WebSocket;
  try { return createRequire(import.meta.url)('ws'); }
  catch { return undefined; }
}

/** Node 18/20 uses optional ws; current Node can use its native WebSocket. */
export class BackendSdkClient extends SharedBackendSdkClient {
  constructor(options = {}) {
    super({ ...options, WebSocketImpl: options.WebSocketImpl ?? nodeWebSocket() });
  }
}
