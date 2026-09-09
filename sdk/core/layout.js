/**
 * 点位排列：把「采集板扫描顺序」换成「垫子上的实际位置」。
 *
 * 串口里那 1024 个字节是采集板按自己的扫描顺序发出来的，
 * 不等于从垫子左上角开始逐行数过去的顺序。不做转换直接铺成 32×32，
 * 按上边一行会显示在画面中间 —— 位置全是错的，但数值本身没问题。
 *
 * 每种垫子的走线不一样，所以排列方式要按垫子选，不能自动猜。
 * 这里只放通用的两种；别的型号找官方技术人员要对应的排列。
 */

/** 恒等排列：不动，直接按扫描顺序铺。想看原始扫描矩阵时用这个 */
function identity() {
  return null;
}

/**
 * 32×32 压力垫：先把第 0~14 行前后倒过来，再整体上移 15 行。
 * 换算成一句话就是——显示的第 0 行取扫描的第 15 行，一直排到第 31 行，
 * 然后接上倒序的第 14 行到第 0 行。
 */
function mat32(rows, cols) {
  if (rows !== 32 || cols !== 32) return null;
  const perm = new Int32Array(rows * cols);
  for (let y = 0; y < rows; y += 1) {
    const srcRow = y <= 16 ? 15 + y : 31 - y;
    for (let x = 0; x < cols; x += 1) {
      perm[y * cols + x] = srcRow * cols + x;
    }
  }
  return perm;
}

export const LAYOUTS = { raw: identity, mat32 };

// 排列表只跟「名字 + 行列」有关，算一次就够了。
// decodeFrame 每帧都会调 getLayout，一秒上百次，不缓存就是白白分配上百个数组。
const cache = new Map();

/**
 * 取排列表。返回 null 表示不用换，调用方按原顺序读就行。
 *
 * @param {string|function|null} [name] 排列名，或自己写的 (rows, cols) => Int32Array|null
 * @param {number} rows
 * @param {number} cols
 * @returns {Int32Array|null} perm[显示位置] = 扫描顺序里的下标
 */
export function getLayout(name, rows, cols) {
  if (!name || name === 'raw') return null;
  const build = typeof name === 'function' ? name : LAYOUTS[name];
  if (!build) return null;

  const key = typeof name === 'function' ? name : `${name}:${rows}x${cols}`;
  if (typeof key === 'string' && cache.has(key)) return cache.get(key);

  const built = build(rows, cols);
  const perm = built && built.length === rows * cols ? built : null;
  if (typeof key === 'string') cache.set(key, perm);
  return perm;
}
