# Shroom SDK · AI 上下文

> **这份文件是给 AI 读的。** 你（AI）拿到它之后，就掌握了这个 SDK 的全部能力边界和
> 正确用法，可以直接按用户的需求写代码，不需要再去翻源码。
>
> 人类用户：把这个文件整个丢给 AI，然后描述你想做的东西就行。

---

## 0. 一句话

Shroom SDK 把一块压力传感器阵列接进 JS：**连上串口 → 每秒几十上百次拿到一个数值矩阵 → 画成图**。

它**只做这三件事**。曲线、回放、报表、手势识别、算法、数据库——**一律不在 SDK 里**，
那些正是你要帮用户写的部分。

**不要**去 SDK 里找这些东西，它们不存在：
标定、kPa/N 等物理单位换算、滤波器、峰值检测、手势分类、录制回放、
多设备管理、蓝牙、WiFi、云端上传、UI 组件库。

---

## 1. 能力边界（先读这段，能省掉一半错误）

| 你想要的 | SDK 里有吗 | 怎么办 |
| --- | --- | --- |
| 连接串口拿数据 | ✅ 有 | `Shroom.connect()` |
| 没硬件也能开发 | ✅ 有 | `Shroom.mock()`，接口完全一样 |
| 画成热力图 / 点阵 | ✅ 有 | `Shroom.createHeatmap()` |
| 压力重心、受力面积、最大值 | ✅ 有 | 每帧算好了，直接读 `frame.center` / `frame.area` / `frame.max` |
| 换算成 kPa / 牛顿 | ❌ 没有 | **做不到**，见 §3 的警告 |
| 曲线图 / 折线图 | ❌ 没有 | 你自己攒 `frame.max` 进数组，用 Chart.js / canvas 画 |
| 录制与回放 | ❌ 没有 | 你自己把 `frame.raw` 存下来，回放时再 `decodeFrame()` |
| 手势识别 / 姿态分类 | ❌ 没有 | 你自己在 `onFrame` 里写逻辑 |
| 滤波、去噪 | ❌ 没有 | 你自己对 `frame.values` 处理（SDK 只在**显示**时做了柔化，数据是原始的） |

---

## 2. 三十秒上手

浏览器（最常见）：

```js
import { Shroom } from './sdk/web/index.js';

const heatmap = Shroom.createHeatmap('#view');       // #view 是一个 <canvas>

document.querySelector('#btn').onclick = async () => {
  const device = await Shroom.connect();             // ⚠️ 必须在点击回调里
  device.onFrame((frame) => heatmap.render(frame));
};
```

Node / Electron：

```js
import { Shroom } from './sdk/node/index.js';        // 需要先 npm i serialport

const device = await Shroom.connect({ path: 'COM3' });
device.onFrame((frame) => console.log(Shroom.renderAscii(frame)));
```

没有硬件时把 `Shroom.connect(...)` 换成 `Shroom.mock({ rows: 32, cols: 32, fps: 30 })`，
**其余代码一个字都不用改**。写新功能时建议一律先用 mock 调通。

---

## 3. Frame：唯一的数据结构

不管数据从哪来（浏览器串口 / Node 串口 / 模拟），`onFrame` 拿到的都是这个：

```ts
interface Frame {
  raw: Uint8Array;        // 原始 ADC 值 0~255，一个点一个字节，长度 = 实际收到的点数
  values: Float32Array;   // 归一化 0~1，长度 = rows * cols  ← 你几乎只用这个
  rows: number;           // 矩阵行数
  cols: number;           // 矩阵列数
  min: number;            // values 的最小值
  max: number;            // values 的最大值   ← 「按得多重」通常看它
  avg: number;            // values 的平均值
  area: number;           // 超过阈值(默认 0.02)的点数 ← 「接触面积有多大」看它
  center: { x: number; y: number };  // 压力重心，x/y 都是 0~1，没受力时是 {0.5, 0.5}
  timestamp: number;      // Date.now() 毫秒
}
```

