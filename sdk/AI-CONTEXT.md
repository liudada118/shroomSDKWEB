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

## 0.5 先确定 import 路径（第一行代码就会错）

本文所有示例都写成 `'./sdk/web/index.js'`，那是**你的文件在 `sdk/` 外面**时的写法。
**先搞清楚你要把文件放在哪**，照下表选：

| 你的文件放在 | import 写法 |
| --- | --- |
| `sdk/web/` 里面（**最常见**，因为要用自带服务器打开） | `'./index.js'` |
| `sdk/` 的同级目录 | `'./sdk/web/index.js'` |
| 项目里任意位置 | 按相对层级算，目标永远是 `sdk/web/index.js` |

**为什么最常见的是第一种**：浏览器串口不能用 `file://`（见 §5.2），
用户一般用 SDK 自带的 `start-demo.bat` / `start.mjs` 起服务，那个服务器的根目录就是 `sdk/`，
所以把页面放进 `sdk/web/` 是最省事的做法，访问 `http://localhost:5178/你的文件.html` 即可。

> 路径写错的症状：**页面全白，Console 里一条 404**。这是最高频的低级错误，
> 写第一行之前先确认好。

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

> **`mock()` 是同步的**（`connect()` 是 async）。写成 `await Shroom.mock()` 也不会出错——
> `await` 一个非 Promise 值就是它本身——所以两种写法都能跑。

### mock 产生的是什么数据

**两个高斯亮斑绕着中心转**（一大一小，反向旋转），外加一点底噪：

- 峰值 `max` 稳定在 **0.9 以上**，底噪约 0.01
- 亮斑**持续移动**，`center` 一直在变，绕中心画圈
- 默认 32×32、30fps

**它能验证什么**：渲染、`center` 跟随、`max`/`area` 读数、曲线、录制回放——链路整体是通的。

**它不能验证什么**：
- **真实的按压节奏**。mock 的 `max` 一直很高、从不「松手」，所以**「按下→抬起」这类状态机在 mock 下不会触发**。
  测这类逻辑要么手动造数据，要么就得插真设备。
- 你的传感器实际的数值范围和噪声水平。

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

### 坐标系（做位置相关功能前必读）

数据的排布方式是确定的，**不受任何显示选项影响**：

```
values 索引 = y * cols + x      x 是列（0 ~ cols-1），y 是行（0 ~ rows-1）

center.x = 列方向，0 = 第 0 列，1 = 最后一列
center.y = 行方向，0 = 第 0 行，1 = 最后一行
```

把 `center` 映射成 N×N 的格子（记得钳制，浮点可能取到边界）：

```js
const col = Math.min(N - 1, Math.floor(frame.center.x * N));
const row = Math.min(N - 1, Math.floor(frame.center.y * N));
```

> **`flipY` 不影响 `center`。** `flipY` 只是 `'dots'` 模式**画图时**把行序颠倒一下，
> `frame.values` 和 `frame.center` 永远是原始行序。所以你的位置判定逻辑不用管 `flipY`。
>
> **但传感器实物朝哪一边放，SDK 不知道。** 第 0 行是贴近用户的那边还是远离的那边，
> 取决于设备怎么摆。**做位置类功能时给用户一个「上下翻转」开关**（`y → 1 - y`），
> 比你猜一个方向可靠。

> **多点按压时 `center` 是加权平均。** 两个手指分别按左上和右下，重心会落在正中间——
> 那里可能根本没人按。SDK **没有**提供「最大压力点的坐标」，需要的话自己遍历 `values` 找最大值下标：
>
> ```js
> let peak = 0, peakIdx = 0;
> for (let i = 0; i < frame.values.length; i += 1) {
>   if (frame.values[i] > peak) { peak = frame.values[i]; peakIdx = i; }
> }
> const px = peakIdx % frame.cols, py = Math.floor(peakIdx / frame.cols);
> ```
>
> 单点触发类应用（按格子、打地鼠）用峰值点通常比用重心准。

