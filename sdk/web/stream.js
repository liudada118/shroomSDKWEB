import { ShroomError } from '../core/errors.js';
import { createFrameHub } from '../core/device.js';
import { decodeStreamFrame, STREAM_SCHEMA } from '../core/stream-codec.js';

/** 为实时连接和录制操作产生可供应用判断的错误。 */
function webStreamError(code, message, cause) {
  return new ShroomError(code, message, { stage: 'stream', cause });
}

/** 验证 WS 地址，同时阻止把凭据或片段误放进本地连接。 */
function webStreamResolveUrl(options) {
  const port = options.port ?? 19999;
  if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535
    || (typeof port !== 'number' && (typeof port !== 'string' || !/^\d+$/.test(port)))) {
    throw webStreamError('INVALID_CONFIG', 'WS 端口必须是 1 到 65535 的整数');
  }
  const host = options.host ?? '127.0.0.1';
  if (typeof host !== 'string' || !host || /[\s/@?#]/.test(host)) {
    throw webStreamError('INVALID_CONFIG', 'host 应为主机名或 IP，不包含协议或路径');
  }
  let url;
  try { url = new URL(options.url ?? `ws://${host}:${port}`); }
  catch (cause) { throw webStreamError('INVALID_CONFIG', 'WS 地址无效', cause); }
  if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash
    || (url.port && (Number(url.port) < 1 || Number(url.port) > 65535))) {
    throw webStreamError('INVALID_CONFIG', '仅支持不含账号、密码和片段的 ws:// 或 wss:// 地址');
  }
  return url;
}