按行列取某个点：

```js
const v = frame.values[y * frame.cols + x];   // 0~1
```

> ### ⚠️ 关于单位：`values` 是相对值，不是物理量
>
> `values` 是 ADC 读数除以满量程得到的 **0~1 相对值**。它**不是** kPa、不是牛顿、不是克。
>
> 要换算成物理单位需要每一台设备各自的标定曲线（传感器是非线性的，且逐片有差异），
> 这些数据**不在这个 SDK 里，也不会在**。
>
> 所以：
> - ✅ 可以说「压力 0.72」「比刚才重了」「重心往左移了」
> - ❌ **不要**在 UI 上写 kPa / N / kg，**不要**自己编一个系数去乘
> - 如果用户明确要物理单位，告诉他需要找设备厂商拿标定数据，这是 SDK 之外的事

`raw` 和 `values` 的长度可能不一致：`raw` 是实际收到的字节数，
`values` 长度恒为 `rows * cols`，不够的位置补 0。日常用 `values` 就行。

---

## 4. 完整 API

### 4.1 浏览器入口 `sdk/web/index.js`

```js
Shroom.connect(options?)              // → Promise<Device>，必须在用户手势里调用
Shroom.mock(options?)                 // → Device，模拟数据
Shroom.createHeatmap(target, opts?)   // → Heatmap
Shroom.isSupported()                  // → boolean，当前浏览器能不能用串口
Shroom.version                        // '0.1.0'
```

也可以按名字导入，还额外导出了底层件（自己接别的数据源时用）：

```js
import {
  connectSerial, isSerialSupported, createHeatmap, createMockDevice,
  createFramer, decodeFrame, resolveShape, DEFAULT_DELIMITER,
  jet, jetWhite, grey, getColormap,
} from './sdk/web/index.js';
```

### 4.2 Node 入口 `sdk/node/index.js`

```js
Shroom.connect(options?)     // → Promise<Device>，options.path 不填就自动挑第一个串口
Shroom.listPorts()           // → Promise<PortInfo[]>，列出机器上的串口
Shroom.mock(options?)        // → Device
Shroom.renderAscii(frame, o?) // → string，终端里的彩色方块图，直接 console.log
```

需要 `npm i serialport`（原生模块，按需加载；不装也不影响 mock 和 core）。

### 4.3 Device（连接后拿到的东西，两端一致）

```js
device.info            // { source: 'web-serial'|'node-serial'|'mock', rows, cols, baudRate|path|fps }
device.onFrame(fn)     // 订阅每一帧，返回一个「取消订阅」的函数
await device.close()   // 断开

// 下面四个只有真实串口设备有，mock 没有（用 ?. 或先判断 source）
device.bytesReceived   // 收到的原始字节总数
device.frameCount      // 成功切出的帧数
device.droppedCount    // 被丢掉的脏帧数
device.frameLength     // 锁定下来的帧长（字节），还没锁上是 0
```

`onFrame` 可以订阅多个；一个回调抛错不影响其他回调。取消订阅：

```js
const off = device.onFrame(handler);
off();   // 不再收
```

### 4.4 连接参数

```js
await Shroom.connect({
  baudRate: 1000000,                    // 默认 1000000
  delimiter: [0xAA, 0x55, 0x03, 0x99],  // 帧分隔符，默认就是这个
  rows: 32, cols: 32,                   // 不填按方阵推断：1024 个点 → 32×32
  fullScale: 255,                       // 满量程，默认 255
  threshold: 0.02,                      // 算 area / center 的有效点阈值
  lockLength: true,                     // 锁定帧长，默认开，见 §6
  filters: [{ usbVendorId: 0x1a86 }],   // 仅浏览器：过滤设备选择框
  path: 'COM3',                         // 仅 Node：端口号
});
```

### 4.5 Heatmap

