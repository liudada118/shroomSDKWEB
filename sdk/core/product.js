import { ShroomError } from './errors.js';
import { decodeFrame } from './frame.js';
import { decodeGlovePacket } from './glove.js';

// Only profiles whose wire protocol and mapping have been checked against shroom1.
const deviceProductProfiles = Object.freeze({
  handGloveFullPacket: Object.freeze({
    product: 'handGloveFullPacket', label: '触觉手套（整包）', family: 'glove',
    baudRate: 921600, payloadLength: 274, sensorPoints: 256, rows: 13, cols: 15,
  }),
  hand: Object.freeze({
    product: 'hand', label: '手部检测垫', family: 'mat',
    baudRate: 1000000, payloadLength: 1024, sensorPoints: 1024, rows: 32, cols: 32,
  }),
});
const deviceProductDelimiter = [0xaa, 0x55, 0x03, 0x99];

/** 列出已封装连接协议的产品；不等于通用线序/展示产品清单。 */
export function listDeviceProducts() {
  return Object.values(deviceProductProfiles).map((profile) => ({ ...profile }));
}

/** 在打开端口前验证产品与回调，不允许客户误改产品固有协议。 */
export function prepareProductConnection(options = {}) {
  const invalid = (field, message) => {
    throw new ShroomError('INVALID_CONFIG', message, { stage: 'configure', details: { field } });
  };
  if (!options || typeof options !== 'object' || Array.isArray(options)) invalid('options', '产品连接参数必须是一个对象。');
  const profile = Object.hasOwn(deviceProductProfiles, options.product) ? deviceProductProfiles[options.product] : null;
  if (!profile) invalid('product', '请选择已支持的产品：handGloveFullPacket（整包手套）或 hand（手部检测垫）。');
  const allowed = new Set(['product', 'path', 'port', 'filters', 'side', 'onData', 'onError']);
  for (const field of Object.keys(options)) {
    if (!allowed.has(field)) invalid(field, `产品接口不接受 ${field}；波特率、分帧和线序已经内置。自定义协议请使用 connect()。`);
  }
  for (const field of ['onData', 'onError']) {
    if (options[field] !== undefined && typeof options[field] !== 'function') invalid(field, `${field} 必须是函数。`);
  }
  if (profile.family === 'glove' && !['left', 'right'].includes(options.side)) {
    invalid('side', '整包手套必须明确指定 side: left 或 right，不能根据串口或包类型猜测手侧。');
  }
  if (profile.family !== 'glove' && options.side !== undefined) invalid('side', '手部检测垫不需要 side 参数。');
  const serialOptions = {
    baudRate: profile.baudRate, rows: profile.rows, cols: profile.cols,
    ...(options.path === undefined ? {} : { path: options.path }),
    ...(options.port === undefined ? {} : { port: options.port }),
    ...(options.filters === undefined ? {} : { filters: options.filters }),
  };
  return {
    serialOptions,
    parser: createProductParser(profile.product, { side: options.side }),
    info: {
      product: profile.product, label: profile.label, rows: profile.rows, cols: profile.cols,
      ...(profile.family === 'glove' ? { side: options.side } : {}),
    },
    onData: options.onData, onError: options.onError,
  };
}

/** 找出协议尾分隔符，允许分隔符跨多个串口 chunk。 */
function productDelimiterIndex(bytes, offset) {
  outer: for (let i = offset; i <= bytes.length - deviceProductDelimiter.length; i++) {
    for (let j = 0; j < deviceProductDelimiter.length; j++) {
      if (bytes[i + j] !== deviceProductDelimiter[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** 按 shroom1 的尾分隔协议产出产品数据；不靠帧长推测型号或手侧。 */
export function createProductParser(product, { side } = {}) {
  const profile = Object.hasOwn(deviceProductProfiles, product) ? deviceProductProfiles[product] : null;
  if (!profile || (profile.family === 'glove' && !['left', 'right'].includes(side))) {
    throw new ShroomError('INVALID_CONFIG', '请选择有效的产品及手套手侧。', { stage: 'configure' });
  }
  let pending = new Uint8Array();
  let overflowed = false;
  let dropped = 0;
  let frameLength = 0;
  return {
    /** 输入串口字节；不完整帧继续等待，长度错误的包丢弃并计数。 */
    push(chunk) {
      if (!(chunk instanceof Uint8Array)) throw new ShroomError('PARSE_FAILED', '产品输入必须是 Uint8Array 字节。', { stage: 'parse' });
      if (!chunk.length) return [];
      const bytes = new Uint8Array(pending.length + chunk.length);
      bytes.set(pending);
      bytes.set(chunk, pending.length);
      let offset = 0;
      let tail;
      const frames = [];
      while ((tail = productDelimiterIndex(bytes, offset)) !== -1) {
        const size = tail - offset;
        if (!overflowed && size === profile.payloadLength) {
          const payload = bytes.slice(offset, tail);
          let frame;
          if (profile.family === 'glove') frame = decodeGlovePacket(payload, { side });
          else {
            frame = decodeFrame(payload, { layout: 'mat32' });
            frame.product = profile.product;
            frame.pressure = payload;
            // ADC matrix is distinct from normalized values and source scan order.
            frame.pressureMatrix = Uint8Array.from(frame.values, (value) => Math.round(value * 255));
          }
          frames.push(frame);
          frameLength = profile.payloadLength;
        } else if (overflowed || size > 0) dropped += 1;
        overflowed = false;
        offset = tail + deviceProductDelimiter.length;
      }
      pending = bytes.slice(offset);
      if (pending.length > profile.payloadLength + deviceProductDelimiter.length - 1) {
        // Discard the entire oversize segment up to the next tail, not a fake last-N-byte frame.
        overflowed = true;
        pending = pending.slice(-(deviceProductDelimiter.length - 1));
      }
      return frames;
    },
    /** 清空半包与累计计数，供独立数据源重新开始。 */
    reset() { pending = new Uint8Array(); overflowed = false; dropped = 0; frameLength = 0; },
    get droppedCount() { return dropped; },
    get frameLength() { return frameLength; },
  };
}
