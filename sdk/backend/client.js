/** HTTP/WebSocket client adapted from E:/ShroomSDK's BackendSdkClient.
 * No serial, database or Node-only imports. Backend frames remain unchanged.
 */
export const DEFAULT_HTTP_BASE_URL = 'http://127.0.0.1:19245';
export const DEFAULT_WS_URL = 'ws://127.0.0.1:19999';
export const DEFAULT_ROUTES = Object.freeze({
  channels: '/api/channels',
  wsStatus: '/api/ws/status',
  sdkContract: '/api/sdk/contract',
  displaySystems: '/api/display-systems',
  displaySystemById: '/api/display-systems/:id',
  serialPorts: '/api/serial/ports',
  serialStatus: '/api/serial/status',
  serialOpen: '/api/serial/open',
  serialClose: '/api/serial/close',
  sensorCurrent: '/api/sensor/current',
  sensorType: '/api/sensor/type',
  collectionStart: '/api/collection/start',
  collectionStop: '/api/collection/stop',
});

export function normalizeHttpResult(payload) {
  if (!payload || typeof payload !== 'object' || !Object.hasOwn(payload, 'code')) return payload;
  if (payload.code !== 0) throw new Error(payload.message || payload.error || `Backend error ${payload.code}`);
  return payload.data;
}

function backendUrl(value, protocols) {
  const url = new URL(value);
  if (!protocols.includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new TypeError(`Invalid backend URL: use ${protocols.join(' or ')} without credentials, query or fragment`);
  }
  return url.href.replace(/\/$/, '');
}

function backendTimeout(value) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError('timeoutMs must be a positive number');
  return value;
}

function backendChannels(value) {
  const channels = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(channels) || channels.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new TypeError('channels must be a string or an array of non-empty strings');
  }
  return [...new Set(channels)];
}

export class BackendSdkClient {
  constructor({
    httpBaseUrl = DEFAULT_HTTP_BASE_URL, wsUrl = DEFAULT_WS_URL,
    fetchImpl = globalThis.fetch, WebSocketImpl = globalThis.WebSocket,
    contract = null, routes = {}, headers = {}, timeoutMs = 10000,
  } = {}) {
    this.httpBaseUrl = backendUrl(httpBaseUrl, ['http:', 'https:']);
    this.wsUrl = backendUrl(wsUrl, ['ws:', 'wss:']);
    this.fetchImpl = fetchImpl;
    this.WebSocketImpl = WebSocketImpl;
    this.timeoutMs = backendTimeout(timeoutMs);
    this.headers = headers;
    this.contract = contract;
    this.routeOverrides = { ...routes };
    this.routes = { ...DEFAULT_ROUTES, ...contract?.http?.routes, ...this.routeOverrides };
    this.ws = null;
    this.listeners = new Map();
    this.pendingChannels = [];
    this.connectionTimer = null;
  }

  // A small browser-safe emitter. Unlike node:events, an unhandled 'error'
  // does not crash the process. Applications should still listen for errors.
  on(event, handler) {
    if (typeof handler !== 'function') throw new TypeError('event handler must be a function');
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return this;
  }

  off(event, handler) {
    for (const listener of this.listeners.get(event) || []) {
      if (listener === handler || listener.original === handler) this.listeners.get(event).delete(listener);
    }
    return this;
  }

  once(event, handler) {
    if (typeof handler !== 'function') throw new TypeError('event handler must be a function');
    const once = (...args) => { this.off(event, once); handler(...args); };
    once.original = handler;
    return this.on(event, once);
  }

  removeAllListeners(event) {
    if (event === undefined) this.listeners.clear();
    else this.listeners.delete(event);
    return this;
  }

  emit(event, ...args) {
    for (const handler of [...(this.listeners.get(event) || [])]) handler(...args);
  }

  route(name, params = {}) {
    const template = this.routes[name];
    if (typeof template !== 'string') throw new Error(`Unknown backend route: ${name}`);
    return template.replace(/:([A-Za-z_][\w]*)/g, (_, key) => {
      if (params[key] == null) throw new Error(`Missing route parameter: ${key}`);
      return encodeURIComponent(params[key]);
    });
  }

