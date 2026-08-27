/**
 * 模拟数据源：没有硬件的时候也能把整条链路跑通。
 *
 * 它生成的是「原始字节」，和真实串口走同一条解码路径，
 * 所以你用模拟数据写好的渲染代码，插上真设备不用改。
 */
import { decodeFrame } from './frame.js';
import { createFrameHub } from './device.js';

/** 生成一帧：两个高斯亮斑绕着中心转 */
function renderBlobs(rows, cols, phase) {
  const buf = new Uint8Array(rows * cols);
  const blobs = [
    { x: 0.5 + 0.28 * Math.cos(phase), y: 0.5 + 0.28 * Math.sin(phase), r: 0.18, peak: 235 },
    { x: 0.5 + 0.22 * Math.cos(-phase * 1.7), y: 0.5 + 0.22 * Math.sin(-phase * 1.7), r: 0.12, peak: 180 },
  ];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const nx = cols > 1 ? x / (cols - 1) : 0.5;
      const ny = rows > 1 ? y / (rows - 1) : 0.5;
      let v = 0;
      for (const b of blobs) {
        const d2 = (nx - b.x) ** 2 + (ny - b.y) ** 2;
        v += b.peak * Math.exp(-d2 / (2 * b.r * b.r));
      }
      v += 3 * Math.random(); // 一点底噪，看起来像真数据
      buf[y * cols + x] = v > 255 ? 255 : v;
    }
  }
  return buf;
}

/**
 * @param {object} [options]
 * @param {number} [options.rows] 默认 32
 * @param {number} [options.cols] 默认 32
 * @param {number} [options.fps]  默认 30
 * @returns {object} device：和 connect() 返回的是同一套接口
 */
export function createMockDevice(options = {}) {
  const rows = options.rows ?? 32;
  const cols = options.cols ?? 32;
  const fps = options.fps ?? 30;

  const hub = createFrameHub();
  let phase = 0;
  let timer = setInterval(() => {
    phase += 0.08;
    const payload = renderBlobs(rows, cols, phase);
    hub.emit(decodeFrame(payload, { ...options, rows, cols }));
  }, Math.round(1000 / fps));

  return {
    info: { source: 'mock', rows, cols, fps },
    onFrame: hub.onFrame,
    async close() {
      if (timer) clearInterval(timer);
      timer = null;
      hub.clear();
    },
  };
}
