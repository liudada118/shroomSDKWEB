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

  const port = await new Promise((resolve, reject) => {
    const p = new SerialPort({ path, baudRate }, (err) => (err ? reject(err) : resolve(p)));
  });

  port.on('data', (chunk) => {
    for (const payload of framer.push(new Uint8Array(chunk))) {
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
    close() {
      hub.clear();
      return new Promise((resolve) => port.close(() => resolve()));
    },
  };
}