```js
const heatmap = Shroom.createHeatmap('#view', { mode: 'dots' });
heatmap.render(frame);          // 记下这一帧，下个屏幕刷新周期画出来
heatmap.setOptions({ gain: 2 }); // 运行中改任何选项
heatmap.resize();               // 容器尺寸变了时调（一般不用手动调）
heatmap.clear();                // 清空
heatmap.canvas;                 // 拿到底层 <canvas>
```

选项：

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `mode` | `'dots'` | `'dots'` 透视点阵 / `'heat'` 热力圆斑 / `'grid'` 方格 |
| `colormap` | `'jet'` | `'jet'` / `'jetWhite'` / `'grey'`，或自定义函数 `(t) => [r,g,b]`，t 是 0~1 |
| `gain` | `1` | 显示增益，信号弱时调大。**只影响显示，不改 `frame.values`** |
| `dotSize` | `1` | 点 / 圆斑大小倍数 |
| `smooth` | `true` | 是否平滑，只对 `'heat'` / `'grid'` 有效 |
| `relief` | `1` | 点阵起伏高度倍数，给 `0` 就是平的俯视点阵。只对 `'dots'` 有效 |
| `tilt` | `70` | 俯视角（度，5~89）。越大越像正俯视、方阵看着越方。只对 `'dots'` 有效 |
| `flipY` | `true` | 数据第 0 行画在近处（画面下方）。**按下面却是上面鼓起来就设成 `false`**。只对 `'dots'` 有效 |

`render()` 只是**记下**这一帧，实际绘制推到下一个屏幕刷新周期。所以哪怕串口一秒来 100 帧，
也只会画 60 次，不用你自己做节流。

### 4.6 底层件（自己接数据源时用）

想接 WebSocket、蓝牙、文件回放等 SDK 没提供的数据源，用这两个就能拿到同样的 Frame：

```js
import { createFramer, decodeFrame } from './sdk/web/index.js';

const framer = createFramer();                    // 字节流 → 一帧一帧
for (const payload of framer.push(someBytes)) {   // push 返回本次切出的所有帧
  const frame = decodeFrame(payload, { rows: 32, cols: 32 });
  heatmap.render(frame);
}
```

`createFramer()` 返回 `{ push(chunk), reset(), droppedCount, frameLength }`。

---

## 5. 硬性约束（违反了代码一定跑不起来）

### 5.1 浏览器串口必须在用户手势里调用

```js
// ✅ 对
button.onclick = async () => { const d = await Shroom.connect(); };

// ❌ 错：页面一加载就连，浏览器直接拒绝
window.onload = async () => { const d = await Shroom.connect(); };

// ❌ 错：await 了别的东西之后再 connect，用户手势已经过期
button.onclick = async () => {
  await fetch('/api/config');       // ← 这一行让手势失效
  const d = await Shroom.connect(); // 抛错
};
```

要先取配置就**先 connect 再 fetch**，或者把配置提前准备好。

### 5.2 浏览器串口只在 https 或 localhost 下开放

`navigator.serial` 标了 `SecureContext`。所以：

- `http://localhost:xxxx` ✅
- `https://你的域名` ✅
- `file://`（双击 html 文件打开）❌ **永远不行**，任何打包方式都绕不过
- `http://192.168.x.x` ❌

写代码时用 `Shroom.isSupported()` 提前判断，给用户一个明确的提示，别让按钮点了没反应。

### 5.3 只有 Chrome / Edge 支持

Safari 和 Firefox 没有 Web Serial，且短期内不会有。需要跨浏览器就走 Node/Electron 方案。

### 5.4 帧率很高，回调里别做重活

一秒可能来 100 帧。`onFrame` 里做 DOM 操作、`JSON.stringify`、
`console.log` 大对象都会卡。要更新 UI 文字就自己降频：