### 典型数值量级（写阈值时的依据）

传感器逐片有差异，下面是**数量级参考**，不是标准值：

| 状态 | `frame.max` 大致范围 |
| --- | --- |
| 没人碰 | 0.01 ~ 0.05（底噪） |
| 手指轻触 | 0.1 ~ 0.3 |
| 手指正常按 | 0.3 ~ 0.7 |
| 用力按 / 手掌压 | 0.7 ~ 1.0 |

所以「**判定为按下**」的阈值取 **0.15 左右**是个合理起点，`0.05` 只够用来判断「有没有人碰」。

**更稳的做法是不写死阈值**，开头采一秒基线，然后按相对量触发：

```js
// 让用户别碰传感器，先量一下底噪
let baseline = 0.03;
setTimeout(() => { baseline = observedMax; }, 1000);

const pressed = frame.max > baseline + 0.12;
```

按压检测建议用**双阈值**，避免在临界点反复触发：

```js
if (!isDown && frame.max > 0.15) isDown = true;        // 按下
else if (isDown && frame.max < 0.08) isDown = false;   // 抬起（阈值更低）
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
> - 如果用户明确要物理单位，告诉他需要联系官方技术人员拿标定数据，这是 SDK 之外的事

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

> **`close()` 会自动清掉所有订阅**，不用先挨个 `off()` 再 `close()`。
> `off()` 只在「设备还连着，但某个模块不想再收了」时才需要。

### 4.3.1 connect() 抛错的两种情况

用户在串口选择框上点「取消」也会抛错，**要和真正的连接失败分开处理**，
否则用户取消一下就看到一句「连接失败」，很莫名其妙：

```js
try {
  device = await Shroom.connect();
} catch (err) {
  // 用户主动取消：静默返回，什么都不用提示
  if (err?.name === 'NotFoundError') return;
  // 其余才是真的出问题了
  showError('连接失败：' + err.message);
}
```

### 4.3.2 切换设备时的顺序（容易踩）

必须**先 connect，成功之后再关旧的**。反过来写会让第二次连接直接失败——
因为 `await oldDevice.close()` 会消耗掉用户手势（见 §5.1）：

```js
// ✅ 对
button.onclick = async () => {
  const next = await Shroom.connect();   // 先连新的
  await current?.close();                // 再关旧的
  current = next;
};

// ❌ 错：第二次点就连不上了
button.onclick = async () => {
  await current?.close();                // ← 这一行让手势失效
  current = await Shroom.connect();      // 抛错
};
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

> **canvas 尺寸交给 CSS 就行。** heatmap 内部按 `clientWidth/clientHeight × devicePixelRatio`
> 自己设置画布分辨率，高分屏不会糊。你只要给 canvas 一个 CSS 尺寸：
>
> ```html
> <canvas id="view" style="width: 360px; height: 360px"></canvas>
> ```
>
> **不要**自己去写 `canvas.width = 360`，会被覆盖。容器尺寸变化一般能自动跟上，
> 极端情况下手动调一次 `heatmap.resize()`。

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

- `http://localhost:xxxx` ✅
- `https://你的域名` ✅
- `file://`（双击 html 文件打开）❌
- `http://192.168.x.x` ❌

写代码时用 `Shroom.isSupported()` 提前判断，给用户一个明确的提示，别让按钮点了没反应。

### 5.3 只有 Chrome / Edge 支持

Safari 和 Firefox 没有 Web Serial。需要跨浏览器就走 Node/Electron 方案。

**操作系统不是限制**：Windows / macOS / Linux 三个桌面系统上的 Chrome / Edge 都能用，
代码一份，不用写平台分支。移动端不行（Android Chrome 也没有 Web Serial）。

写给用户看的提示文案里，**别写「请在 Windows 上运行」**——限制是浏览器，不是系统。

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

