/**
 * 浏览器串口：基于 Web Serial API，不用装任何驱动或客户端。
 *
 * 限制（浏览器规定的，绕不过去）：
 *   1. 只有 Chrome / Edge 支持，Safari 和 Firefox 没有；
 *   2. 页面必须是 https 或 localhost；
 *   3. 必须由用户点击触发，不能页面一加载就自动连。
 * 这三条任意一条不满足，就用 createMockDevice() 先跑通界面。
 */
import { createFramer } from '../core/framer.js';
import { decodeFrame } from '../core/frame.js';
import { createFrameHub } from '../core/device.js';

/** 当前环境能不能用浏览器串口 */
export function isSerialSupported() {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/**
 * 连接串口设备。必须在点击等用户手势里调用。
 *
 * @param {object} [options]
 * @param {number}   [options.baudRate]  波特率，默认 1000000
 * @param {number[]} [options.delimiter] 帧分隔符，默认 [0xAA,0x55,0x03,0x99]
 * @param {number}   [options.rows]      矩阵行数，不填按方阵推断
 * @param {number}   [options.cols]      矩阵列数
 * @param {object[]} [options.filters]   设备筛选，如 [{ usbVendorId: 0x1a86 }]
 * @returns {Promise<object>} device
 */
export async function connectSerial(options = {}) {
  if (!isSerialSupported()) {
    // 分清楚是「浏览器没这功能」还是「页面地址不对」，这两种的解决办法完全不同
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
      throw new Error(
        '页面是用 file:// 打开的，浏览器不会开放串口。请用本地服务器打开（SDK 目录里执行 node start.mjs）。'
      );
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new Error(
        `当前地址 ${location.origin} 不是安全上下文，浏览器不会开放串口。请改用 https 或 localhost。`
      );
    }
    throw new Error('当前浏览器没有 Web Serial API，请改用 Chrome 或 Edge。');
  }

  const port = options.port ?? (await navigator.serial.requestPort(
    options.filters ? { filters: options.filters } : {}
  ));
  const baudRate = options.baudRate ?? 1000000;
  await port.open({ baudRate });

  const hub = createFrameHub();
  const framer = createFramer(options);
  let reader = null;
  let closed = false;
  // 这两个计数是排查「连上了但没画面」的关键：
  // 字节一直涨、帧数不涨 = 波特率或分隔符不对；字节都不涨 = 设备根本没在发
  let bytesReceived = 0;
  let frameCount = 0;

  // 后台读取循环：一直读到 close() 或设备拔出
  (async function readLoop() {
    while (!closed && port.readable) {
      reader = port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          bytesReceived += value.length;
          for (const payload of framer.push(value)) {
            frameCount += 1;
            hub.emit(decodeFrame(payload, options));
          }
        }
      } catch (err) {
        if (!closed) console.error('[shroom] 串口读取中断：', err);
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* 已经释放过就忽略 */
        }
        reader = null;
      }
      if (closed) break;
    }
  })();

  return {
    info: {
      source: 'web-serial',
      baudRate,
      rows: options.rows ?? null,
      cols: options.cols ?? null,
    },
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
    async close() {
      closed = true;
      hub.clear();
      if (reader) {
        try {
          await reader.cancel();
        } catch {
          /* 忽略 */
        }
      }
      try {
        await port.close();
      } catch {
        /* 忽略 */
      }
    },
  };
}