/** 连接产品数据服务，复原类型化帧，并远程控制同一服务端的带标签录制。 */
export async function connectStream(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw webStreamError('INVALID_CONFIG', 'connectStream 需要配置对象');
  }
  const url = webStreamResolveUrl(options);
  const timeoutMs = options.timeoutMs ?? 10000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) {
    throw webStreamError('INVALID_CONFIG', 'timeoutMs 应在 1 到 300000 毫秒之间');
  }
  for (const name of ['onData', 'onError']) {
    if (options[name] !== undefined && typeof options[name] !== 'function') {
      throw webStreamError('INVALID_CONFIG', `${name} 需要传入函数`);
    }
  }
  const Socket = options.WebSocketImpl ?? globalThis.WebSocket;
  if (typeof Socket !== 'function') throw webStreamError('UNSUPPORTED_ENVIRONMENT', '当前环境不支持 WebSocket');
  const hub = createFrameHub();
  if (options.onError) hub.onError(options.onError);
  if (options.onData) hub.onFrame(options.onData);
  const recordingListeners = new Set();
  const requests = new Map();
  let info = null;
  let recording = null;
  let state = 'connecting';
  let sequence = 0;
  let settled = false;
  let intentionalClose = false;
  let socket;
  let readyTimer;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });

  /** 隔离应用的录制回调，避免一个回调抛错影响后续网络消息。 */
  function notifyRecording(next) {
    recording = next;
    for (const handler of [...recordingListeners]) {
      try { handler(recording); }
      catch (cause) { hub.emitError(webStreamError('CALLBACK_FAILED', '应用的 onRecording 回调执行失败', cause)); }
    }
  }

  /** 在断线或主动关闭时拒绝所有尚未收到回应的控制请求。 */
  function rejectPending(error) {
    for (const pending of requests.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    requests.clear();
  }

  /** 解除网络监听，防止关闭后的消息继续交付。 */
  function detach() {
    if (!socket) return;
    socket.removeEventListener('message', onMessage);
    socket.removeEventListener('close', onClose);
    socket.removeEventListener('error', onSocketError);
    clearTimeout(readyTimer);
  }

  /** 中止握手或现有连接，保持所有 Promise 都有明确结束状态。 */
  function fail(error, nextState = 'error') {
    if (state === 'closed' || state === 'error') return;
    state = nextState;
    detach();
    rejectPending(error);
    if (!settled) { settled = true; rejectReady(error); }
    if (!intentionalClose) hub.emitError(error);
    if (socket && socket.readyState < 2) {
      // Node ws emits an asynchronous error when a CONNECTING socket is closed.
      const ignoreClosingError = () => {};
      const releaseClosingListeners = () => {
        socket.removeEventListener('error', ignoreClosingError);
        socket.removeEventListener('close', releaseClosingListeners);
      };
      socket.addEventListener('error', ignoreClosingError);
      socket.addEventListener('close', releaseClosingListeners);
      try { socket.close(); }
      catch { releaseClosingListeners(); /* 不覆盖原始连接错误。 */ }
    }
  }

  /** 处理被动断线；不把客户端断线误当成服务端录制已经停止。 */
  function onClose() { fail(webStreamError('DISCONNECTED', 'WS 数据连接已断开，录制状态需重新连接后确认'), 'closed'); }

  /** 浏览器的 error 事件不包含可安全展示的内部网络细节。 */
  function onSocketError() { fail(webStreamError('CONNECTION_FAILED', '无法连接数据服务，请核对地址、端口、服务与页面协议')); }

  /** 校验响应结构，原样保留服务端公开的结构化错误码。 */
  function responseError(value) {
    return webStreamError(typeof value?.code === 'string' ? value.code : 'REQUEST_FAILED',
      typeof value?.message === 'string' ? value.message : '数据服务拒绝了请求');
  }

  /** 解码服务端消息；损坏帧或应用回调不会终止消息监听。 */
  function onMessage(event) {
    if (state === 'closed' || state === 'error') return;
    try {
      if (typeof event.data !== 'string' || event.data.length > 8 * 1024 * 1024) {
        throw webStreamError('PARSE_FAILED', 'WS 消息应为大小受限的 JSON 文本');
      }
      const message = JSON.parse(event.data);
      if (!message || typeof message !== 'object') throw webStreamError('PARSE_FAILED', '无效的 WS 消息');
      if (message.type === 'ready') {
        if (message.schema !== STREAM_SCHEMA || !message.info || typeof message.info !== 'object') {
          throw webStreamError('PARSE_FAILED', '数据服务版本或产品信息无效');
        }
        if (!settled) {
          info = message.info;
          state = 'open';
          notifyRecording(message.recording ?? null);
          settled = true;
          clearTimeout(readyTimer);
          resolveReady(client);
        }
      } else if (message.type === 'frame') {
        if (state !== 'open') throw webStreamError('PARSE_FAILED', '数据服务在 ready 握手前发送了数据');
        if (message.schema !== STREAM_SCHEMA) throw webStreamError('PARSE_FAILED', '数据帧版本不匹配');
        hub.emit(decodeStreamFrame(message.frame));
      } else if (message.type === 'recording') {
        notifyRecording(message.recording ?? null);
      } else if (message.type === 'response') {
        const pending = requests.get(message.requestId);
        if (!pending) return;
        requests.delete(message.requestId);
        clearTimeout(pending.timer);
        if (message.ok === true) {
          if (pending.type !== 'recording.list') notifyRecording(message.result ?? null);
          pending.resolve(message.result);
        } else pending.reject(responseError(message.error));
      } else if (message.type === 'error') hub.emitError(responseError(message.error));
    } catch (cause) {
      const error = cause instanceof ShroomError ? cause : webStreamError('PARSE_FAILED', 'WS 消息解析失败', cause);
      // 不兼容的 ready 消息无法建立可用连接；运行中的坏帧则单独报告。
      if (!settled) fail(error);
      else hub.emitError(error);
    }
  }

  /** 给服务端发送带超时及关联 ID 的录制控制请求。 */
  function request(type, payload = {}) {
    if (state !== 'open') return Promise.reject(webStreamError('DISCONNECTED', '请先连接 WS 数据服务'));
    const requestId = `browser-${++sequence}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        requests.delete(requestId);
        reject(webStreamError('REQUEST_TIMEOUT', '录制操作等待超时，请查询服务端状态后再操作'));
      }, timeoutMs);
      requests.set(requestId, { resolve, reject, timer, type });
      try { socket.send(JSON.stringify({ type, requestId, ...payload })); }
      catch (cause) {
        clearTimeout(timer);
        requests.delete(requestId);
        reject(webStreamError('WRITE_FAILED', '录制请求发送失败', cause));
      }
    });
  }

  /** 用必填的采集记录 ID 构造下载地址，不默认选择最近一次录制。 */
  function getRecordingUrl(id, { format = 'csv' } = {}) {
    if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
      throw webStreamError('INVALID_CONFIG', '必须传入采集记录 ID（recording.id），不能使用标签、产品 ID 或 WS 端口');
    }
    if (!['csv', 'jsonl'].includes(format)) throw webStreamError('INVALID_CONFIG', '下载格式仅支持 csv 或 jsonl');
    const downloadUrl = new URL(url.href);
    downloadUrl.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    downloadUrl.pathname = `/recordings/${id}.${format}`;
    downloadUrl.search = '';
    return downloadUrl.href;
  }

  const client = {
    onData: hub.onFrame,
    onFrame: hub.onFrame,
    onError: hub.onError,
    /** 订阅服务端录制状态，返回取消订阅函数。 */
    onRecording(handler) {
      if (typeof handler !== 'function') throw new TypeError('onRecording 需要传入函数');
      recordingListeners.add(handler);
      return () => recordingListeners.delete(handler);
    },
    /** 开始一次对应单个标签的服务端录制，不依赖页面是否正在渲染。 */
    startRecording(recordingOptions = {}) {
      if (!recordingOptions || typeof recordingOptions !== 'object' || Array.isArray(recordingOptions)) {
        return Promise.reject(webStreamError('INVALID_CONFIG', 'startRecording 需要包含 label 的配置对象'));
      }
      const { label } = recordingOptions;
      if (typeof label !== 'string' || !label.trim() || label.trim().length > 200) {
        return Promise.reject(webStreamError('INVALID_CONFIG', '请输入 1 到 200 个字符的采集标签'));
      }
      return request('recording.start', { label: label.trim() });
    },
    /** 停止服务端录制，等待文件写入完成后返回结果。 */
    stopRecording() { return request('recording.stop'); },
    /** 主动查询服务端状态，适用于重连或操作超时后的确认。 */
    getRecordingStatus() { return request('recording.status'); },
    /** 查询持久化录制列表，页面刷新不会丢失下载入口。 */
    listRecordings() { return request('recording.list'); },
    getRecordingUrl,
    /** 下载指定采集 ID 的文件；ID 必填，不能用标签或端口代替。 */
    downloadRecording(id, downloadOptions = {}) {
      const href = getRecordingUrl(id, downloadOptions);
      if (typeof document === 'undefined' || !document.body) {
        throw webStreamError('UNSUPPORTED_ENVIRONMENT', '文件下载需要浏览器页面环境');
      }
      const link = document.createElement('a');
      link.href = href;
      link.download = '';
      link.hidden = true;
      link.referrerPolicy = 'no-referrer';
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); }
      return href;
    },
    /** 仅关闭浏览器订阅，不停止 Node 服务或其正在进行的录制。 */
    async close() {
      if (state === 'closed' || state === 'error') { hub.clear(); recordingListeners.clear(); return; }
      intentionalClose = true;
      fail(webStreamError('DISCONNECTED', '客户端已关闭连接'), 'closed');
      hub.clear();
      recordingListeners.clear();
    },
    get info() { return info; },
    get state() { return state; },
    get recording() { return recording; },
    get url() { return url.href; },
  };

  try {
    socket = new Socket(url.href);
    socket.addEventListener('message', onMessage);
    socket.addEventListener('close', onClose);
    socket.addEventListener('error', onSocketError);
    readyTimer = setTimeout(() => fail(webStreamError('CONNECTION_FAILED', '等待数据服务 ready 握手超时')), timeoutMs);
  } catch (cause) {
    fail(webStreamError('CONNECTION_FAILED', 'WS 连接创建失败', cause));
  }
  return ready;
}
