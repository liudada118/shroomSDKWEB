# Shroom SDK

压力传感器最小 SDK。**只做三件事**：连接串口 → 拿到数据 → 画成图。

曲线、回放、报表、算法这些都不在里面，那是你（或者 AI）在这个基础上写的部分。

---

## 30 秒跑起来

**想连真实设备 → 双击 `start-demo.bat`**（macOS / Linux 用 `sh start.sh`）。
它会自己切到正确目录、检查 Node、起服务器并打开浏览器；出错也不会一闪就关，能看清报错。
需要 Node 18 以上（`node -v` 查一下，没有就去 https://nodejs.org 装）。

**只想先看看长什么样 → 双击 `web/index.html`**，什么都不用装。
模拟数据、热力图、配色切换都能正常跑，只有「连接设备」是灰的。

> 为什么双击连不了设备？浏览器规定串口只在 `https` 或 `localhost` 下开放
> （`navigator.serial` 在规范里标了 `SecureContext`），`file://` 不在白名单里。
> 这是浏览器的硬规定，任何打包方式都绕不过去，只能用上面那个 `start-demo.bat`。

命令行开法：

```bash
# 浏览器示例（推荐先看这个）
node start.mjs
# 会自动打开浏览器；端口被占用会自动顺延到 5179、5180…

# 终端示例
node node/demo.js            # 模拟数据
node node/demo.js --list     # 列出串口
node node/demo.js COM3       # 连真实设备
```

macOS / Linux 可以用 `sh start.sh`。

---

## 浏览器里用

```js
import { Shroom } from './sdk/web/index.js';

const heatmap = Shroom.createHeatmap('#view');   // #view 是一个 <canvas>

document.querySelector('#btn').onclick = async () => {
  const device = await Shroom.connect({ baudRate: 1000000 });
  device.onFrame((frame) => heatmap.render(frame));
};
```

三行就是全部。`Shroom.connect()` **必须写在点击回调里**——浏览器规定串口只能由用户手势触发。

没有硬件就把 `Shroom.connect()` 换成 `Shroom.mock()`，其余代码一个字不用改：

```js
const device = Shroom.mock({ rows: 32, cols: 32, fps: 30 });
```

**浏览器要求**：Chrome 或 Edge（Safari / Firefox 没有 Web Serial），页面是 https 或 localhost。
用 `Shroom.isSupported()` 提前判断。

---

## Node / Electron 里用

```bash
npm i serialport
```

```js
import { Shroom } from './sdk/node/index.js';

const device = await Shroom.connect({ path: 'COM3', baudRate: 1000000 });
device.onFrame((frame) => {
  console.log(Shroom.renderAscii(frame));   // 终端里的彩色热力图
});
```

---

## Frame：唯一的数据结构

不管数据从哪来（浏览器串口、Node 串口、模拟），`onFrame` 拿到的都是同一个东西：

```js
{
  raw,        // Uint8Array    原始 ADC 值 0~255，一个点一个字节
  values,     // Float32Array  归一化到 0~1，长度 = rows * cols
  rows, cols, // 矩阵尺寸
  min, max, avg,  // 归一化后的极值和均值
  area,       // 受力点数（超过阈值的点）
  center,     // { x, y } 压力重心，都是 0~1
  timestamp,  // 毫秒时间戳
}
```

`values` 是 0~1 的**相对值**，不是物理单位。要换算成 kPa 需要每台设备的标定数据，
不在这个 SDK 里。

要按行列取某个点：

```js
const v = frame.values[y * frame.cols + x];
```

---

## API

### 浏览器（`web/index.js`）

| 方法 | 说明 |
| --- | --- |
| `Shroom.connect(options?)` | 连接串口，返回 `Promise<Device>`。必须在用户点击里调用 |
| `Shroom.mock(options?)` | 模拟设备，接口与 `connect()` 完全一致 |
| `Shroom.createHeatmap(canvas, options?)` | 在 canvas 上创建热力图 |
| `Shroom.isSupported()` | 当前浏览器是否支持串口 |

### Node（`node/index.js`）

| 方法 | 说明 |
| --- | --- |
| `Shroom.connect(options?)` | 连接串口，`options.path` 不填就自动挑第一个 |
| `Shroom.listPorts()` | 列出可用串口 |
| `Shroom.mock(options?)` | 模拟设备 |
| `Shroom.renderAscii(frame, options?)` | 把一帧画成终端里的彩色方块 |

### Device

