import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';
import { ShroomError } from '../core/errors.js';
import { encodeStreamFrame, STREAM_SCHEMA } from '../core/stream-codec.js';
import { createRecordingStore, recordingCsv, RECORDING_ID } from './recording.js';
import { assertLicense, watchLicense, getDeviceLicenseRequirement } from '../core/license.js';
import { isMockDevice } from '../core/mock.js';

/** Normalize a public failure to a small WS/HTTP-safe structure. */
function publicError(error) {
  return { code: error?.code ?? 'SERVER_ERROR', message: error?.message ?? '服务操作失败。' };
}

/** Recognize explicit loopback hosts without accidentally exposing a default public listener. */
function isLoopback(host) {
  return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host?.toLowerCase());
}

/** Validate before importing dependencies, opening directories or subscribing to devices. */
function serverOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new ShroomError('INVALID_CONFIG', '服务配置必须是对象。');
  const { port = 19999, host = '127.0.0.1', recordingsDir = resolve('.shroom-recordings'), allowedOrigins,
    maxBufferedBytes = 1024 * 1024, maxQueueFrames = 1000 } = options;
  if (!Number.isInteger(port) || port < 0 || port > 65535 || typeof host !== 'string' || !host.trim()
    || typeof recordingsDir !== 'string' || !recordingsDir.trim()
    || !Number.isSafeInteger(maxBufferedBytes) || maxBufferedBytes < 1024
    || !Number.isSafeInteger(maxQueueFrames) || maxQueueFrames < 1 || maxQueueFrames > 100000) {
    throw new ShroomError('INVALID_CONFIG', '检查端口、主机、录制目录和缓冲区限制。');
  }
  if (allowedOrigins !== undefined && (!Array.isArray(allowedOrigins) || allowedOrigins.some((origin) => {
    if (origin === 'null') return false;
    try { const parsed = new URL(origin); return !['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin; }
    catch { return true; }
  }))) throw new ShroomError('INVALID_CONFIG', 'allowedOrigins 必须是明确的 HTTP/HTTPS origin 列表，不能使用通配符。');
  if (!isLoopback(host) && !allowedOrigins?.length) {
    throw new ShroomError('INVALID_CONFIG', '非本机服务必须显式设置 allowedOrigins，限定允许接入的网页来源。');
  }
  return { port, host, recordingsDir, allowedOrigins, maxBufferedBytes, maxQueueFrames };
}

/** Start a local WS relay plus persistent label recording and same-port HTTP downloads. */
export async function serveDevice(device, options = {}) {
  const config = serverOptions(options);
  const subscribe = device?.onData ?? device?.onFrame;
  if (typeof subscribe !== 'function') throw new ShroomError('INVALID_CONFIG', 'serveDevice 需要一个提供 onData 或 onFrame 的设备。');
  const mockSource = isMockDevice(device);
  const sourceRequirement = getDeviceLicenseRequirement(device) ?? { feature: 'serial.raw' };
  let sourceLicenseError = null;
  function assertSourceLicense() {
    if (mockSource) return;
    if (sourceLicenseError) throw sourceLicenseError;
    assertLicense(sourceRequirement);
    assertLicense({ feature: 'stream' });
  }
  function assertRecordingLicense() {
    assertSourceLicense();
    if (!mockSource) assertLicense({ feature: 'recording' });
  }
  assertSourceLicense();
  let WebSocketServer;
  try { ({ WebSocketServer } = await import('ws')); }
  catch (cause) { throw new ShroomError('DEPENDENCY_MISSING', 'WS 服务需要安装可选依赖：npm install ws', { cause, stage: 'serve' }); }
  let closed = false;
  let closing = null;
  let unsubscribeData;
  let unsubscribeError;
  let unsubscribeSourceLicense;
  let unsubscribeStreamLicense;
  let unsubscribeRecordingLicense;
  let pendingControl = Promise.resolve();
  const clients = new Set();
  const httpSockets = new Set();

  /** A custom source's cleanup cannot prevent the relay from releasing its own resources. */
  function detachSource() {
    const subscriptions = [unsubscribeData, unsubscribeError];
    unsubscribeData = undefined; unsubscribeError = undefined;
    for (const unsubscribe of subscriptions) {
      try { unsubscribe?.(); } catch { /* The source owns its callback; forwarding is already disabled. */ }
    }
  }

  /** Permit explicit trusted origins, or HTTP localhost pages for a default loopback-only server. */
  function originAllowed(origin) {
    if (origin === undefined) return true; // Native Node clients do not send Origin.
    if (config.allowedOrigins) return config.allowedOrigins.includes(origin);
    try { const parsed = new URL(origin); return ['http:', 'https:'].includes(parsed.protocol) && isLoopback(parsed.hostname); }
    catch { return false; }
  }

  /** Refuse loopback DNS rebinding hosts as well as untrusted browser origins. */
  function requestAllowed(request) {
    if (!originAllowed(request.headers.origin)) return false;
    if (!isLoopback(config.host)) return true;
    try { return isLoopback(new URL(`http://${request.headers.host}`).hostname); }
    catch { return false; }
  }

  /** Send without accumulating unbounded data for a slow/disconnected viewer. */
  function send(client, message) {
    if (client.readyState !== 1) return;
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    if (client.bufferedAmount + Buffer.byteLength(data) > config.maxBufferedBytes) {
      client.close(1013, '客户端读取过慢，请重新连接');
      return;
    }
    client.send(data, (error) => { if (error) client.terminate(); });
  }

  /** Broadcast one shared encoded payload to connected viewers. */
  function broadcast(message) {
    const encoded = JSON.stringify(message);
    for (const client of clients) send(client, encoded);
  }

  let recorder;
  try {
    recorder = await createRecordingStore({ directory: config.recordingsDir, maxQueueFrames: config.maxQueueFrames,
      onChange: (recording) => broadcast({ type: 'recording', recording }) });
  } catch (cause) {
    throw new ShroomError('RECORDING_WRITE_FAILED', '无法打开录制目录，请检查目录权限和磁盘空间。', { cause, stage: 'recording' });
  }

  /** Keep historical files available after access expires, but stop accepting live data. */
  function sourceLicenseInvalid(error) {
    if (closed || sourceLicenseError) return;
    sourceLicenseError = error;
    detachSource();
    unsubscribeSourceLicense?.(); unsubscribeStreamLicense?.(); unsubscribeRecordingLicense?.();
    broadcast({ type: 'error', error: publicError(error) });
    void recorder.abort(error).catch((cause) => broadcast({ type: 'error', error: publicError(cause) }));
  }

  /** Losing recording permission preserves the file and leaves separately licensed viewing usable. */
  function recordingLicenseInvalid(error) {
    if (closed) return;
    unsubscribeRecordingLicense?.();
    unsubscribeRecordingLicense = undefined;
    broadcast({ type: 'error', error: publicError(error) });
    void recorder.abort(error).catch((cause) => broadcast({ type: 'error', error: publicError(cause) }));
  }

  /** Sequence recording controls across Node callers and all browser connections. */
  function control(action) {
    const result = pendingControl.then(() => {
      if (closed) throw new ShroomError('SERVER_CLOSED', '服务已关闭。', { stage: 'serve' });
      return action();
    });
    pendingControl = result.catch(() => {});
    return result;
  }

  /** Start one labelled recording without coupling it to rendering/viewer presence. */
  function startRecording(options) {
    return control(async () => {
      assertRecordingLicense();
      const result = await recorder.start({ ...options, product: device.info?.product, side: device.info?.side, source: device.info?.source });
      try {
        if (closed) throw new ShroomError('SERVER_CLOSED', '服务已关闭。', { stage: 'serve' });
        assertRecordingLicense();
      }
      catch (error) { await recorder.abort(error); throw error; }
      unsubscribeRecordingLicense?.();
      if (!mockSource) unsubscribeRecordingLicense = watchLicense({ feature: 'recording' }, recordingLicenseInvalid);
      return result;
    });
  }

  /** Stop only after buffered rows and final metadata have been written. */
  function stopRecording() {
    return control(async () => {
      const result = await recorder.stop();
      unsubscribeRecordingLicense?.(); unsubscribeRecordingLicense = undefined;
      return result;
    });
  }

  /** Read persisted and active sessions without exposing their filesystem paths. */
  function listRecordings() { return control(() => recorder.list()); }

  /** Serve only health checks and generated recording UUID downloads. */
  async function handleHttp(request, response) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Vary', 'Origin');
    if (!requestAllowed(request)) {
      response.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: { code: 'ORIGIN_DENIED', message: '网页来源或服务 Host 不允许。' } }));
      return;
    }
    if (request.headers.origin) response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, OPTIONS' }); response.end(); return;
    }
    if (request.method !== 'GET') { response.writeHead(405, { Allow: 'GET, OPTIONS' }); response.end(); return; }
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: !closed, schema: STREAM_SCHEMA, info: device.info ?? {}, recording: recorder.status() }));
      return;
    }
    const match = /^\/recordings\/([^/]+)\.(csv|jsonl)$/.exec(path);
    if (!match || !RECORDING_ID.test(match[1])) { response.writeHead(404); response.end(); return; }
    try {
      const recording = recorder.download(match[1]);
      await access(recording.path);
      const extension = match[2];
      response.writeHead(200, {
        'Content-Type': extension === 'csv' ? 'text/csv; charset=utf-8' : 'application/x-ndjson; charset=utf-8',
        'Content-Disposition': `attachment; filename="shroom-${recording.meta.id}.${extension}"`,
        'Access-Control-Expose-Headers': 'Content-Disposition',
      });
      const source = extension === 'csv' ? Readable.from(recordingCsv(recording.path)) : createReadStream(recording.path);
      await pipeline(source, response);
    } catch (error) {
      if (response.headersSent) { response.destroy(error); return; }
      response.writeHead(error.code === 'RECORDING_ACTIVE' ? 409 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: publicError(error) }));
    }
  }

  const server = createServer((request, response) => {
    void handleHttp(request, response).catch(() => { if (!response.headersSent) response.writeHead(500); response.end(); });
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false });
  server.on('connection', (socket) => { httpSockets.add(socket); socket.on('close', () => httpSockets.delete(socket)); });
  server.on('upgrade', (request, socket, head) => {
    if (closed || !requestAllowed(request) || !['/', '/ws'].includes(new URL(request.url, 'http://localhost').pathname)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(request, socket, head, (client) => wss.emit('connection', client, request));
  });
  wss.on('connection', (client) => {
    clients.add(client);
    let pendingRequests = 0;
    client.on('close', () => clients.delete(client));
    // ws sends the appropriate protocol close (e.g. 1009 for oversize input) itself.
    client.on('error', () => {});
    send(client, { type: 'ready', schema: STREAM_SCHEMA, info: device.info ?? {}, recording: recorder.status() });
    client.on('message', (data, binary) => {
      let request;
      try {
        if (binary) throw new ShroomError('INVALID_REQUEST', '控制消息必须是 JSON 文本。');
        request = JSON.parse(data.toString());
        if (!request || typeof request !== 'object' || Array.isArray(request)
          || !['string', 'number'].includes(typeof request.requestId) || String(request.requestId).length > 128) {
          throw new ShroomError('INVALID_REQUEST', '控制消息需要有效的 requestId。');
        }
      } catch (error) { send(client, { type: 'response', requestId: null, ok: false, error: publicError(error) }); return; }
      const actions = {
        'recording.start': () => startRecording({ label: request.label }),
        'recording.stop': stopRecording,
        'recording.status': () => Promise.resolve(recorder.status()),
        'recording.list': listRecordings,
      };
      const action = Object.hasOwn(actions, request.type) && actions[request.type];
      if (!action) { send(client, { type: 'response', requestId: request.requestId, ok: false,
        error: { code: 'INVALID_REQUEST', message: '不支持的控制消息。' } }); return; }
      if (pendingRequests >= 64) { client.close(1013, '控制请求过多，请等待当前操作完成'); return; }
      pendingRequests += 1;
      Promise.resolve().then(action).then(
        (result) => send(client, { type: 'response', requestId: request.requestId, ok: true, result }),
        (error) => send(client, { type: 'response', requestId: request.requestId, ok: false, error: publicError(error) }),
      ).finally(() => { pendingRequests -= 1; });
    });
  });

  try {
    assertSourceLicense();
    await new Promise((done, reject) => {
      server.once('error', reject);
      server.listen(config.port, config.host, () => { server.off('error', reject); done(); });
    });
    assertSourceLicense();
    unsubscribeData = Reflect.apply(subscribe, device, [(frame) => {
      if (closed || sourceLicenseError) return;
      try { assertSourceLicense(); }
      catch (error) { sourceLicenseInvalid(error); return; }
      try {
        const wire = encodeStreamFrame(frame);
        assertSourceLicense();
        if (recorder.status()?.status === 'recording') {
          try { assertRecordingLicense(); recorder.append(wire); }
          catch (error) { recordingLicenseInvalid(error); }
        }
        broadcast({ type: 'frame', schema: STREAM_SCHEMA, frame: wire });
      } catch (error) {
        if (error?.stage === 'license') { sourceLicenseInvalid(error); return; }
        broadcast({ type: 'error', error: publicError(error) });
        void recorder.abort(error).catch((cause) => broadcast({ type: 'error', error: publicError(cause) }));
      }
    }]);
    if (typeof device.onError === 'function') unsubscribeError = device.onError((error) => {
      broadcast({ type: 'error', error: publicError(error) });
      if (!['CALLBACK_FAILED'].includes(error?.code) && recorder.status()?.status === 'recording') {
        void recorder.abort(error).catch((cause) => broadcast({ type: 'error', error: publicError(cause) }));
      }
    });
    if (!mockSource) {
      unsubscribeSourceLicense = watchLicense(sourceRequirement, sourceLicenseInvalid);
      unsubscribeStreamLicense = watchLicense({ feature: 'stream' }, sourceLicenseInvalid);
    }
    assertSourceLicense();
  } catch (error) {
    detachSource();
    unsubscribeSourceLicense?.(); unsubscribeStreamLicense?.(); unsubscribeRecordingLicense?.();
    for (const client of clients) client.terminate();
    wss.close();
    await recorder.close();
    if (server.listening) {
      const stopped = new Promise((done) => server.close(done));
      for (const socket of httpSockets) socket.destroy();
      await stopped;
    }
    if (error?.stage === 'license') throw error;
    throw new ShroomError(error.code ?? 'SERVER_START_FAILED', `无法启动 WS 服务：${error.message}`, { cause: error, stage: 'serve' });
  }
  const address = server.address();
  const hostForUrl = config.host.includes(':') ? `[${config.host.replace(/^\[|\]$/g, '')}]` : config.host;
  const port = address.port;
  // Recording progress comes from persisted rows, not the browser's displayed frame count.
  const recordingTicker = setInterval(() => {
    const recording = recorder.status();
    if (!closed && recording?.status === 'recording') broadcast({ type: 'recording', recording });
  }, 1000);
  recordingTicker.unref();
  return {
    host: config.host, port, url: `ws://${hostForUrl}:${port}`, httpUrl: `http://${hostForUrl}:${port}`,
    startRecording, stopRecording, listRecordings,
    /** Report the latest session without a network round trip. */
    getRecordingStatus() { return recorder.status(); },
    /** Unsubscribe, flush files and release server sockets, but do not close the caller-owned device. */
    close() {
      if (closing) return closing;
      closed = true;
      clearInterval(recordingTicker);
      detachSource();
      unsubscribeSourceLicense?.(); unsubscribeStreamLicense?.(); unsubscribeRecordingLicense?.();
      closing = (async () => {
        await pendingControl;
        let persistenceError;
        try { await recorder.close(); } catch (error) { persistenceError = error; }
        for (const client of clients) client.terminate();
        await new Promise((done) => wss.close(done));
        const serverClosed = new Promise((done) => server.close(done));
        for (const socket of httpSockets) socket.destroy();
        await serverClosed;
        if (persistenceError) throw persistenceError;
      })();
      return closing;
    },
  };
}