分隔符只有 4 字节，数据里迟早会撞出一串一模一样的，于是切出长度不对的脏帧。
切帧器默认会锁定帧长把这些丢掉，也能自动纠回来。

**你只需要知道一件事：`droppedCount` 有个小数字在缓慢增长是正常的，不用报错给用户。**

（真需要收变长帧就传 `lockLength: false`。）

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
| 浏览器弹了选择框但列表是空的 | 设备没插好，或系统缺驱动 / 缺权限 | 见下面这行 |
| Node 端 `Permission denied` 或 `listPorts()` 返回空 | Linux 上普通用户默认没有串口权限 | `sudo usermod -aG dialout $USER` 后重新登录；设备名一般是 `/dev/ttyUSB0` |

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

### 8.2 按到哪个格子（打地鼠这类）

把传感器分成 N×N 格，检测「按下 → 抬起」并判定落在哪一格：

```js
const N = 3;
let isDown = false, peakMax = 0, peakCenter = null;

device.onFrame((frame) => {
  heatmap.render(frame);

  if (!isDown && frame.max > 0.15) {           // 按下
    isDown = true; peakMax = 0;
  }
  if (isDown) {
    if (frame.max > peakMax) {                 // 记住最重那一刻的位置
      peakMax = frame.max;
      peakCenter = { x: frame.center.x, y: frame.center.y };   // 存副本
    }
    if (frame.max < 0.08) {                    // 抬起，结算
      isDown = false;
      const col = Math.min(N - 1, Math.floor(peakCenter.x * N));
      const row = Math.min(N - 1, Math.floor(peakCenter.y * N));
      onHit(row, col);                         // ← 你的逻辑
    }
  }
});
```

两个要点：**取按压过程中最重那一帧的位置**（刚碰到和快松手时重心会飘），
以及**双阈值**（0.15 按下 / 0.08 抬起）避免在临界点反复触发。

> mock 数据 `max` 一直很高、不会「松手」，**这段逻辑在 mock 下不会触发**，需要真设备测。

### 8.3 最大压力曲线

```js
const history = [];
device.onFrame((frame) => {
  history.push(frame.max);                        // 存标量，不是整个 frame
  if (history.length > 300) history.shift();      // 只留最近 300 点
});

setInterval(() => drawCurve(history), 50);        // 画图跟采集分开，别在 onFrame 里画
```

### 8.4 录制与回放

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

### 8.5 分区域统计（比如把 32×32 分成四象限）

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

### 8.6 简单去噪（SDK 不提供，自己两行）

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

## 9. 目录结构（主要用来确认 import 路径）

```
sdk/
├─ core/              纯逻辑，浏览器和 Node 共用
│  ├─ framer.js         字节流 → 一帧一帧
│  ├─ frame.js          一帧字节 → Frame 对象
│  ├─ colormap.js       0~1 → [r,g,b]
│  ├─ device.js         帧订阅中心
│  └─ mock.js           模拟数据源
├─ web/               浏览器
│  ├─ index.js          ← 浏览器入口，import 这个
│  ├─ serial.js         Web Serial 连接
│  ├─ heatmap.js        canvas 渲染
│  ├─ index.html        官方示例页
│  └─ shroom.bundle.js  单文件版，<script> 直接引
├─ node/               Node / Electron
│  └─ index.js          ← Node 入口，import 这个
├─ start.mjs          本地服务器（根目录 = sdk/，端口 5178 起，占用则顺延到 5182）
└─ index.d.ts         TypeScript 类型定义
```

**你只需要 import 两个入口之一**：`web/index.js` 或 `node/index.js`，
路径怎么写见 §0.5。其余文件不用读，本文已经涵盖了它们的全部对外行为。

> 唯一的例外是 §4.6 的 `createFramer` / `decodeFrame`——接非串口数据源时才用，
> 它们同样从入口文件导出，不用去 `core/` 里单独引。

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