```js
device.info                    // { source, rows, cols, baudRate | path | fps }
const off = device.onFrame(fn) // 订阅，返回取消订阅的函数
device.bytesReceived           // 收到的原始字节数（串口设备才有）
device.frameCount              // 成功切出的帧数（串口设备才有）
device.droppedCount            // 丢掉的脏帧数，一直涨说明参数配错了
device.frameLength             // 锁定下来的帧长（字节），还没锁上是 0
await device.close()           // 断开
```

### Heatmap

```js
const heatmap = Shroom.createHeatmap('#view', { mode: 'dots' })
heatmap.render(frame)
heatmap.setOptions({ colormap: 'jetWhite', gain: 2, dotSize: 1.4 })
heatmap.clear()
```

**三种画法**：

| mode | 长什么样 | 适合 |
| --- | --- | --- |
| `'dots'`（默认） | 带透视的点阵，没受力的地方是一片蓝色底噪，受力的地方顶起来并变绿变黄变红 | 和 Shroom 桌面端一样的观感 |
| `'heat'` | 每个传感点一个圆斑，边缘淡出，叠加成一片 | 看整体压力分布 |
| `'grid'` | 一个点一个方格 | 看原始矩阵、调试尺寸 |

点阵那条链路和桌面端是同一套：把每个传感点甩到一个更密的格子上 → 高斯摊开 →
逐点做时间柔化 → 按值定高度、按值取颜色。**每个格点都画**，包括没受力的，
它们落在 jet 的最低档正好是纯蓝，那片蓝底就是点阵的底子。整个过程只用 canvas，
不依赖 Three.js。

其他参数：`colormap` 可选 `'jet'`（彩虹）、`'jetWhite'`（白底）、`'grey'`（灰度），
也可以直接传自己的函数 `(t) => [r, g, b]`，`t` 是 0~1；
`gain` 是显示增益，信号弱时调大；`dotSize` 是点 / 圆斑的大小倍数；
`relief` 是点阵起伏高度倍数（给 `0` 就是平的俯视点阵）；
`tilt` 是俯视角（度，默认 70）——**嫌点阵看着太扁就调它**，越大越像正俯视、
方阵看过去越方，示例页面上有个「视角」滑块可以直接拖；
`flipY` 决定数据第一行画在近处还是远处（默认 `true` = 近处）——**按下面却是上面鼓起来
就把它设成 `false`**，示例页面上是「前后翻转」那个勾。

`render()` 只是记下这一帧，实际绘制放在下一个屏幕刷新周期。所以数据来得再快
（串口 1000000 波特下一秒上百帧）也不会多画一次，画面不会闪，CPU 也不会白烧。

---

## 连接参数

```js
await Shroom.connect({
  baudRate: 1000000,                       // 默认 1000000
  delimiter: [0xAA, 0x55, 0x03, 0x99],    // 帧分隔符，默认就是这个
  rows: 32, cols: 32,                     // 不填按方阵推断：1024 个点 → 32×32
  fullScale: 255,                         // 满量程
  threshold: 0.02,                        // 算 area / center 时的有效点阈值
  lockLength: true,                       // 锁定帧长，默认开，见下
});
```

**关于 `lockLength`。** 分隔符只有 4 个字节，数据里迟早会撞出一模一样的一串
`AA 55 03 99`，于是切出一个长度不对的短帧。这种长度多半不是完全平方数，
解码时会退化成 `1×N`——画面就在方阵和一条横线之间来回闪。
所以切帧器默认会：连着 3 帧长度一致就把这个长度锁死，之后长度对不上的一律当脏帧丢掉；
万一锁错了（比如开头第一帧本身就是残的），另一个长度连着来 12 次就改锁它，能自己纠回来。
`device.frameLength` 能看到锁在了多少字节。真要收变长帧就传 `lockLength: false`。

**点「连接设备」没反应？** 对照下面这张表：

| 现象 | 原因 | 怎么办 |
| --- | --- | --- |
| 「连接设备」是灰的，页面顶上有黄条 | 你是双击 `web/index.html` 打开的，`file://` 下没有串口 | 改用 `start-demo.bat` |
| 页面一片空白 / 样式全乱 | 浏览器太老 | 换新版 Chrome 或 Edge |
| `localhost:5178` 打不开 | 服务器没起来 | 见下面「服务器起不来」 |
| 提示「不是安全上下文」 | 页面地址不是 https 或 localhost | 换成 localhost，或给站点配 https |
| 提示「没有 Web Serial API」 | 浏览器不支持（Safari / Firefox / 部分国产壳浏览器） | 换 Chrome 或 Edge |
| 弹了框但列表是空的 | 设备没插好，或缺 USB 串口驱动 | Windows 上装 CH341SER，再看设备管理器里有没有 COM 口 |
| 点了「连接设备」直接说「你取消了选择」 | 弹框被你关掉了 | 重新点，在列表里选中设备再确认 |