```js
let last = 0;
device.onFrame((frame) => {
  heatmap.render(frame);                    // 这个内部已经按屏幕刷新率节流了
  if (frame.timestamp - last > 100) {       // 文字每 100ms 更新一次就够了
    last = frame.timestamp;
    label.textContent = frame.max.toFixed(3);
  }
});
```

### 5.5 别持有 frame 对象

`frame.raw` 是原始 buffer 的视图，`frame.values` 每帧都是新的。要存起来做回放/曲线，
**存副本或存标量**，别把整个 frame 塞进数组：

```js
// ✅ 存标量
history.push(frame.max);

// ✅ 存副本
recorded.push(new Uint8Array(frame.raw));

// ❌ 存引用，内存会炸，raw 还可能被复用
recorded.push(frame);
```

---

## 6. 帧长锁定（`lockLength`，默认开）

分隔符只有 4 个字节，数据里迟早会撞出一串一模一样的 `AA 55 03 99`，
于是切出一个长度不对的短帧。这种长度多半不是完全平方数，
`resolveShape` 会把它退化成 `1×N`——画面就在方阵和一条横线之间狂闪。

所以切帧器默认会：**连着 3 帧长度一致就锁死这个长度**，之后长度对不上的一律当脏帧丢掉；
万一锁错了（比如开头第一帧本身是残的），另一个长度连着来 12 次就改锁它，能自己纠回来。

因此 `droppedCount` 有个小数字在缓慢增长是**正常的**，不用报错给用户。
真需要收变长帧就传 `lockLength: false`。

---

## 7. 排错对照表

用户说「连上了但没画面」，让他看这三个数：

| 现象 | 原因 | 怎么办 |
| --- | --- | --- |
| `bytesReceived === 0` | 设备根本没在发数据 | 选错 COM 口 / 线坏了 / 设备要先发启动指令 |
| 字节在涨但 `frameCount === 0` | 波特率或分隔符不对 | 依次试 `1000000`（默认）、`921600`、`1500000`、`3000000`、`115200` |
| 帧在涨但画面是一条横线 | 帧长不是完全平方数，推不出方阵 | 显式传 `rows` / `cols`；`device.frameLength` 就是实际帧长 |
| 帧在涨但画面花 | 矩阵尺寸猜错了 | 同上，显式传 `rows` / `cols` |
| `droppedCount` 缓慢增长 | 假分隔符被帧长锁定挡掉了 | 正常，不用管 |
| `droppedCount` 猛涨 | 波特率不稳 | 换一档波特率 |
| 点阵按下面却是上面鼓起来 | 传感器行序和默认相反 | `heatmap.setOptions({ flipY: false })` |
| 连接按钮点了没反应 | 不在用户手势里 / 不是安全上下文 | 见 §5.1、§5.2 |

---

## 8. 可以直接抄的例子

### 8.1 用重心控制一个小球

```js
const heatmap = Shroom.createHeatmap('#view');
const ball = document.querySelector('#ball');

device.onFrame((frame) => {
  heatmap.render(frame);
  if (frame.max < 0.05) return;                   // 没人按就别动
  ball.style.left = frame.center.x * 100 + '%';
  ball.style.top  = frame.center.y * 100 + '%';
  ball.style.background = frame.max > 0.5 ? 'red' : 'white';
});
```

### 8.2 最大压力曲线

```js
const history = [];
device.onFrame((frame) => {
  history.push(frame.max);                        // 存标量，不是整个 frame
  if (history.length > 300) history.shift();      // 只留最近 300 点
});

setInterval(() => drawCurve(history), 50);        // 画图跟采集分开，别在 onFrame 里画
```

### 8.3 录制与回放

```js
import { decodeFrame } from './sdk/web/index.js';

const tape = [];
const off = device.onFrame((f) => tape.push(new Uint8Array(f.raw)));  // 存副本

// 停止录制
off();

// 回放
let i = 0;
const timer = setInterval(() => {
  if (i >= tape.length) return clearInterval(timer);
  heatmap.render(decodeFrame(tape[i++], { rows: 32, cols: 32 }));
}, 33);
```

