/**
 * 帧解码：把一帧原始字节变成统一的 Frame 对象。
 *
 * 整个 SDK 只有这一个数据结构，连接方式（Web Serial / Node 串口 / 模拟）
 * 不同，拿到的 Frame 是一样的。
 *
 * Frame {
 *   raw       Uint8Array   原始 ADC 值，0~255，一个点一个字节
 *   values    Float32Array 归一化到 0~1 的值，长度 = rows * cols
 *   rows, cols             矩阵尺寸
 *   min, max, avg          归一化后的极值与均值
 *   area                   有效点数（超过阈值的点）
 *   center    {x, y}       压力重心，0~1
 *   timestamp              毫秒时间戳
 * }
 *
 * 说明：默认按「1 字节 = 1 个点」解析，方阵推断行列（1024 → 32×32）。
 * 如果你的设备不是这个规格，用 options.rows / options.cols 显式指定。
 */

/** 由点数推断矩阵行列；不是完全平方数就退化成单行 */
export function resolveShape(points, options = {}) {
  if (options.rows && options.cols) {
    return { rows: options.rows, cols: options.cols };
  }
  const side = Math.round(Math.sqrt(points));
  if (side * side === points) return { rows: side, cols: side };
  return { rows: 1, cols: points };
}

/**
 * @param {Uint8Array} payload 一帧的原始字节（不含分隔符）
 * @param {object} [options]
 * @param {number} [options.rows]      指定行数
 * @param {number} [options.cols]      指定列数
 * @param {number} [options.points]    只取前 N 个字节，默认取全部
 * @param {number} [options.fullScale] 满量程，默认 255
 * @param {number} [options.threshold] 有效点阈值（归一化后），默认 0.02
 * @returns {object} Frame
 */
export function decodeFrame(payload, options = {}) {
  const fullScale = options.fullScale ?? 255;
  const threshold = options.threshold ?? 0.02;
  const points = Math.min(options.points ?? payload.length, payload.length);
  const { rows, cols } = resolveShape(points, options);
  const size = rows * cols;

  const raw = payload.subarray(0, points);
  const values = new Float32Array(size);

  let min = Infinity;
  let max = 0;
  let sum = 0;
  let area = 0;
  let weight = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < size; i += 1) {
    const v = i < points ? raw[i] / fullScale : 0;
    values[i] = v;
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
    if (v > threshold) {
      area += 1;
      weight += v;
      cx += (i % cols) * v;
      cy += Math.floor(i / cols) * v;
    }
  }

  return {
    raw,
    values,
    rows,
    cols,
    min: min === Infinity ? 0 : min,
    max,
    avg: size > 0 ? sum / size : 0,
    area,
    center: weight > 0
      ? { x: cx / weight / Math.max(1, cols - 1), y: cy / weight / Math.max(1, rows - 1) }
      : { x: 0.5, y: 0.5 },
    timestamp: Date.now(),
  };
}
