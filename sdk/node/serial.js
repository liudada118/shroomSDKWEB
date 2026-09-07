/**
 * Node 串口：给 Electron 主进程、后端服务、命令行脚本用。
 *
 * 依赖 serialport（原生模块），是按需加载的：
 *   npm i serialport
 * 不装也不影响 core/ 和模拟数据。
 */
import { createFramer } from '../core/framer.js';
import { decodeFrame } from '../core/frame.js';
import { createFrameHub } from '../core/device.js';

async function loadSerialPort() {
  try {
    return await import('serialport');
  } catch {
    throw new Error('没找到 serialport，请先运行：npm i serialport');
  }
}

/** 列出当前机器上的串口 */
export async function listPorts() {
  const { SerialPort } = await loadSerialPort();
  return SerialPort.list();
}

/**
 * 连接串口设备。
 *
 * @param {object} [options]
 * @param {string}   [options.path]      端口号，如 'COM3' / '/dev/ttyUSB0'；不填自动挑第一个
 * @param {number}   [options.baudRate]  波特率，默认 1000000
 * @param {number[]} [options.delimiter] 帧分隔符
 * @param {number}   [options.rows]      矩阵行数，不填按方阵推断
 * @param {number}   [options.cols]      矩阵列数
 * @returns {Promise<object>} device
 */
export async function connectSerial(options = {}) {
  const { SerialPort } = await loadSerialPort();

  let path = options.path;
  if (!path) {
    const ports = await SerialPort.list();
    if (ports.length === 0) throw new Error('没有检测到串口设备');
    path = ports[0].path;
  }

  const baudRate = options.baudRate ?? 1000000;
  const hub = createFrameHub();
  const framer = createFramer(options);
  // 这两个计数是排查「连上了但没数据」的关键，和浏览器端保持一致：
  // 字节一直涨、帧数不涨 = 波特率或分隔符不对；字节都不涨 = 设备根本没在发
  let bytesReceived = 0;
  let frameCount = 0;

  const port = await new Promise((resolve, reject) => {
    const p = new SerialPort({ path, baudRate }, (err) => (err ? reject(err) : resolve(p)));
  });

  port.on('data', (chunk) => {
    bytesReceived += chunk.length;
    for (const payload of framer.push(new Uint8Array(chunk))) {
      frameCount += 1;
      hub.emit(decodeFrame(payload, options));
    }
  });
  port.on('error', (err) => console.error('[shroom] 串口错误：', err.message));

  return {
    info: { source: 'node-serial', path, baudRate, rows: options.rows ?? null, cols: options.cols ?? null },
    onFrame: hub.onFrame,
    /** 丢掉的脏帧数：一直在涨说明波特率或分隔符配错了 */
    get droppedCount() {
      return framer.droppedCount;
    },
    /** 串口收到的原始字节总数。为 0 说明设备没在发，跟解析无关 */
    get bytesReceived() {
      return bytesReceived;
    },
    /** 成功切出的帧数。字节在涨而它不涨，就是波特率或分隔符不对 */
    get frameCount() {
      return frameCount;
    },
    /** 锁定下来的帧长（字节）。不是完全平方数就得显式指定 rows / cols */
    get frameLength() {
      return framer.frameLength;
    },
    close() {
      hub.clear();
      return new Promise((resolve) => port.close(() => resolve()));
    },
  };
}