### 8.4 分区域统计（比如把 32×32 分成四象限）

```js
function quadrantSums(frame) {
  const { values, rows, cols } = frame;
  const q = [0, 0, 0, 0];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const idx = (y < rows / 2 ? 0 : 2) + (x < cols / 2 ? 0 : 1);
      q[idx] += values[y * cols + x];
    }
  }
  return q;    // [左上, 右上, 左下, 右下]
}
```

### 8.5 简单去噪（SDK 不提供，自己两行）

```js
let smoothed = null;
device.onFrame((frame) => {
  if (!smoothed || smoothed.length !== frame.values.length) {
    smoothed = new Float32Array(frame.values);
  }
  for (let i = 0; i < smoothed.length; i += 1) {
    smoothed[i] += (frame.values[i] - smoothed[i]) * 0.3;   // 越小越黏
  }
  // 拿 smoothed 去做你的判断
});
```

---

## 9. 目录与每个文件的职责

```
sdk/
├─ core/              纯逻辑，浏览器和 Node 共用，不碰任何设备 API
│  ├─ framer.js         字节流 → 一帧一帧（找分隔符、切帧、帧长锁定）
│  ├─ frame.js          一帧字节 → Frame 对象（归一化、算 max/area/center）
│  ├─ colormap.js       0~1 → [r,g,b]，提供 jet / jetWhite / grey
│  ├─ device.js         帧订阅中心，onFrame 的实现
│  └─ mock.js           模拟数据源，产出的是原始字节，和真串口走同一条解码路径
├─ web/               浏览器
│  ├─ serial.js         ★ Web Serial API 连接串口
│  ├─ heatmap.js        canvas 渲染，三种画法
│  ├─ index.js          浏览器入口，import 这个
│  ├─ index.html        示例页面（代码已内联，单文件）
│  └─ shroom.bundle.js  单文件版，不想用模块就 <script> 引这个
├─ node/              Node / Electron
│  ├─ serial.js         ★ serialport 连接串口
│  ├─ ascii.js          终端里的彩色方块图
│  ├─ demo.js           命令行示例
│  └─ index.js          Node 入口，import 这个
├─ start.mjs          起一个本地服务器打开示例页（因为 file:// 连不了串口）
└─ index.d.ts         TypeScript 类型定义
```

**串口连接在哪里？** 就两个文件，上面打 ★ 的：
- `web/serial.js` —— 浏览器，用 Web Serial API
- `node/serial.js` —— Node / Electron，用 serialport 包

两者都是：读到字节 → 丢给 `core/framer.js` 切帧 → 丢给 `core/frame.js` 解码 →
通过 `core/device.js` 发给你的 `onFrame`。所以两端拿到的 Frame 完全一样。

`core/` 不依赖任何环境 API，所以你想接别的数据源（WebSocket、蓝牙、文件），
自己调 `createFramer()` + `decodeFrame()` 就行，见 §4.6。

---

## 10. 写代码时的默认选择

除非用户另有要求，按这个来：

- **先用 `Shroom.mock()` 把功能跑通**，最后再换成 `Shroom.connect()`。用户往往手边没设备。
- 浏览器方案优先，除非用户明确说要 Electron / 后端 / 命令行。
- 连接按钮的文案和禁用状态要处理好：先 `Shroom.isSupported()` 判断，
  不支持就禁用按钮并说明原因（是 `file://`？还是浏览器不对？），别让用户点了没反应。
- 数值一律按 0~1 显示，或者显示成百分比，**不要编造物理单位**。
- `onFrame` 里只做计算和 `heatmap.render()`，DOM 更新降频到 10Hz 左右。
- 需要本地起服务时提醒用户：不能双击 html 文件，要 `node start.mjs`（SDK 里自带）。