  async request(routeOrName, { method = 'GET', body, query = {}, raw = false,
    routeParams, headers, signal, timeoutMs = this.timeoutMs } = {}) {
    if (typeof this.fetchImpl !== 'function') throw new Error('fetch is unavailable; use Node.js 18+ or inject fetchImpl');
    const path = routeOrName.startsWith('/') ? routeOrName : this.route(routeOrName, routeParams);
    // Routes must stay on the configured backend, including contract-provided ones.
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
      throw new TypeError('Backend routes must be root-relative paths');
    }
    const url = new URL(`${this.httpBaseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) if (value != null) url.searchParams.set(key, String(value));
    backendTimeout(timeoutMs);
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error('Backend HTTP request timed out')), timeoutMs);
    try {
      const requestHeaders = new Headers(this.headers);
      new Headers(headers).forEach((value, key) => requestHeaders.set(key, value));
      if (body !== undefined) requestHeaders.set('content-type', 'application/json');
      const response = await this.fetchImpl(url.href, {
        method, headers: requestHeaders, signal: controller.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      let payload;
      try { payload = text ? JSON.parse(text) : null; }
      catch { throw new Error(response.ok ? 'Backend returned invalid JSON' : `HTTP ${response.status}: backend returned non-JSON data`); }
      if (!response.ok) throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
      const data = normalizeHttpResult(payload);
      return raw ? payload : data;
    } catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason;
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  async getContract({ refresh = false } = {}) {
    if (this.contract && !refresh) return this.contract;
    const contract = await this.request('sdkContract');
    if (!contract || typeof contract !== 'object' || Array.isArray(contract)) throw new Error('Invalid backend contract');
    this.contract = contract;
    this.routes = { ...DEFAULT_ROUTES, ...contract.http?.routes, ...this.routeOverrides };
    return contract;
  }

  getChannels() { return this.request('channels', { raw: true }); }
  getWsStatus() { return this.request('wsStatus', { raw: true }); }
  listDisplaySystems() { return this.request('displaySystems', { raw: true }); }
  getDisplaySystem(id) { return this.request('displaySystemById', { raw: true, routeParams: { id } }); }
  listSerialPorts() { return this.request('serialPorts'); }
  getSerialStatus(role) { return this.request('serialStatus', { query: { role } }); }
  getCurrentSensor() { return this.request('sensorCurrent'); }
  setSensorType(type) { return this.request('sensorType', { method: 'POST', body: { type } }); }
  openSerial({ role = 'sit', port, path, portPath } = {}) {
    const selectedPort = port || path || portPath;
    if (!selectedPort) throw new TypeError('openSerial requires a port');
    return this.request('serialOpen', { method: 'POST', body: { role, port: selectedPort } });
  }
  closeSerial({ role = 'sit' } = {}) { return this.request('serialClose', { method: 'POST', body: { role } }); }
  startCollection(options = {}) { return this.request('collectionStart', { method: 'POST', body: options }); }
  stopCollection() { return this.request('collectionStop', { method: 'POST', body: {} }); }

  connectRealtime({ channels = [], timeoutMs = this.timeoutMs, protocols } = {}) {
    const requested = backendChannels(channels);
    backendTimeout(timeoutMs);
    if (typeof this.WebSocketImpl !== 'function') throw new Error('WebSocket is unavailable; on Node.js 18/20 install ws, or inject WebSocketImpl');
    if (this.ws && this.ws.readyState <= 1) {
      if (this.ws.readyState === 1 && requested.length) this.subscribe(requested);
      else this.pendingChannels = backendChannels([...this.pendingChannels, ...requested]);
      return this.ws;
    }
    if (this.ws) this.disconnectRealtime();
    const ws = protocols === undefined ? new this.WebSocketImpl(this.wsUrl) : new this.WebSocketImpl(this.wsUrl, protocols);
    this.ws = ws;
    this.pendingChannels = requested;
    this.connectionTimer = setTimeout(() => {
      if (this.ws !== ws || ws.readyState !== 0) return;
      this.disconnectRealtime();
      this.emit('error', new Error('Backend WebSocket connection timed out'));
    }, timeoutMs);
    ws.onopen = () => {
      if (this.ws !== ws) return;
      clearTimeout(this.connectionTimer);
      // Subscribe before notifying listeners, so on('open') may safely disconnect.
      if (this.pendingChannels.length) this.subscribe(this.pendingChannels);
      this.pendingChannels = [];
      this.emit('open');
    };
    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.releaseSocket(ws);
      this.emit('close', event);
    };
    ws.onerror = (event) => {
      if (this.ws !== ws) return;
      this.emit('error', event.error || new Error(event.message || 'Backend WebSocket connection failed'));
    };
    ws.onmessage = (event) => {
      if (this.ws === ws) this.handleRealtimeMessage(event.data);
    };
    return ws;
  }

  releaseSocket(ws) {
    clearTimeout(this.connectionTimer);
    this.connectionTimer = null;
    this.pendingChannels = [];
    ws.onopen = ws.onclose = ws.onmessage = null;
    // ws (Node.js) may emit an error when closing during the opening handshake.
    ws.onerror = () => {};
    if (this.ws === ws) this.ws = null;
  }

  disconnectRealtime() {
    const ws = this.ws;
    if (!ws) return;
    this.releaseSocket(ws);
    if (ws.readyState < 2) ws.close();
    this.emit('close', { code: 1000, reason: 'client disconnect', wasClean: false });
  }

  sendRealtime(message) {
    if (!this.ws || this.ws.readyState !== 1) throw new Error('WebSocket is not connected');
    this.ws.send(JSON.stringify(message));
  }
  subscribe(channels) {
    this.sendRealtime({ type: this.contract?.websocket?.messageTypes?.SUBSCRIBE || 'subscribe', channels: backendChannels(channels) });
  }
  unsubscribe(channels) {
    this.sendRealtime({ type: this.contract?.websocket?.messageTypes?.UNSUBSCRIBE || 'unsubscribe', channels: backendChannels(channels) });
  }

  handleRealtimeMessage(rawMessage) {
    let message = rawMessage;
    if (typeof rawMessage === 'string') {
      try { message = JSON.parse(rawMessage); }
      catch { this.emit('raw', rawMessage); return; }
    }
    this.emit('message', message);
    if (Array.isArray(message?.frames)) {
      for (const frame of message.frames) this.emit('frame', frame);
    } else if (message && typeof message === 'object' &&
      ['channelId', 'portId', 'value'].some((key) => Object.hasOwn(message, key))) {
      this.emit('frame', message);
    }
  }
}
