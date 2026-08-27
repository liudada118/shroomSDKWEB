/**
 * 调色板：把 0~1 的值映射成颜色。
 *
 * 只放最基础的两张，够画热力图用。要别的配色自己加一个函数进 COLORMAPS 就行。
 */

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** 经典 jet 彩虹配色：蓝 → 青 → 绿 → 黄 → 红 */
export function jet(t) {
  const x = clamp01(t);
  let r = 1;
  let g = 1;
  let b = 1;
  if (x < 0.25) {
    r = 0;
    g = 4 * x;
  } else if (x < 0.5) {
    r = 0;
    b = 1 + 4 * (0.25 - x);
  } else if (x < 0.75) {
    r = 4 * (x - 0.5);
    b = 0;
  } else {
    g = 1 + 4 * (0.75 - x);
    b = 0;
  }
  return [Math.round(255 * r), Math.round(255 * g), Math.round(255 * b)];
}

/** 白底 jet：0 是白色，压力越大越红。适合打印和浅色界面 */
export function jetWhite(t) {
  const x = clamp01(t);
  if (x <= 0.001) return [255, 255, 255];
  const [r, g, b] = jet(x);
  const fade = Math.min(1, x / 0.15);
  return [
    Math.round(255 + (r - 255) * fade),
    Math.round(255 + (g - 255) * fade),
    Math.round(255 + (b - 255) * fade),
  ];
}

/** 灰度：黑到白 */
export function grey(t) {
  const v = Math.round(255 * clamp01(t));
  return [v, v, v];
}

export const COLORMAPS = { jet, jetWhite, grey };

/** 按名字取调色板，取不到就回退到 jet */
export function getColormap(name) {
  if (typeof name === 'function') return name;
  return COLORMAPS[name] ?? jet;
}
