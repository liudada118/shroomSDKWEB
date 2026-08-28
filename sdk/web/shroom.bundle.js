/**
 * Shroom SDK 0.2.0-preview.1 —— 单文件版（自动生成，别手改）
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

  const COLORMAPS = { jet, jetWhite, grey };

  /** 按名字取调色板，取不到就回退到 jet */
  function getColormap(name) {
    if (typeof name === 'function') return name;
    return COLORMAPS[name] ?? jet;
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
   * @returns {object} Frame
   */
  function decodeFrame(payload, options = {}) {
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
    connect: connectSerial,
    mock: createMockDevice,
    createHeatmap: createHeatmap,
    isSupported: isSerialSupported,
    version: "0.2.0-preview.1",
    // 想自己接数据源（WebSocket、蓝牙、录制回放）就用这几个
    createFramer: createFramer,
    decodeFrame: decodeFrame,
    resolveShape: resolveShape,
    getColormap: getColormap,
    DEFAULT_DELIMITER: DEFAULT_DELIMITER,
  };

  global.Shroom = Shroom;
})(typeof globalThis !== 'undefined' ? globalThis : window);