**服务器起不来 / `localhost:5178` 打不开？** 先看运行 `node start.mjs` 的那个窗口打印了什么：

| 窗口里的提示 | 意思 | 怎么办 |
| --- | --- | --- |
| `这个目录下没有 web/index.html` | 你在外层文件夹里跑的 | 解压出来常常是 `shroom-sdk\shroom-sdk\`，要 cd 到**里面**那层 |
| `'node' 不是内部或外部命令` | 没装 Node 或没进 PATH | 装 Node.js 18+，装完**重开**一个终端窗口 |
| `端口 5178 被占用，换 5179 试试` | 端口冲突 | 按它最后打印的那个地址开 |
| 窗口一闪就没了 | 双击了 `start.mjs` | 双击 `start-demo.bat`，或在终端里跑 |
| 什么都没打印 | 命令没真正执行 | 确认你按了回车、且当前目录下有 `start.mjs`（`dir` 看一下） |

服务器起来的标志是窗口里出现 `Shroom SDK 示例已启动：http://localhost:xxxx`，**并且这个窗口不能关**。关掉窗口服务器就停了，页面自然打不开。

**连上了但没画面 / 画面是花的？** 示例页面右下角有一行诊断数字，照着它判断：

| 诊断 | 说明 | 怎么办 |
| --- | --- | --- |
| 字节 = 0 | 设备根本没往外发数据，和解析无关 | 确认选对了 COM 口；设备是否需要先发启动指令；换根数据线 |
| 字节在涨，帧 = 0 | 数据来了但切不出帧 —— **波特率或分隔符不对** | 换波特率：`1000000`（默认）、`921600`（手套 / 机器人）、`1500000`、`3000000`、`115200` |
| 帧在涨，画面花 | 帧切对了但矩阵尺寸不对 | 显式指定 `rows` / `cols`，别靠方阵推断 |
| 画面变成一条横线 | 帧长不是完全平方数，推不出方阵 | 显式指定 `rows` / `cols`；`device.frameLength` 就是实际帧长 |
| 帧在涨，丢弃也在涨 | 数据里撞出了假分隔符，被帧长锁定挡掉了 | 正常现象，画面稳就不用管；一直猛涨才是波特率不稳，换一档试试 |

代码里对应的是这三个计数：

```js
device.bytesReceived   // 串口收到的原始字节数
device.frameCount      // 成功切出的帧数
device.droppedCount    // 长度不合法被丢掉的帧数
device.frameLength     // 锁定下来的帧长（字节）
```

---

## 目录

```
sdk/
├─ core/          纯逻辑，浏览器和 Node 共用，不碰任何设备 API
│  ├─ framer.js     字节流 → 一帧一帧
│  ├─ frame.js      一帧字节 → Frame 对象
│  ├─ colormap.js   0~1 → 颜色
│  ├─ device.js     帧订阅
│  └─ mock.js       模拟数据源
├─ web/           浏览器：Web Serial + canvas 热力图 + 示例页面
│  ├─ index.js          模块版入口，正经项目 import 这个
│  ├─ index.html        示例页面，代码已内联，单独拷到哪都能双击打开
│  └─ shroom.bundle.js  单文件版（自动生成），给不想用模块的人直接 script 引
├─ node/          Node：serialport + 终端热力图 + 示例脚本
├─ start.mjs      打开浏览器示例用的小服务器
└─ index.d.ts     TypeScript 类型
```

`core/` 不依赖任何环境 API，想接别的数据源（WebSocket、蓝牙、文件回放）
自己调 `createFramer()` + `decodeFrame()` 就行，拿到的还是同一个 Frame。

---

## 拿去问 AI

把这个 README 和 `index.d.ts` 一起丢给 AI，然后描述你想做的东西，比如：

> 我有一个 shroom-sdk，`device.onFrame(frame => ...)` 会给我 `frame.values`（0~1 的 Float32Array）、
> `frame.rows`、`frame.cols`、`frame.center`。帮我写一个页面：用重心控制一个小球移动，
> 压力超过 0.5 就变色。

SDK 负责把数据稳定地给到你手上，剩下的想怎么玩都行。
