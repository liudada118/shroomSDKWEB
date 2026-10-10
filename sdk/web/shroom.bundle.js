/**
 * Shroom SDK 0.1.0 —— 单文件版（自动生成，别手改）
 *
 * 由 scripts/build-sdk-bundle.mjs 从 core/ + web/ 拼出来，内容和模块版完全一致。
 * 它是「经典脚本」而不是模块，所以用普通的 script 标签引进去就行，file:// 下也能加载，
 * 加载完全局多一个 Shroom 对象。
 *
 * 正经项目里请直接 import 模块版：import { Shroom } from './web/index.js'
 */
(function (global) {
  'use strict';

  // ---------- core/colormap.js ----------
  /**
   * 调色板：把 0~1 的值映射成颜色。
   *
   * 只放最基础的两张，够画热力图用。要别的配色自己加一个函数进 COLORMAPS 就行。
   */

  function clamp01(t) {
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  /** 经典 jet 彩虹配色：蓝 → 青 → 绿 → 黄 → 红 */
  function jet(t) {
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
  function jetWhite(t) {
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
  function grey(t) {
    const v = Math.round(255 * clamp01(t));
    return [v, v, v];
  }

  /**
   * Shroom 上位机同款配色：深紫底 → 蓝紫 → 青 → 绿 → 黄 → 红。
   * 色标和取值点跟正式上位机一致，两边看到的颜色能对上。
   */
  const SHROOM_STOPS = [
    [0.0, [21, 18, 42]],
    [0.4, [62, 0, 248]],
    [0.55, [149, 253, 237]],
    [0.7, [154, 255, 62]],
    [0.85, [246, 254, 71]],
    [1.0, [216, 36, 36]],
  ];

  function shroom(t) {
    const x = clamp01(t);
    for (let i = 1; i < SHROOM_STOPS.length; i += 1) {
      const [p1, c1] = SHROOM_STOPS[i];
      if (x > p1) continue;
      const [p0, c0] = SHROOM_STOPS[i - 1];
      const k = p1 === p0 ? 0 : (x - p0) / (p1 - p0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * k),
        Math.round(c0[1] + (c1[1] - c0[1]) * k),
        Math.round(c0[2] + (c1[2] - c0[2]) * k),
      ];
    }
    return SHROOM_STOPS[SHROOM_STOPS.length - 1][1].slice();
  }

  const COLORMAPS = { shroom, jet, jetWhite, grey };

  /** 按名字取调色板，取不到就回退到 jet */
  function getColormap(name) {
    if (typeof name === 'function') return name;
    return COLORMAPS[name] ?? jet;
  }

  // ---------- core/layout.js ----------
  /**
   * 点位排列（线序）：把「采集板扫描顺序」换成「垫子上的实际位置」。
   *
   * 串口里那 1024 个字节是采集板按自己的扫描顺序发出来的，不等于从垫子左上角
   * 逐行数过去的顺序。不做转换直接铺成 32×32，按上边一行会显示在画面中间——
   * 位置全是错的，但数值本身没问题。
   *
   * 每种产品的走线不一样，所以排列要按产品选，不能自动猜。用法：
   *
   *   Shroom.connect({ layout: 'carSeat' })
   *   Shroom.decodeFrame(payload, { layout: 'carSeat' })
   *
   * 有几点要先说清楚：
   *
   * 1. 排列会决定输出的行列。比如 car10 是从 1024 个扫描点里取 10×10 那一块，
   *    所以 frame.rows / frame.cols 是 10，不是 32——不用自己再传 rows / cols。
   * 2. 这里**只做位置搬运，不改数值**。正式上位机在某些产品上还会跑坏点插值、
   *    空行填补、压力换算，那些属于数值处理，不在公开 SDK 的范围里，
   *    所以同一帧数据这里的数字和正式上位机可能对不上，位置是对的。
   * 3. 个别产品有「无传感器」的空位（比如 carCol 中间那一列），排列表里记成 -1，
   *    解出来固定是 0。
   * 4. 手套类产品的线序不在这里，找官方技术人员要。
   * 5. 大多数产品一帧是 1024 个扫描点，少数是 256 个（小样垫、触觉足底）。
   *    排列自己知道要几个点，`scan` 字段记着，调用方不用管。
   */

  /** 32×32 是采集板最常见的扫描矩阵，绝大多数排列都从它出发 */
  const SCAN = 32;
  const SCAN_SIZE = SCAN * SCAN;

  /** 16×16 的小包：小样垫、触觉足底这类一帧只有 256 个点 */
  const SCAN_SIZE_256 = 256;

  /** 一张「还没动过」的下标表：seed()[i] === i */
  function seed(size = SCAN_SIZE) {
    const a = new Array(size);
    for (let i = 0; i < size; i += 1) a[i] = i;
    return a;
  }

  // ------------------------------------------------------------------ 通用工具
  // 下面这几个和正式上位机里的同名函数是一一对应的，只是这里搬的是下标不是数值。

  /** 逆时针旋转 90°（方阵） */
  function rotate90(a, side) {
    const out = new Array(side * side);
    for (let i = 0; i < side; i += 1) {
      for (let j = 0; j < side; j += 1) {
        out[(side - 1 - j) * side + i] = a[i * side + j];
      }
    }
    return out;
  }

  /** 顺时针旋转 90°（方阵） */
  function rotate90cw(a, side) {
    const out = new Array(side * side);
    for (let i = 0; i < side; i += 1) {
      for (let j = 0; j < side; j += 1) {
        out[j * side + (side - 1 - i)] = a[i * side + j];
      }
    }
    return out;
  }

  /** 每行左右翻转 */
  function flipX(a, rows, cols) {
    const out = a.slice();
    for (let i = 0; i < rows; i += 1) {
      for (let j = 0; j < cols >> 1; j += 1) {
        const p = i * cols + j;
        const q = i * cols + cols - 1 - j;
        const t = out[p];
        out[p] = out[q];
        out[q] = t;
      }
    }
    return out;
  }

  /** 上下翻转（整行对调） */
  function flipY(a, rows, cols) {
    const out = a.slice();
    for (let i = 0; i < rows >> 1; i += 1) {
      for (let j = 0; j < cols; j += 1) {
        const p = i * cols + j;
        const q = (rows - 1 - i) * cols + j;
        const t = out[p];
        out[p] = out[q];
        out[q] = t;
      }
    }
    return out;
  }

  /** 每行把 [from, to] 这一段列前后倒过来 */
  function reverseCols(a, rows, cols, from, to) {
    const out = a.slice();
    for (let i = 0; i < rows; i += 1) {
      for (let p = from, q = to; p < q; p += 1, q -= 1) {
        const x = i * cols + p;
        const y = i * cols + q;
        const t = out[x];
        out[x] = out[y];
        out[y] = t;
      }
    }
    return out;
  }

  /** 交换第 r1、r2 两行 */
  function swapRows(a, cols, r1, r2) {
    for (let j = 0; j < cols; j += 1) {
      const p = r1 * cols + j;
      const q = r2 * cols + j;
      const t = a[p];
      a[p] = a[q];
      a[q] = t;
    }
  }

  /**
   * 从扫描矩阵里按行段、列段抠出一块。
   * 段写成 [起, 止]，起 > 止就是倒着取。对应上位机的 arrToRealLine。
   */
  function pick(a, rowSpans, colSpans) {
    const expand = (spans) => {
      const out = [];
      for (const [from, to] of spans) {
        if (from > to) for (let i = from; i >= to; i -= 1) out.push(i);
        else for (let i = from; i <= to; i += 1) out.push(i);
      }
      return out;
    };
    const rows = expand(rowSpans);
    const cols = expand(colSpans);
    const out = [];
    for (const r of rows) {
      for (const c of cols) out.push(a[r * SCAN + c]);
    }
    return out;
  }

  // -------------------------------------------------------------- 各产品的线序

  /** 32×32 通用压力垫（床垫 / 手部垫 / 眠枕 / 宠物垫都是这一套） */
  function jqbed(src) {
    const a = src.slice();
    for (let i = 0; i < 8; i += 1) swapRows(a, SCAN, i, 14 - i);
    const head = a.splice(0, 15 * SCAN);
    return a.concat(head);
  }

  /** 坐垫：在通用垫的基础上再左右翻一次 */
  function sitPad(src) {
    return flipX(jqbed(src), 32, 32);
  }

  /** 汽车坐垫 / 脚垫 */
  function carSeat(src) {
    const a = src.slice();
    for (let i = 0; i < 8; i += 1) swapRows(a, SCAN, i, 15 - i);
    // 第 15 列往右那 17 列，以第 23 列为轴对折
    for (let i = 0; i < SCAN; i += 1) {
      for (let j = 0; j < 8; j += 1) {
        const p = i * SCAN + j + 15;
        const q = i * SCAN + 31 - j;
        const t = a[p];
        a[p] = a[q];
        a[q] = t;
      }
    }
    return flipX(a, 32, 32);
  }

  /** 汽车靠背 */
  function carBack(src) {
    const a = src.slice();
    for (let i = 0; i < 8; i += 1) swapRows(a, SCAN, i, 14 - i);
    for (let i = 0; i < SCAN; i += 1) {
      for (let j = 0; j < 8; j += 1) {
        const p = i * SCAN + j + 15;
        const q = i * SCAN + 31 - j;
        const t = a[p];
        a[p] = a[q];
        a[q] = t;
      }
    }
    const head = a.splice(0, 15 * SCAN);
    const rolled = a.concat(head);
    return flipY(flipX(rotate90cw(rolled, SCAN), 32, 32), 32, 32);
  }

  /** 10×10 汽车坐垫：只用扫描矩阵左上角 10 行 × 右边 10 列那一块 */
  function car10(src) {
    const a = pick(src, [[0, 9]], [[22, 31]]);
    for (let i = 0; i < 2; i += 1) swapRows(a, 10, i, 4 - i);
    for (let i = 0; i < 5; i += 1) swapRows(a, 10, i, i + 5);
    return a;
  }

  /** 10×10 汽车靠背。最外一圈没有传感器，抄邻边的值补上（上位机就是这么做的） */
  function car10Back(src) {
    const a = car10(src);
    for (let i = 0; i < 10; i += 1) {
      for (let j = 0; j < 5; j += 1) {
        const p = i * 10 + j;
        const q = i * 10 + 9 - j;
        const t = a[p];
        a[p] = a[q];
        a[q] = t;
      }
    }
    for (let i = 0; i < 10; i += 1) {
      a[i * 10] = a[i * 10 + 1];
      a[i * 10 + 9] = a[i * 10 + 8];
      a[i] = a[10 + i];
    }
    return rotate90(a, 10);
  }

  /** 10×10 坐垫 */
  function sit10(src) {
    const a = pick(src, [[0, 9]], [[22, 31]]);
    for (let i = 0; i < 2; i += 1) swapRows(a, 10, i, 4 - i);
    return rotate90(a, 10);
  }

  /** 延锋 10×10 坐垫 */
  function yanfeng10(src) {
    const a = pick(src, [[6, 15]], [[0, 9]]);
    for (let i = 0; i < 2; i += 1) swapRows(a, 10, 5 + i, 9 - i);
    return flipX(rotate90(a, 10), 10, 10);
  }

  /** 延锋 10×10 靠背 */
  function yanfeng10Back(src) {
    const a = pick(src, [[6, 15]], [[0, 9]]);
    for (let i = 0; i < 2; i += 1) swapRows(a, 10, i, 4 - i);
    return rotate90(a, 10);
  }

  /** volvo 坐垫 / 靠背共用的前半段 */
  function volvoCommon(src) {
    const a = src.slice();
    // 左半 16 列以第 7/8 列为轴对折
    for (let i = 0; i < SCAN; i += 1) {
      for (let j = 0; j < 8; j += 1) {
        const p = i * SCAN + j;
        const q = i * SCAN + 15 - j;
        const t = a[p];
        a[p] = a[q];
        a[q] = t;
      }
    }
    // 左右两个半区整体对调
    for (let i = 0; i < SCAN; i += 1) {
      for (let j = 0; j < 16; j += 1) {
        const p = i * SCAN + j;
        const q = i * SCAN + 16 + j;
        const t = a[p];
        a[p] = a[q];
        a[q] = t;
      }
    }
    for (let i = 0; i < 9; i += 1) swapRows(a, SCAN, i, 17 - i);
    return a;
  }

  /** volvo 坐垫 */
  function volvo(src) {
    return flipY(rotate90cw(volvoCommon(src), SCAN), 32, 32);
  }

  /** volvo 靠背 */
  function volvoBack(src) {
    return rotate90(volvoCommon(src), SCAN);
  }

  /** volvo 头枕 10×10 */
  function volvoHead(src) {
    const a = pick(src, [[6, 15]], [[0, 9]]);
    for (let i = 0; i < 2; i += 1) swapRows(a, 10, 5 + i, 9 - i);
    return rotate90(a, 10);
  }

  /** 长条垫 32 行 × 10 列 */
  function smallM(src) {
    const a = [];
    for (let j = 0; j < SCAN; j += 1) {
      for (let i = 22; i < SCAN; i += 1) a.push(src[i * SCAN + j]);
    }
    for (let i = 0; i < SCAN; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        const p = i * 10 + j;
        const q = i * 10 + 4 - j;
        const t = a[p];
        a[p] = a[q];
        a[q] = t;
      }
    }
    return a;
  }

  /** 方垫 16 行 × 10 列 */
  function rect(src) {
    const a = [];
    for (let i = 22; i < SCAN; i += 1) {
      for (let j = 0; j < 16; j += 1) a.push(src[i * SCAN + j]);
    }
    // 每行第 7~11 列这一段前后倒过来
    for (let i = 0; i < 10; i += 1) {
      for (let j = 7; j < 12; j += 1) {
        const p = i * 16 + j;
        const q = i * 16 + 22 - j;
        const t = a[p];
        a[p] = a[q];
        a[q] = t;
      }
    }
    const out = [];
    for (let j = 0; j < 16; j += 1) {
      for (let i = 0; i < 10; i += 1) out.push(a[i * 16 + j]);
    }
    return out;
  }

  /** 短垫 32×32：左右各自对折一次 */
  function short(src) {
    const a = src.slice();
    for (let i = 0; i < SCAN; i += 1) {
      for (let j = 16; j < 24; j += 1) {
        const p = i * SCAN + j;
        const q = i * SCAN + 47 - j;
        const t = a[p];
        a[p] = a[q];
        a[q] = t;
      }
    }
    return flipX(a, 32, 32);
  }

  /** 列式垫 16 行 × 10 列 */
  function matCol(src) {
    let a = pick(src, [[0, 15]], [[0, 9]]);
    for (let i = 0; i < 4; i += 1) swapRows(a, 10, i, 7 - i);
    const head = a.splice(0, 10 * 8);
    a = a.concat(head);
    return a;
  }

  /** 列式坐垫 32×32 */
  function sitCol(src) {
    const a = src.slice();
    // 下半 16 行前后倒过来
    for (let i = 0; i < 8; i += 1) swapRows(a, SCAN, 16 + i, 31 - i);
    // 每行前 15 列前后倒过来
    for (let i = 0; i < SCAN; i += 1) {
      for (let j = 0; j < 8; j += 1) {
        const p = i * SCAN + j;
        const q = i * SCAN + 14 - j;
        const t = a[p];
        a[p] = a[q];
        a[q] = t;
      }
    }
    return a;
  }

  /** 喜悦 32×32 */
  function xiyue(src) {
    const a = src.slice();
    for (let i = 0; i < 6; i += 1) swapRows(a, SCAN, i, 10 - i);
    return a;
  }

  /** 列式汽车垫 9 行 × 10 列，中间一列没有传感器 */
  function carCol(src) {
    const a = pick(src, [[6, 15]], [[0, 8]]);
    for (let i = 0; i < 2; i += 1) swapRows(a, 9, i, 4 - i);
    for (let i = 2; i <= 8; i += 1) a[i * 9 + 4] = -1; // 这一段没走线
    const out = [];
    for (let j = 0; j < 9; j += 1) {
      for (let i = 0; i < 10; i += 1) out.push(a[i * 9 + j]);
    }
    return out;
  }

  /** sit100 坐垫 12 行 × 6 列：右侧、左侧、中间三块拼起来 */
  function sit100(src) {
    const left = pick(src, [[0, 2]], [[1, 0]]);
    const center = pick(src, [[3, 12]], [[7, 2]]);
    const right = pick(src, [[15, 13]], [[9, 8]]);
    for (let i = 0; i < 2; i += 1) swapRows(center, 6, 5 + i, 9 - i);
    return right.concat(left, center);
  }

  /** 恩迪 23×23 坐垫 */
  function endiSit(src) {
    return pick(src, [[11, 22], [10, 0]], [[0, 22]]);
  }

  /** 沙发 16×16 */
  function sofa(src) {
    return pick(src, [[0, 15]], [[7, 0], [8, 15]]);
  }

  /** 手部单点垫 32×32：以第 15 行为界上下两块前后调换 */
  function handSinglePoint(src) {
    const out = [];
    for (let r = 15; r <= 30; r += 1) {
      for (let c = 0; c < SCAN; c += 1) out.push(src[r * SCAN + c]);
    }
    for (let r = 14; r >= 0; r -= 1) {
      for (let c = 0; c < SCAN; c += 1) out.push(src[r * SCAN + c]);
    }
    for (let c = 0; c < SCAN; c += 1) out.push(src[31 * SCAN + c]);
    return out;
  }

  /** 整椅：坐垫、靠背、头枕共用的开头——取扫描矩阵左上 16×16，再把每行右半段倒过来 */
  function wholeChairCommon(src) {
    return reverseCols(pick(src, [[0, 15]], [[0, 15]]), 16, 16, 8, 15);
  }

  /** 整椅坐垫 16×16 */
  function wholeChairSit(src) {
    return rotate90(wholeChairCommon(src), 16);
  }

  /** 整椅靠背 16×16 */
  function wholeChairBack(src) {
    return flipY(rotate90(flipY(wholeChairCommon(src), 16, 16), 16), 16, 16);
  }

  /** 整椅头枕 10×10：取扫描矩阵第 6~15 行、左边 10 列那一块 */
  function wholeChairHead(src) {
    const a = reverseCols(pick(src, [[6, 15]], [[0, 9]]), 10, 10, 5, 9);
    return flipY(rotate90cw(flipX(a, 10, 10), 10), 10, 10);
  }

  /**
   * 温度全床 12 行 × 15 列。
   * 走线和通用压力垫一样，但只有中间这一块装了压力点，两侧和第 20 列是留给温度的。
   * 温度那三个点不在这里——排列只管压力矩阵的位置。
   */
  function tempFullBed(src) {
    return pick(jqbed(src), [[20, 31]], [[13, 19], [21, 28]]);
  }

  /** 小样垫 10×10：一帧 256 个点，纯查表 */
  const SMALL_SAMPLE_TABLE = [
    223, 222, 221, 220, 219, 218, 217, 216, 215, 214,
    239, 238, 237, 236, 235, 234, 233, 232, 231, 230,
    255, 254, 253, 252, 251, 250, 249, 248, 247, 246,
    15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
    31, 30, 29, 28, 27, 26, 25, 24, 23, 22,
    207, 206, 205, 204, 203, 202, 201, 200, 199, 198,
    191, 190, 189, 188, 187, 186, 185, 184, 183, 182,
    175, 174, 173, 172, 171, 170, 169, 168, 167, 166,
    159, 158, 157, 156, 155, 154, 153, 152, 151, 150,
    143, 142, 141, 140, 139, 138, 137, 136, 135, 134,
  ];

  function smallSample(src) {
    return SMALL_SAMPLE_TABLE.map((i) => src[i]);
  }

  /**
   * 触觉足底 10 行 × 6 列，一帧 256 个点，纯查表。
   * 正式上位机还会把这 60 个点散到一张脚型轮廓上再插值，那是画法不是线序，这里不做。
   */
  const FOOT_INSOLE_TABLE = [
    224, 208, 192, 176, 160, 144, 223, 207, 191, 175, 159, 143,
    222, 206, 190, 174, 158, 142, 221, 205, 189, 173, 157, 141,
    220, 204, 188, 172, 156, 140, 219, 203, 187, 171, 155, 139,
    218, 202, 186, 170, 154, 138, 217, 201, 185, 169, 153, 137,
    216, 200, 184, 168, 152, 136, 215, 199, 183, 167, 151, 135,
  ];

  function footInsole(src) {
    return FOOT_INSOLE_TABLE.map((i) => src[i - 1]);
  }

  // ------------------------------------------------------------------ 排列注册表

  /**
   * name: { rows, cols, label, build, scan? }
   * label 是给界面下拉框用的，SDK 本身不依赖它。
   * label 里不写尺寸——同名不同尺寸的产品（比如两种汽车坐垫）靠界面另外显示的行列区分。
   * scan 是这一帧有多少个扫描点，不写就是 1024。
   */
  const LAYOUTS = {
    mat32: { rows: 32, cols: 32, label: '通用压力垫', build: jqbed },
    sit: { rows: 32, cols: 32, label: '坐垫', build: sitPad },
    bed1: { rows: 32, cols: 32, label: '床垫（另一版走线）', build: jqbed },
    carSeat: { rows: 32, cols: 32, label: '汽车坐垫 / 脚垫', build: carSeat },
    carBack: { rows: 32, cols: 32, label: '汽车靠背', build: carBack },
    car10: { rows: 10, cols: 10, label: '汽车坐垫', build: car10 },
    car10Back: { rows: 10, cols: 10, label: '汽车靠背', build: car10Back },
    sit10: { rows: 10, cols: 10, label: '坐垫', build: sit10 },
    yanfeng10: { rows: 10, cols: 10, label: '延锋坐垫', build: yanfeng10 },
    yanfeng10Back: { rows: 10, cols: 10, label: '延锋靠背', build: yanfeng10Back },
    volvo: { rows: 32, cols: 32, label: 'volvo 坐垫', build: volvo },
    volvoBack: { rows: 32, cols: 32, label: 'volvo 靠背', build: volvoBack },
    volvoHead: { rows: 10, cols: 10, label: 'volvo 头枕', build: volvoHead },
    smallM: { rows: 32, cols: 10, label: '长条垫', build: smallM },
    rect: { rows: 16, cols: 10, label: '方垫', build: rect },
    short: { rows: 32, cols: 32, label: '短垫', build: short },
    matCol: { rows: 16, cols: 10, label: '列式垫', build: matCol },
    sitCol: { rows: 32, cols: 32, label: '列式坐垫', build: sitCol },
    xiyue: { rows: 32, cols: 32, label: '喜悦', build: xiyue },
    carCol: { rows: 9, cols: 10, label: '列式汽车垫', build: carCol },
    sit100: { rows: 12, cols: 6, label: 'sit100 坐垫', build: sit100 },
    endiSit: { rows: 23, cols: 23, label: '恩迪坐垫', build: endiSit },
    sofa: { rows: 16, cols: 16, label: '沙发', build: sofa },
    handSinglePoint: { rows: 32, cols: 32, label: '手部单点垫', build: handSinglePoint },
    wholeChair: { rows: 16, cols: 16, label: '整椅坐垫', build: wholeChairSit },
    wholeChairBack: { rows: 16, cols: 16, label: '整椅靠背', build: wholeChairBack },
    wholeChairHead: { rows: 10, cols: 10, label: '整椅头枕', build: wholeChairHead },
    tempFullBed: { rows: 12, cols: 15, label: '温度全床', build: tempFullBed },
    smallSample: { rows: 10, cols: 10, label: '小样垫', build: smallSample, scan: SCAN_SIZE_256 },
    footInsole: { rows: 10, cols: 6, label: '触觉足底', build: footInsole, scan: SCAN_SIZE_256 },
  };

  // 排列表只跟名字有关，算一次就够了。
  // decodeFrame 每帧都会调 getLayout，一秒上百次，不缓存就是白白分配上百个数组。
  const cache = new Map();

  /**
   * 取排列。返回 null 表示按扫描顺序原样铺（'raw' 或名字不认识时）。
   *
   * @param {string} [name] 排列名，见 LAYOUTS
   * @returns {{rows: number, cols: number, perm: Int32Array}|null}
   *          perm[显示位置] = 扫描顺序里的下标；-1 表示这个位置没有传感器
   */
  function getLayout(name) {
    if (!name || name === 'raw') return null;
    if (cache.has(name)) return cache.get(name);

    const def = LAYOUTS[name];
    if (!def) {
      cache.set(name, null);
      return null;
    }

    const built = def.build(seed(def.scan ?? SCAN_SIZE));
    const size = def.rows * def.cols;
    const layout = built && built.length === size
      ? { rows: def.rows, cols: def.cols, perm: Int32Array.from(built) }
      : null;
    cache.set(name, layout);
    return layout;
  }

  /** 列出所有排列。这是按「线序」列的，界面下拉框请用 listProducts() */
  function listLayouts() {
    return Object.keys(LAYOUTS).map((name) => ({
      name,
      label: LAYOUTS[name].label,
      rows: LAYOUTS[name].rows,
      cols: LAYOUTS[name].cols,
    }));
  }

  // ------------------------------------------------------------------ 产品菜单

  /**
   * 产品菜单：和公司桌面端「请选择传感器」那个下拉**一字不差、顺序也一样**，
   * 只去掉手套那几项（手套线序不在这个 SDK 里）。
   *
   * 上面的 LAYOUTS 是按**线序**列的，一种走线一条，名字是内部叫法
   *（`mat32`、`列式垫`、`sit100 坐垫`……）。那张表是给 decodeFrame 用的，
   * 不适合直接摆到界面上让人挑——同一种走线上跑着好几款产品，
   * 用户手里拿的是「宠物看护」，不是「通用压力垫」。
   *
   * 所以界面下拉框用这张表：**一行一个产品，名字照抄桌面端**，
   * 每个产品指向它该用哪条线序。多个产品指向同一条线序是正常的，
   * 比如手部检测 / 小床监测 / 宠物看护 走的都是 jqbed 那套走线。
   *
   * 几点说明：
   *
   * 1. `layout: 'raw'` 表示这款产品**不需要换线序**，按扫描顺序原样铺就是对的
   *    （桌面端那几个「高速」和「正常测试」就是这样，代码里没有任何变换）。
   *    这种产品在下面写死 rows / cols，省得靠点数去猜。
   * 2. 桌面端菜单里还有几项**故意没收**，收了也是灰的：
   *    - 触觉上衣（宇树 G1 / 松延 N2 / 零次方 H1）—— 一帧 260 字节，
   *      末尾 4 个字节是姿态不是压力，走的也不是这套分帧
   *    - 64*64高速 / OneStep —— 一帧 4096 字节、3 Mbaud
   *    - 小床检测(12B) —— 一帧 2048 字节的 16 位数据，帧尾也不是 AA 55 03 99
   *    - 14*20高速 —— 142 + 158 两个包拼一帧
   *    - 轮椅 —— 走线和通用垫一样，但桌面端还会把一批点**抹成 0**，
   *      那是改数值不是搬位置，收进来这里就名不副实了（见文件开头第 2 条）
   *    - 小床褥监测 —— 桌面端菜单里没有这一项，别自己加
   *    - 整椅展示 —— 桌面端那**一个**菜单项背后是坐垫 + 靠背 + 头枕三块板子、
   *      三条线序、**三个串口同时连**，画面上拼成一把椅子。这个 SDK 一次只连一个口，
   *      拆成「· 坐垫 / · 靠背 / · 头枕」三行已经不是桌面端那件事了，不符合
   *      「跟桌面端一模一样」的要求，所以整个不收。走线还在 LAYOUTS 里，
   *      谁真要单个垫子自己传 `layout` 即可。
   */
  const PRODUCTS = [
    { name: 'hand', label: '手部检测', layout: 'mat32' },
    { name: 'smallSample', label: '10*10小样', layout: 'smallSample' },
    { name: 'footVideo', label: '触觉足底', layout: 'footInsole' },
    { name: 'jqbed', label: '小床监测', layout: 'mat32' },
    { name: 'smallBedNoAlg', label: '小床检测(数据)', layout: 'mat32' },
    { name: 'tempFullBed', label: '温度全床系统', layout: 'tempFullBed' },
    { name: 'petCare', label: '宠物看护', layout: 'mat32' },
    { name: 'petCareMini', label: 'mini看护', layout: 'mat32' },
    { name: 'fast256', label: '16*16高速', layout: 'raw', rows: 16, cols: 16 },
    { name: 'fast1024', label: '32*32高速', layout: 'raw', rows: 32, cols: 32 },
    { name: 'handSinglePoint', label: '32*32(检测点)', layout: 'handSinglePoint' },
    { name: 'normal', label: '正常测试', layout: 'raw', rows: 32, cols: 32 },
    { name: 'humanBody', label: '人体全身', layout: 'raw', rows: 32, cols: 32 },
  ];

  const PRODUCT_INDEX = new Map(PRODUCTS.map((p) => [p.name, p]));

  /** 补上行列：走线序的从 LAYOUTS 取，raw 的产品自己写死了 */
  function withShape(p) {
    const def = LAYOUTS[p.layout];
    return {
      name: p.name,
      label: p.label,
      layout: p.layout,
      rows: p.rows ?? def?.rows ?? null,
      cols: p.cols ?? def?.cols ?? null,
    };
  }

  /**
   * 按产品名取一项。名字不认识返回 null。
   *
   * @param {string} name 产品名，见 PRODUCTS
   * @returns {{name: string, label: string, layout: string, rows: number|null, cols: number|null}|null}
   */
  function getProduct(name) {
    const p = PRODUCT_INDEX.get(name);
    return p ? withShape(p) : null;
  }

  /** 列出所有产品，给界面下拉框用。顺序就是桌面端菜单的顺序，别排序 */
  function listProducts() {
    return PRODUCTS.map(withShape);
  }

  // ---------- core/framer.js ----------
  /**
   * 切帧器：把串口过来的字节流切成一帧一帧。
   *
   * 协议约定（可通过 options 覆盖）：
   *   每帧以分隔符 AA 55 03 99 开头，两个分隔符之间的部分就是这一帧的数据。
   *
   * 用法：
   *   const framer = createFramer()
   *   const frames = framer.push(chunk)   // chunk 是 Uint8Array，返回本次切出的若干帧
   */

  const DEFAULT_DELIMITER = [0xaa, 0x55, 0x03, 0x99];

  /** 在 haystack 中从 from 开始找 needle，找不到返回 -1 */
  function indexOfBytes(haystack, needle, from) {
    const limit = haystack.length - needle.length;
    outer: for (let i = from; i <= limit; i += 1) {
      for (let j = 0; j < needle.length; j += 1) {
        if (haystack[i + j] !== needle[j]) continue outer;
      }
      return i;
    }
    return -1;
  }

  function concat(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  /**
   * @param {object} [options]
   * @param {number[]} [options.delimiter]  帧分隔符，默认 [0xAA,0x55,0x03,0x99]
   * @param {number}   [options.minLength]  小于这个长度的帧当作脏帧丢弃
   * @param {number}   [options.maxLength]  大于这个长度的帧当作脏帧丢弃
   * @param {boolean}  [options.lockLength] 锁定帧长，默认 true，见下面 LOCK_AFTER 处的说明
   */
  function createFramer(options = {}) {
    const delimiter = Uint8Array.from(options.delimiter ?? DEFAULT_DELIMITER);
    const minLength = options.minLength ?? 8;
    const maxLength = options.maxLength ?? 8192;
    const lockLength = options.lockLength !== false;
    // 缓冲区上限：超过就丢掉前半段，避免一直收不到分隔符时内存无限增长
    const bufferLimit = maxLength * 4;

    // 帧长锁定。分隔符只有 4 个字节，数据里迟早会撞出一个一模一样的，
    // 于是切出一个长度不对的短帧。这种帧长度多半不是完全平方数，解码时会退化成
    // 1×N 一条横线，画面就在方阵和横线之间狂闪——这不是渲染的问题，是脏帧混进来了。
    // 所以：连着几帧长度一致就把它锁死，之后长度对不上的一律当脏帧丢掉。
    // 万一锁错了（比如第一帧本身就是残的），另一个长度连着来够多次就改锁它，能自己纠回来。
    const LOCK_AFTER = 3;
    const RELOCK_AFTER = 12;
    let locked = 0;
    let runLength = 0;
    let runCount = 0;

    let buffer = new Uint8Array(0);
    let dropped = 0;

    /** 返回这一帧要不要收下 */
    function accept(len) {
      if (!lockLength) return true;
      if (len === runLength) runCount += 1;
      else {
        runLength = len;
        runCount = 1;
      }
      if (!locked) {
        if (runCount >= LOCK_AFTER) locked = len;
        return true; // 还没锁上，先全收下，免得开头几帧被白丢
      }
      if (len === locked) return true;
      if (runCount >= RELOCK_AFTER) {
        locked = len; // 锁错了，改锁这个
        return true;
      }
      return false;
    }

    function push(chunk) {
      if (!chunk || chunk.length === 0) return [];
      buffer = concat(buffer, chunk instanceof Uint8Array ? chunk : Uint8Array.from(chunk));

      const frames = [];
      let start = indexOfBytes(buffer, delimiter, 0);

      if (start < 0) {
        // 还没对上分隔符，只保留末尾几个字节（分隔符可能被切断在两个 chunk 之间）
        if (buffer.length > delimiter.length) {
          buffer = buffer.slice(buffer.length - delimiter.length + 1);
        }
        return frames;
      }

      for (;;) {
        const next = indexOfBytes(buffer, delimiter, start + delimiter.length);
        if (next < 0) break;
        const payload = buffer.slice(start + delimiter.length, next);
        if (payload.length >= minLength && payload.length <= maxLength && accept(payload.length)) {
          frames.push(payload);
        } else {
          dropped += 1;
        }
        start = next;
      }

      buffer = buffer.slice(start);
      if (buffer.length > bufferLimit) buffer = buffer.slice(-maxLength);
      return frames;
    }

    function reset() {
      buffer = new Uint8Array(0);
      dropped = 0;
      locked = 0;
      runLength = 0;
      runCount = 0;
    }

    return {
      push,
      reset,
      /** 被丢弃的脏帧数量，用来判断协议参数是不是配错了 */
      get droppedCount() {
        return dropped;
      },
      /** 锁定下来的帧长（字节）。还没锁上是 0 */
      get frameLength() {
        return locked;
      },
    };
  }

  // ---------- core/frame.js ----------
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
   *
   * 另外注意：字节的先后顺序是采集板的扫描顺序，不等于垫子上的位置。
   * 要让画面和手指位置对上，用 options.layout 选一个点位排列（见 core/layout.js）。
   */


  /** 由点数推断矩阵行列；不是完全平方数就退化成单行 */
  function resolveShape(points, options = {}) {
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
   * @param {string} [options.layout]    点位排列，'raw'（默认）或产品名，见 core/layout.js
   * @returns {object} Frame
   */
  function decodeFrame(payload, options = {}) {
    const fullScale = options.fullScale ?? 255;
    const threshold = options.threshold ?? 0.02;
    const points = Math.min(options.points ?? payload.length, payload.length);

    // 选了排列就以排列的行列为准：它知道这块垫子实际是几行几列，
    // 比如 car10 是从 1024 个扫描点里取 10×10，输出就是 10×10 而不是 32×32
    const layout = getLayout(options.layout);
    const { rows, cols } = layout ?? resolveShape(points, options);
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

    // perm 为 null 时按扫描顺序原样铺；给了排列就按排列取，
    // 这样 center / area 这些也是按垫子实际位置算的，不用调用方再修一遍。
    // perm 里的 -1 表示这个位置没有传感器，固定给 0
    const perm = layout ? layout.perm : null;

    for (let i = 0; i < size; i += 1) {
      const src = perm ? perm[i] : i;
      const v = src >= 0 && src < points ? raw[src] / fullScale : 0;
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

  // ---------- core/device.js ----------
  /**
   * 帧订阅中心：所有 device 共用这一套回调管理。
   *
   * 帧率可能到 100Hz，回调里别做重活；一个回调抛错不影响其他回调。
   */
  function createFrameHub() {
    const listeners = new Set();

    return {
      /** 订阅每一帧，返回取消订阅的函数 */
      onFrame(handler) {
        if (typeof handler !== 'function') {
          throw new TypeError('onFrame 需要传一个函数');
        }
        listeners.add(handler);
        return () => listeners.delete(handler);
      },

      emit(frame) {
        for (const handler of listeners) {
          try {
            handler(frame);
          } catch (err) {
            console.error('[shroom] onFrame 回调出错：', err);
          }
        }
      },

      clear() {
        listeners.clear();
      },

      get count() {
        return listeners.size;
      },
    };
  }

  // ---------- core/mock.js ----------
  /**
   * 模拟数据源：没有硬件的时候也能把整条链路跑通。
   *
   * 它生成的是「原始字节」，和真实串口走同一条解码路径，
   * 所以你用模拟数据写好的渲染代码，插上真设备不用改。
   */

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
  function createMockDevice(options = {}) {
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

  // ---------- backend/client.js ----------
  /** HTTP/WebSocket client adapted from E:/ShroomSDK's BackendSdkClient.
   * No serial, database or Node-only imports. Backend frames remain unchanged.
   */
  const DEFAULT_HTTP_BASE_URL = 'http://127.0.0.1:19245';
  const DEFAULT_WS_URL = 'ws://127.0.0.1:19999';
  const DEFAULT_ROUTES = Object.freeze({
    channels: '/api/channels',
    wsStatus: '/api/ws/status',
    sdkContract: '/api/sdk/contract',
    displaySystems: '/api/display-systems',
    displaySystemById: '/api/display-systems/:id',
    serialPorts: '/api/serial/ports',
    serialStatus: '/api/serial/status',
    serialOpen: '/api/serial/open',
    serialClose: '/api/serial/close',
    sensorCurrent: '/api/sensor/current',
    sensorType: '/api/sensor/type',
    collectionStart: '/api/collection/start',
    collectionStop: '/api/collection/stop',
  });

  function normalizeHttpResult(payload) {
    if (!payload || typeof payload !== 'object' || !Object.hasOwn(payload, 'code')) return payload;
    if (payload.code !== 0) throw new Error(payload.message || payload.error || `Backend error ${payload.code}`);
    return payload.data;
  }

  function backendUrl(value, protocols) {
    const url = new URL(value);
    if (!protocols.includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new TypeError(`Invalid backend URL: use ${protocols.join(' or ')} without credentials, query or fragment`);
    }
    return url.href.replace(/\/$/, '');
  }

  function backendTimeout(value) {
    if (!Number.isFinite(value) || value <= 0) throw new TypeError('timeoutMs must be a positive number');
    return value;
  }

  function backendChannels(value) {
    const channels = typeof value === 'string' ? [value] : value;
    if (!Array.isArray(channels) || channels.some((item) => typeof item !== 'string' || !item.trim())) {
      throw new TypeError('channels must be a string or an array of non-empty strings');
    }
    return [...new Set(channels)];
  }

  class BackendSdkClient {
    constructor({
      httpBaseUrl = DEFAULT_HTTP_BASE_URL, wsUrl = DEFAULT_WS_URL,
      fetchImpl = globalThis.fetch, WebSocketImpl = globalThis.WebSocket,
      contract = null, routes = {}, headers = {}, timeoutMs = 10000,
    } = {}) {
      this.httpBaseUrl = backendUrl(httpBaseUrl, ['http:', 'https:']);
      this.wsUrl = backendUrl(wsUrl, ['ws:', 'wss:']);
      this.fetchImpl = fetchImpl;
      this.WebSocketImpl = WebSocketImpl;
      this.timeoutMs = backendTimeout(timeoutMs);
      this.headers = headers;
      this.contract = contract;
      this.routeOverrides = { ...routes };
      this.routes = { ...DEFAULT_ROUTES, ...contract?.http?.routes, ...this.routeOverrides };
      this.ws = null;
      this.listeners = new Map();
      this.pendingChannels = [];
      this.connectionTimer = null;
    }

    // A small browser-safe emitter. Unlike node:events, an unhandled 'error'
    // does not crash the process. Applications should still listen for errors.
    on(event, handler) {
      if (typeof handler !== 'function') throw new TypeError('event handler must be a function');
      if (!this.listeners.has(event)) this.listeners.set(event, new Set());
      this.listeners.get(event).add(handler);
      return this;
    }

    off(event, handler) {
      for (const listener of this.listeners.get(event) || []) {
        if (listener === handler || listener.original === handler) this.listeners.get(event).delete(listener);
      }
      return this;
    }

    once(event, handler) {
      if (typeof handler !== 'function') throw new TypeError('event handler must be a function');
      const once = (...args) => { this.off(event, once); handler(...args); };
      once.original = handler;
      return this.on(event, once);
    }

    removeAllListeners(event) {
      if (event === undefined) this.listeners.clear();
      else this.listeners.delete(event);
      return this;
    }

    emit(event, ...args) {
      for (const handler of [...(this.listeners.get(event) || [])]) handler(...args);
    }

    route(name, params = {}) {
      const template = this.routes[name];
      if (typeof template !== 'string') throw new Error(`Unknown backend route: ${name}`);
      return template.replace(/:([A-Za-z_][\w]*)/g, (_, key) => {
        if (params[key] == null) throw new Error(`Missing route parameter: ${key}`);
        return encodeURIComponent(params[key]);
      });
    }

    async request(routeOrName, { method = 'GET', body, query = {}, raw = false,
      routeParams, headers, signal, timeoutMs = this.timeoutMs } = {}) {
      if (typeof this.fetchImpl !== 'function') throw new Error('fetch is unavailable; use Node.js 18+ or inject fetchImpl');
      const path = routeOrName.startsWith('/') ? routeOrName : this.route(routeOrName, routeParams);
      // Routes must stay on the configured backend, including contract-provided ones.
      if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
        throw new TypeError('Backend routes must be root-relative paths');
      }
      const url = new URL(`${this.httpBaseUrl}${path}`);
      for (const [key, value] of Object.entries(query)) if (value != null) url.searchParams.set(key, String(value));
      backendTimeout(timeoutMs);
      const controller = new AbortController();
      const abort = () => controller.abort(signal.reason);
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => controller.abort(new Error('Backend HTTP request timed out')), timeoutMs);
      try {
        const requestHeaders = new Headers(this.headers);
        new Headers(headers).forEach((value, key) => requestHeaders.set(key, value));
        if (body !== undefined) requestHeaders.set('content-type', 'application/json');
        const response = await this.fetchImpl(url.href, {
          method, headers: requestHeaders, signal: controller.signal,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await response.text();
        let payload;
        try { payload = text ? JSON.parse(text) : null; }
        catch { throw new Error(response.ok ? 'Backend returned invalid JSON' : `HTTP ${response.status}: backend returned non-JSON data`); }
        if (!response.ok) throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
        const data = normalizeHttpResult(payload);
        return raw ? payload : data;
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason;
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    }

    async getContract({ refresh = false } = {}) {
      if (this.contract && !refresh) return this.contract;
      const contract = await this.request('sdkContract');
      if (!contract || typeof contract !== 'object' || Array.isArray(contract)) throw new Error('Invalid backend contract');
      this.contract = contract;
      this.routes = { ...DEFAULT_ROUTES, ...contract.http?.routes, ...this.routeOverrides };
      return contract;
    }

    getChannels() { return this.request('channels', { raw: true }); }
    getWsStatus() { return this.request('wsStatus', { raw: true }); }
    listDisplaySystems() { return this.request('displaySystems', { raw: true }); }
    getDisplaySystem(id) { return this.request('displaySystemById', { raw: true, routeParams: { id } }); }
    listSerialPorts() { return this.request('serialPorts'); }
    getSerialStatus(role) { return this.request('serialStatus', { query: { role } }); }
    getCurrentSensor() { return this.request('sensorCurrent'); }
    setSensorType(type) { return this.request('sensorType', { method: 'POST', body: { type } }); }
    openSerial({ role = 'sit', port, path, portPath } = {}) {
      const selectedPort = port || path || portPath;
      if (!selectedPort) throw new TypeError('openSerial requires a port');
      return this.request('serialOpen', { method: 'POST', body: { role, port: selectedPort } });
    }
    closeSerial({ role = 'sit' } = {}) { return this.request('serialClose', { method: 'POST', body: { role } }); }
    startCollection(options = {}) { return this.request('collectionStart', { method: 'POST', body: options }); }
    stopCollection() { return this.request('collectionStop', { method: 'POST', body: {} }); }

    connectRealtime({ channels = [], timeoutMs = this.timeoutMs, protocols } = {}) {
      const requested = backendChannels(channels);
      backendTimeout(timeoutMs);
      if (typeof this.WebSocketImpl !== 'function') throw new Error('WebSocket is unavailable; on Node.js 18/20 install ws, or inject WebSocketImpl');
      if (this.ws && this.ws.readyState <= 1) {
        if (this.ws.readyState === 1 && requested.length) this.subscribe(requested);
        else this.pendingChannels = backendChannels([...this.pendingChannels, ...requested]);
        return this.ws;
      }
      if (this.ws) this.disconnectRealtime();
      const ws = protocols === undefined ? new this.WebSocketImpl(this.wsUrl) : new this.WebSocketImpl(this.wsUrl, protocols);
      this.ws = ws;
      this.pendingChannels = requested;
      this.connectionTimer = setTimeout(() => {
        if (this.ws !== ws || ws.readyState !== 0) return;
        this.disconnectRealtime();
        this.emit('error', new Error('Backend WebSocket connection timed out'));
      }, timeoutMs);
      ws.onopen = () => {
        if (this.ws !== ws) return;
        clearTimeout(this.connectionTimer);
        // Subscribe before notifying listeners, so on('open') may safely disconnect.
        if (this.pendingChannels.length) this.subscribe(this.pendingChannels);
        this.pendingChannels = [];
        this.emit('open');
      };
      ws.onclose = (event) => {
        if (this.ws !== ws) return;
        this.releaseSocket(ws);
        this.emit('close', event);
      };
      ws.onerror = (event) => {
        if (this.ws !== ws) return;
        this.emit('error', event.error || new Error(event.message || 'Backend WebSocket connection failed'));
      };
      ws.onmessage = (event) => {
        if (this.ws === ws) this.handleRealtimeMessage(event.data);
      };
      return ws;
    }

    releaseSocket(ws) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
      this.pendingChannels = [];
      ws.onopen = ws.onclose = ws.onmessage = null;
      // ws (Node.js) may emit an error when closing during the opening handshake.
      ws.onerror = () => {};
      if (this.ws === ws) this.ws = null;
    }

    disconnectRealtime() {
      const ws = this.ws;
      if (!ws) return;
      this.releaseSocket(ws);
      if (ws.readyState < 2) ws.close();
      this.emit('close', { code: 1000, reason: 'client disconnect', wasClean: false });
    }

    sendRealtime(message) {
      if (!this.ws || this.ws.readyState !== 1) throw new Error('WebSocket is not connected');
      this.ws.send(JSON.stringify(message));
    }
    subscribe(channels) {
      this.sendRealtime({ type: this.contract?.websocket?.messageTypes?.SUBSCRIBE || 'subscribe', channels: backendChannels(channels) });
    }
    unsubscribe(channels) {
      this.sendRealtime({ type: this.contract?.websocket?.messageTypes?.UNSUBSCRIBE || 'unsubscribe', channels: backendChannels(channels) });
    }

    handleRealtimeMessage(rawMessage) {
      let message = rawMessage;
      if (typeof rawMessage === 'string') {
        try { message = JSON.parse(rawMessage); }
        catch { this.emit('raw', rawMessage); return; }
      }
      this.emit('message', message);
      if (Array.isArray(message?.frames)) {
        for (const frame of message.frames) this.emit('frame', frame);
      } else if (message && typeof message === 'object' &&
        ['channelId', 'portId', 'value'].some((key) => Object.hasOwn(message, key))) {
        this.emit('frame', message);
      }
    }
  }

  // ---------- web/heatmap.js ----------
  /**
   * 把一帧数据画到 canvas 上。三种画法：
   *
   *   dots（默认）—— Shroom 桌面端那种点阵：一片带透视的小圆点，没受力的地方是蓝色底噪，
   *                  受力的地方顶起来并变绿变黄变红。做法和桌面端 three/hand.jsx 一样，
   *                  只是那边用 THREE.Points，这里用 canvas 自己投影，省掉 Three.js 依赖。
   *   heat       —— 每个传感点一个圆斑叠加成一片，看整体压力分布。
   *   grid       —— 一个点一个方格，看原始矩阵、调试尺寸用。
   *
   * 用法：
   *   const heatmap = createHeatmap(document.querySelector('#view'))
   *   device.onFrame(frame => heatmap.render(frame))
   */

  /** heat 模式下圆斑在离屏缓冲里占多少像素。够画出渐变就行，再大只是徒增开销 */
  const CELL_PX = 10;

  // —— 点阵参数，一一对应桌面端 three/hand.jsx 里的那几个 ——
  /**
   * sitInterp：每两个传感点之间插几格。点阵比传感器矩阵密得多，靠的就是它。
   * 桌面端用 4，但它是 GPU 画的、点可以小到亚像素；这里在 canvas 里画，
   * 太密了点与点之间就没缝、糊成一张纸，看不出「点阵」，所以退一档到 3。
   */
  const INTERP = 3;
  /** sitOrder：四周补几圈边，免得最外圈的点被高斯截掉一半 */
  const ORDER = 3;
  /** carValueg：高斯模糊半径 */
  const BLUR = 2;
  /** carValuel：时间柔化系数，越大画面越黏、越不容易抖 */
  const SMOOTH = 3;
  /** 满量程的点能顶多高，按点阵宽度的比例算 */
  const RELIEF = 0.55;
  /** 相机离点阵中心多远，按点阵宽度的比例算 */
  const DIST = 2.1;
  /** 视野 45°，再乘一点放大系数让点阵基本占满画面 */
  const FOV = Math.PI / 4;
  const ZOOM = 1.4;
  /** 地面网格线的间隔（格）和往外延伸的倍数 */
  const FLOOR_STEP = INTERP * 4;
  const FLOOR_SPAN = 1.25;

  /**
   * @param {HTMLCanvasElement|string} target canvas 元素或选择器
   * @param {object} [options]
   * @param {string}          [options.mode]     'dots' | 'heat' | 'grid'，默认 'dots'
   * @param {string|Function} [options.colormap] 'jet' | 'jetWhite' | 'grey' 或自定义函数，默认 'jet'
   * @param {boolean} [options.smooth]  是否平滑，默认 true；grid 模式下 false 就是马赛克风格
   * @param {number}  [options.gain]    显示增益，默认 1；信号弱的时候调大能看清
   * @param {number}  [options.dotSize] 点/圆斑的大小倍数，默认 1
   * @param {number}  [options.relief]  点阵起伏高度倍数，默认 1；给 0 就是平的俯视点阵
   * @param {number}  [options.tilt]    俯视角（度），默认 70。越大越像正俯视、方阵看着越方
   * @param {boolean} [options.flipY]   数据第一行画在近处（画面下方），默认 true。
   *                                    按下面却是上面鼓起来，就把它设成 false
   * @param {string}  [options.background] heat / grid 模式的底色，默认透明（露出 canvas 自己的底色）。
   *                                    Shroom 桌面端热力图铺的是 '#666'，想一模一样就传它
   */
  function createHeatmap(target, options = {}) {
    const canvas = typeof target === 'string' ? document.querySelector(target) : target;
    if (!canvas || canvas.tagName !== 'CANVAS') {
      throw new Error('createHeatmap 需要一个 <canvas> 元素');
    }

    const ctx = canvas.getContext('2d');
    let colormap = getColormap(options.colormap);
    let mode = normalizeMode(options.mode);
    let smooth = options.smooth !== false;
    let gain = options.gain ?? 1;
    let dotSize = options.dotSize ?? 1;
    let relief = options.relief ?? 1;
    // 0° 是完全平视（什么也看不见），90° 是正俯视（没有透视），两头都留出余量。
    // 默认 70°：方阵看过去基本还是方的，同时还留得住起伏
    let tilt = Math.min(89, Math.max(5, options.tilt ?? 70));
    let flipY = options.flipY !== false;
    let background = options.background ?? null;

    function normalizeMode(m) {
      return m === 'grid' ? 'grid' : m === 'heat' ? 'heat' : 'dots';
    }

    // 离屏缓冲：heat / grid 用，尺寸跟着数据的 rows/cols 走，变了才重建
    let buffer = null;
    let bufferCtx = null;
    let image = null; // grid 模式用
    let bufRows = 0;
    let bufCols = 0;

    // 颜色查找表：把 0~255 的强度直接映射成颜色，省得每像素调一次 colormap
    let lut = null;

    function buildLut() {
      lut = new Uint8Array(256 * 3);
      for (let i = 0; i < 256; i += 1) {
        const [r, g, b] = colormap(i / 255);
        lut[i * 3] = r;
        lut[i * 3 + 1] = g;
        lut[i * 3 + 2] = b;
      }
    }
    buildLut();

    // ---------------------------------------------------------------- 点阵

    // 点阵的三块缓冲：散点 → 模糊 → 时间柔化。尺寸变了才重建，柔化那块要保留跨帧的值
    let latRows = 0;
    let latCols = 0;
    let bigW = 0;
    let bigH = 0;
    let scatter = null;
    let blurred = null;
    let tmp = null;
    let held = null;
    // 高斯核。二维高斯是可分离的，拆成横竖两趟，结果和桌面端那个双重循环版本一样，但快得多
    let kernel = null;
    let kernelR = 0;
    // 画布像素缓冲：所有东西（背景、地面线、点）都直接写进这块，最后一次 putImageData
    let screen = null;
    let screenW = 0;
    let screenH = 0;

    function buildKernel() {
      kernelR = Math.ceil(BLUR * 2.57);
      kernel = new Float32Array(kernelR * 2 + 1);
      let sum = 0;
      for (let i = -kernelR; i <= kernelR; i += 1) {
        const w = Math.exp(-(i * i) / (2 * BLUR * BLUR));
        kernel[i + kernelR] = w;
        sum += w;
      }
      for (let i = 0; i < kernel.length; i += 1) kernel[i] /= sum;
    }
    buildKernel();

    function ensureLattice(rows, cols) {
      if (latRows === rows && latCols === cols) return;
      latRows = rows;
      latCols = cols;
      bigW = cols * INTERP + ORDER * 2;
      bigH = rows * INTERP + ORDER * 2;
      const n = bigW * bigH;
      scatter = new Float32Array(n);
      blurred = new Float32Array(n);
      tmp = new Float32Array(n);
      held = new Float32Array(n);
    }

    function ensureScreen() {
      if (screen && screenW === canvas.width && screenH === canvas.height) return;
      screenW = canvas.width;
      screenH = canvas.height;
      screen = ctx.createImageData(screenW, screenH);
    }

    /**
     * 散点：把每个传感点甩到大格子中间那一格，其余留空。
     * 桌面端的 interp() 就是这么干的——它不做插值，空隙全靠后面的高斯摊开。
     * 乘 INTERP² 是为了让摊开之后的整体亮度和原来一致（脉冲阵列卷高斯的能量守恒）。
     */
    function fillScatter(values, rows, cols) {
      scatter.fill(0);
      const half = INTERP >> 1;
      const amp = INTERP * INTERP;
      for (let y = 0; y < rows; y += 1) {
        // flipY：数据第一行画在靠近视点的那一边（画面下方）。
        // 按了下面却是上面鼓起来，就是这里前后反了，把 flipY 关掉即可
        const sy = flipY ? rows - 1 - y : y;
        const by = ORDER + sy * INTERP + half;
        for (let x = 0; x < cols; x += 1) {
          let v = values[y * cols + x] * gain;
          if (v > 1) v = 1;
          else if (v < 0) v = 0;
          scatter[by * bigW + ORDER + x * INTERP + half] = v * amp;
        }
      }
    }

    /** 可分离高斯，边缘按最近的一格补（和桌面端 gaussBlur_1 的 clamp 一致） */
    function blur() {
      for (let y = 0; y < bigH; y += 1) {
        const row = y * bigW;
        for (let x = 0; x < bigW; x += 1) {
          let v = 0;
          for (let k = -kernelR; k <= kernelR; k += 1) {
            let sx = x + k;
            if (sx < 0) sx = 0;
            else if (sx >= bigW) sx = bigW - 1;
            v += scatter[row + sx] * kernel[k + kernelR];
          }
          tmp[row + x] = v;
        }
      }
      for (let y = 0; y < bigH; y += 1) {
        for (let x = 0; x < bigW; x += 1) {
          let v = 0;
          for (let k = -kernelR; k <= kernelR; k += 1) {
            let sy = y + k;
            if (sy < 0) sy = 0;
            else if (sy >= bigH) sy = bigH - 1;
            v += tmp[sy * bigW + x] * kernel[k + kernelR];
          }
          blurred[y * bigW + x] = v;
        }
      }
    }

    function putPixel(d, x, y, r, g, b) {
      if (x < 0 || y < 0 || x >= screenW || y >= screenH) return;
      const p = (y * screenW + x) * 4;
      d[p] = r;
      d[p + 1] = g;
      d[p + 2] = b;
      d[p + 3] = 255;
    }

    /** 画直线用的最朴素做法：按较长的那条边等分推进。地面网格线才几十条，够用了 */
    function drawLine(d, x0, y0, x1, y1, r, g, b) {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const steps = Math.max(Math.abs(dx), Math.abs(dy)) | 0;
      if (steps <= 0 || steps > 8192) return; // 退化的线和投影炸掉的线都直接跳过
      const stepX = dx / steps;
      const stepY = dy / steps;
      let x = x0;
      let y = y0;
      for (let i = 0; i <= steps; i += 1) {
        putPixel(d, x | 0, y | 0, r, g, b);
        x += stepX;
        y += stepY;
      }
    }

    /**
     * 点阵主体。整条链路和桌面端一样：
     * 散点 → 高斯摊开 → 逐点时间柔化 → 按值定高度、按值取颜色，然后透视投影画出来。
     * 关键是**每个格点都画**，包括没受力的——它们是 jet 的最低档，正好是纯蓝，
     * 那片蓝色底噪就是桌面端点阵的样子。
     */
    function drawLattice(values, rows, cols) {
      ensureLattice(rows, cols);
      ensureScreen();
      fillScatter(values, rows, cols);
      blur();

      // 背景：和页面里 canvas 的底色对上，免得边上有一圈色差
      const d = screen.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 13;
        d[i + 1] = 17;
        d[i + 2] = 23;
        d[i + 3] = 255;
      }

      // 相机：架在点阵斜上方看向中心。这些量都按点阵宽度取比例，换多大的矩阵构图都一样。
      // tilt 就是俯视角：越接近 90° 越像正俯视、方阵看着越方，但起伏也越看不出来
      const span = Math.max(bigW, bigH);
      const len = span * DIST;
      const rad = (tilt * Math.PI) / 180;
      const camH = len * Math.sin(rad);
      const camD = len * Math.cos(rad);
      const upY = camD / len;
      const upZ = -camH / len;
      // 焦距按画布短边算，画布不是正方形的时候点阵也不会被切掉
      const focal = (Math.min(screenW, screenH) / 2 / Math.tan(FOV / 2)) * ZOOM;
      const cx = screenW / 2;
      const cy = screenH / 2;
      // 起伏高度就是实打实的世界坐标高度，不随视角补偿。
      // （试过按 1/cos(tilt) 补：视角一陡补偿系数就爆掉，峰顶被顶得比点阵还宽，
      //   整片脱离底面飞到画面上方去了。视角陡本来就该看不出起伏，这是实话。）
      const height = span * RELIEF * relief;

      // 投影一个世界坐标点。返回 null 表示它在相机后面，不用画
      function project(wx, wy, wz) {
        const py = wy - camH;
        const pz = wz - camD;
        const ez = -(py * camH + pz * camD) / len;
        if (ez < 1) return null;
        const ey = py * upY + pz * upZ;
        const inv = focal / ez;
        return { x: cx + wx * inv, y: cy - ey * inv, s: inv };
      }

      // 地面网格：铺在 y=0 上、比点阵大一圈，露在点阵外面的那部分就是画面里的地平网格。
      // 只是个参照物，线要稀、要暗——太密太亮的话，近处那几十条横线会连成一片纹理，
      // 反过来盖过点阵本身（这就是「下面出现很多条纹」的来源）
      const reach = (span * FLOOR_SPAN) / 2;
      for (let t = -reach; t <= reach + 0.001; t += FLOOR_STEP) {
        const a = project(t, 0, -reach);
        const b = project(t, 0, reach);
        if (a && b) drawLine(d, a.x, a.y, b.x, b.y, 24, 30, 40);
        const c = project(-reach, 0, t);
        const e = project(reach, 0, t);
        if (c && e) drawLine(d, c.x, c.y, e.x, e.y, 24, 30, 40);
      }

      // 逐点画。iy 从 0 开始就是从最远的一排往近处画，近处的点自然盖住远处的，
      // 不用另外排序（画家算法）
      const offX = (bigW - 1) / 2;
      const offZ = (bigH - 1) / 2;
      for (let iy = 0; iy < bigH; iy += 1) {
        // 点的大小按**这一排地面**的深度算，和点自己的高度无关。
        // 要是跟着高度走，点一被顶起来就离相机近一点、算出来的大小在 1px 和 2px 之间来回翻，
        // 上万个点各翻各的，看过去就是满屏闪。钉死在每排一个值，画面立刻就稳了
        const rowEz = -(-camH * camH + (iy - offZ - camD) * camD) / len;
        let size = Math.round((focal / rowEz) * 0.5 * dotSize);
        if (size < 2) size = 2; // 1px 的点太容易被亚像素抖动甩来甩去
        else if (size > 8) size = 8;

        for (let ix = 0; ix < bigW; ix += 1) {
          const l = iy * bigW + ix;
          // 时间柔化：新值只往里掺一部分，画面就不会随噪声一帧一跳
          held[l] += (blurred[l] - held[l]) / SMOOTH;
          let v = held[l];
          if (v > 1) v = 1;
          else if (v < 0) v = 0;

          const p = project(ix - offX, v * height, iy - offZ);
          if (!p) continue;

          const c = ((v * 255) | 0) * 3;
          const r = lut[c];
          const g = lut[c + 1];
          const b = lut[c + 2];
          const x0 = (p.x - size / 2) | 0;
          const y0 = (p.y - size / 2) | 0;
          for (let yy = 0; yy < size; yy += 1) {
            for (let xx = 0; xx < size; xx += 1) putPixel(d, x0 + xx, y0 + yy, r, g, b);
          }
        }
      }

      ctx.putImageData(screen, 0, 0);
    }

    // ------------------------------------------------------------ heat / grid

    // 圆斑图章：中心不透明、边缘透明的黑色圆。画的时候用 globalAlpha 控制强弱，
    // 所以这张图只需要做一次，尺寸变了才重做。
    let stamp = null;
    let stampRadius = 0;

    function ensureStamp(radius) {
      if (stamp && stampRadius === radius) return;
      stampRadius = radius;
      stamp = document.createElement('canvas');
      stamp.width = radius * 2;
      stamp.height = radius * 2;
      const sc = stamp.getContext('2d');
      const grad = sc.createRadialGradient(radius, radius, 0, radius, radius, radius);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      sc.fillStyle = grad;
      sc.fillRect(0, 0, radius * 2, radius * 2);
    }

    function ensureBuffer(rows, cols) {
      const w = mode === 'heat' ? cols * CELL_PX : cols;
      const h = mode === 'heat' ? rows * CELL_PX : rows;
      if (buffer && bufRows === rows && bufCols === cols && buffer.width === w) return;
      buffer = document.createElement('canvas');
      buffer.width = w;
      buffer.height = h;
      // heat 模式每帧都要读回像素，标上这个标志浏览器才不会走 GPU 往返的慢路径
      bufferCtx = buffer.getContext('2d', { willReadFrequently: mode === 'heat' });
      image = mode === 'grid' ? bufferCtx.createImageData(cols, rows) : null;
      bufRows = rows;
      bufCols = cols;
    }

    /** grid：一个点一个像素 */
    function drawGrid(values, rows, cols) {
      const data = image.data;
      for (let i = 0; i < rows * cols; i += 1) {
        let v = values[i] * gain;
        if (v > 1) v = 1;
        const idx = (v * 255) | 0;
        const p = i * 4;
        data[p] = lut[idx * 3];
        data[p + 1] = lut[idx * 3 + 1];
        data[p + 2] = lut[idx * 3 + 2];
        data[p + 3] = 255;
      }
      bufferCtx.putImageData(image, 0, 0);
    }

    /** heat：每个点盖一个圆斑，叠加出来的**透明度**就是这一片的压力强度，最后按透明度上色 */
    function drawHeat(values, rows, cols) {
      const radius = Math.max(2, Math.round(CELL_PX * 1.1 * dotSize));
      ensureStamp(radius);

      const w = buffer.width;
      const h = buffer.height;
      bufferCtx.clearRect(0, 0, w, h);

      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          let v = values[y * cols + x] * gain;
          if (v > 1) v = 1;
          if (v <= 0.01) continue; // 太弱的点不画，省一大半开销
          bufferCtx.globalAlpha = v;
          bufferCtx.drawImage(stamp, (x + 0.5) * CELL_PX - radius, (y + 0.5) * CELL_PX - radius);
        }
      }
      bufferCtx.globalAlpha = 1;

      // 按叠加出来的 alpha 上色；alpha 原样保留，所以弱的地方自然淡出
      const img = bufferCtx.getImageData(0, 0, w, h);
      const dd = img.data;
      for (let i = 0; i < dd.length; i += 4) {
        const a = dd[i + 3];
        if (a === 0) continue;
        const p = a * 3;
        dd[i] = lut[p];
        dd[i + 1] = lut[p + 1];
        dd[i + 2] = lut[p + 2];
      }
      bufferCtx.putImageData(img, 0, 0);
    }

    // ---------------------------------------------------------------- 公共

    /** 按容器大小和屏幕像素比调整画布分辨率，避免高分屏发虚 */
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || canvas.width;
      const h = canvas.clientHeight || canvas.height;
      const nw = Math.max(1, Math.round(w * dpr));
      const nh = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== nw || canvas.height !== nh) {
        canvas.width = nw;
        canvas.height = nh;
      }
    }

    function draw(frame) {
      const { values, rows, cols } = frame;
      resize();

      if (mode === 'dots') {
        drawLattice(values, rows, cols);
        return;
      }

      ensureBuffer(rows, cols);
      if (mode === 'heat') drawHeat(values, rows, cols);
      else drawGrid(values, rows, cols);

      ctx.imageSmoothingEnabled = smooth;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 圆斑是带透明度的，底下垫一层色才有桌面端那种「灰底上浮着一片热区」的观感
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
    }

    // 数据来得比屏幕刷得快：串口 1000000 波特下一秒能来上百帧，屏幕才 60 帧。
    // 每来一帧就重画一次，多画的那些一帧都显示不出来，白烧 CPU；更麻烦的是时间柔化
    // 也跟着跑上百次，数据一快一慢柔化力度就跟着变，画面就不稳。
    // 所以只记下最新的一帧，一个刷新周期画一次——柔化节奏固定，画面也就稳了。
    let pending = null;
    let rafId = 0;

    /** @param {object} frame decodeFrame 出来的 Frame */
    function render(frame) {
      if (!frame || !frame.values) return;
      pending = frame;
      // 没有 rAF 的环境（Node 里跑测试、离屏渲染）就直接画，行为不变
      if (typeof requestAnimationFrame !== 'function') {
        pending = null;
        draw(frame);
        return;
      }
      if (rafId) return; // 已经排上队了，等它那次把最新的一帧画出来
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const next = pending;
        pending = null;
        if (next) draw(next);
      });
    }

    return {
      render,
      resize,
      /** 运行中换画法 / 配色 / 平滑 / 增益 */
      setOptions(next = {}) {
        if (next.mode !== undefined) {
          const wanted = normalizeMode(next.mode);
          if (wanted !== mode) {
            mode = wanted;
            buffer = null; // 几种模式缓冲尺寸不一样，强制重建
            if (held) held.fill(0); // 换回点阵时别把上一次的余温带进来
          }
        }
        if (next.colormap !== undefined) {
          colormap = getColormap(next.colormap);
          buildLut();
        }
        if (next.smooth !== undefined) smooth = next.smooth !== false;
        if (next.gain !== undefined) gain = next.gain;
        if (next.dotSize !== undefined) dotSize = next.dotSize;
        if (next.relief !== undefined) relief = next.relief;
        if (next.tilt !== undefined) tilt = Math.min(89, Math.max(5, next.tilt));
        if (next.flipY !== undefined) flipY = next.flipY !== false;
        if (next.background !== undefined) background = next.background || null;
      },
      clear() {
        // 断开之后别让排着队的那一帧再画出来，否则清完画面又闪一下
        if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
        rafId = 0;
        pending = null;
        if (held) held.fill(0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      },
      get canvas() {
        return canvas;
      },
    };
  }

  // ---------- web/serial.js ----------
  /**
   * 浏览器串口：基于 Web Serial API，不用装任何驱动或客户端。
   *
   * 限制（浏览器规定的，绕不过去）：
   *   1. 只有 Chrome / Edge 支持，Safari 和 Firefox 没有；
   *   2. 页面必须是 https 或 localhost；
   *   3. 必须由用户点击触发，不能页面一加载就自动连。
   * 这三条任意一条不满足，就用 createMockDevice() 先跑通界面。
   */

  /** 当前环境能不能用浏览器串口 */
  function isSerialSupported() {
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
  async function connectSerial(options = {}) {
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

  // ---------- 对外入口 ----------
  var Shroom = {
    BackendSdkClient: BackendSdkClient,
    connect: connectSerial,
    mock: createMockDevice,
    createHeatmap: createHeatmap,
    isSupported: isSerialSupported,
    version: "0.1.0",
    // 想自己接数据源（WebSocket、蓝牙、录制回放）就用这几个
    createFramer: createFramer,
    decodeFrame: decodeFrame,
    resolveShape: resolveShape,
    getLayout: getLayout,
    listLayouts: listLayouts,
    LAYOUTS: LAYOUTS,
    getProduct: getProduct,
    listProducts: listProducts,
    PRODUCTS: PRODUCTS,
    getColormap: getColormap,
    DEFAULT_DELIMITER: DEFAULT_DELIMITER,
  };

  global.Shroom = Shroom;
})(typeof globalThis !== 'undefined' ? globalThis : window);
