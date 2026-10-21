# Shroom SDK · AI 上下文

> **这份文件是给 AI 读的。** 你（AI）拿到它之后，就掌握了这个 SDK 的全部能力边界和
> 正确用法，可以直接按用户的需求写代码，不需要再去翻源码。
>
> 人类用户：把这个文件整个丢给 AI，然后描述你想做的东西就行。

---

## 0. 一句话

真实设备先确认[串口驱动](docs/DRIVERS.md)，再激活 `shroom-sdk` 产品许可：JS `await Shroom.activateLicense(key, { deviceId })`，Python `Shroom.activate_license(key, device_id=...)`。SDK 不限制传感器型号，产品接口与通用串口均可用，旧 SDK 型号范围不再拦截；上位机密钥不能授权 SDK，有效期与电脑名额仍校验。内置模拟设备、解析和渲染免费。在线与限定电脑数量的 RSA 码需持续联网复核，授权失效会关闭实机并中断录制，历史文件仍可下载。先读[SDK 授权](docs/LICENSE.md)，后续实机代码片段均须在已激活状态运行。

CH34x 设备无可用驱动时系统无法提供串口，查询列表可能为空。Windows 驱动：[CH341SER.EXE](https://shroom.jq-industries.com/drive/CH341SER.EXE)；macOS 驱动：[CH34xVCPDriver.zip](https://shroom.jq-industries.com/drive/CH34xVCPDriver.zip)。安装后重新插拔并重启采集应用，再查询串口。WS 场景驱动安装在连接 USB 设备的采集电脑上。授权不限制型号不等于所有设备协议都已适配。

Shroom SDK 有两条路线：**现有产品快速接入：环境准备 → 产品参数 → 完整示例 → 授权连接 → 实机验收 → 项目集成**；**新设备基础接入：配置串口 → 解析标准帧 → 自定义展示与业务**。分别见[快速接入六章](docs/QUICK-START.md#guide-prepare)和[基础与自定义](docs/CUSTOM.md)。只读取产品数据不要求 WS、网页、录制或文件下载；这些能力保留在[可选扩展](docs/QUICK-START.md#extensions)。

Node.js / 浏览器接入整包手套 `handGloveFullPacket` 或手部检测垫 `hand`，优先用 `Shroom.connectGlove()` / `Shroom.connectHandPad()`：提供端口、手套左右手和 `onData / onError`，协议、波特率与映射由 SDK 内置。通用串口进阶才按 **查询 → 配置连接 → 自动解析 → 错误诊断** 组织。端口枚举或浏览器选择框不自动识别硬件型号；查询、校验、打开、读写、解析与关闭都需要错误处理。

JavaScript 支持浏览器与 Node，本文后续 JS 示例适用这两个入口。Python 入口为 `sdk/python`，完整说明见 [Python SDK](python/README.md)。不要把 JS 的 Promise / `onFrame()` 写进 Python 程序。

在本项目根目录安装 Python 版：`python -m pip install "./sdk/python[serial]"`；解压官网下载包后，在其根目录使用 `"./python[serial]"`。尚未发布 PyPI，不要让用户直接 `pip install shroom-sdk`。

官网下载已按语言分包：Node.js 包包含浏览器入口及 Python 说明，但不包含 Python 源码。需要 Python 时选择 `shroom-sdk-python.zip`，先读其 `python/AI-CONTEXT.md` 与 `python/README.md`。旧的 `shroom-sdk.zip` 完整包仍可使用。

```python
from shroom_sdk import Shroom

with Shroom.mock(rows=32, cols=32) as device:  # 实机换成 Shroom.connect("COM3", rows=32, cols=32)
    for frame in device:
        print(frame.max, frame.area, frame.center.x, frame.center.y)
        break
```

Python 要点：`Shroom.list_ports()`、`device.read_frame(timeout=2)`、`frame.matrix()`、`frame.to_dict()`。
使用 `baud_rate` / `full_scale` / `lock_length` 等 snake_case 参数；`values` 为 float32 数组，`raw` 为 bytes。
同步迭代在无数据时继续等待，`read_frame` 超时返回 `None`；使用 `with` 释放串口。没有后台线程，不支持 `on_frame()`。

Python 的 `ShroomError` 提供 `code / stage / suggestion / details`；配置异常兼容 `ValueError`，I/O 异常兼容 `OSError`。在同步调用处捕获，无 `onError()` 回调。串口与 Mock 都有 `state` 和 `get_diagnostics()`，字段为 snake_case，见 [Python 接入指南](python/AI-CONTEXT.md)。
Python 支持 `raw` / `mat32` 点位排列、模拟设备、文本热力图和可选 Matplotlib 示例，不提供标定、整包手套协议或上述产品连接入口；不要生成 Python 的 `connect_glove()` / `connect_hand_pad()`。

另外提供 **Node.js / 浏览器后端连接客户端** `BackendSdkClient`，详见 [后端连接指南](BACKEND.md)。它查询已有主项目后端的契约、串口、展示系统状态，订阅 WebSocket 实时帧，并支持显式请求后端打开串口或启停采集。不会启动后端；Shroom Monitor 不是此后端；Python 暂无此入口。

模块用具名导入 `import { BackendSdkClient } from './sdk/node/index.js'`（浏览器换 `web/index.js`）；经典脚本用 `new Shroom.BackendSdkClient()`。`client.on('frame', handler)` 保留后端 JSON，不是本 SDK 的 `Frame`，不能直接 `heatmap.render`、`decodeFrame` 或再次换线序。HTTP/WS 默认分别为 19245 / 19999 端口。使用后务必 `disconnectRealtime()`，不自动重连或重放控制命令。

曲线、回放、报表、手势识别、算法、数据库实现——**不在 SDK 里**，
那些正是你要帮用户写的部分。

**不要**去 SDK 里找这些东西，它们不存在：
标定、kPa/N 等物理单位换算、滤波器、峰值检测、手势分类、录制文件回放、
多设备管理、蓝牙、WiFi、云端上传、UI 组件库。

---

## 0.5 先确定 import 路径（第一行代码就会错）

下文部分 API 片段写成 `'./sdk/web/index.js'`，那是**你的文件在 `sdk/` 外面**时的写法。新的产品完整示例统一放在 SDK 根目录，浏览器导入 `./web/index.js`，Node.js 导入 `./node/index.js`。
**先搞清楚你要把文件放在哪**，照下表选：

| 你的文件放在 | import 写法 |
| --- | --- |
| SDK 根目录（产品完整示例） | `'./web/index.js'` |
| `sdk/web/` 里面（旧通用示例与自写网页） | `'./index.js'` |
| `sdk/` 的同级目录 | `'./sdk/web/index.js'` |
| 项目里任意位置 | 按相对层级算，目标永远是 `sdk/web/index.js` |

浏览器串口不能用 `file://`（见 §5.2）。SDK 自带服务器的根目录就是 `sdk/`；完整示例用 `node start.mjs --no-open` 启动，访问终端实际地址加 `/glove-left-example.html` 等根文件名。自写文件若放在 `sdk/web/`，其 URL 则包含 `/web/你的文件.html`。服务器端口可能顺延，不要写死 `5178` 后忽略终端输出。

> 路径写错的症状：**页面全白，Console 里一条 404**。这是最高频的低级错误，
> 写第一行之前先确认好。

---

## 1. 能力边界（先读这段，能省掉一半错误）

| 你想要的 | SDK 里有吗 | 怎么办 |
| --- | --- | --- |
| 整包手套 / 手部检测垫接入 | ✅ JS 有 | `Shroom.connectGlove({ side, onData, onError })` / `connectHandPad({ onData, onError })`，Node 可传 path |
| 通用串口拿数据 | ✅ 有 | 进阶入口 `Shroom.connect()`，自行确认协议与布局 |
| 连接已有后端 | ✅ JS 有 | `BackendSdkClient` 的 HTTP/WS 客户端；不能把后端拥有的能力当成 SDK 内置能力 |
| 独立 WS 数据服务 | ✅ Node.js 有 | `await Shroom.serveDevice(device, { port: 19999, recordingsDir: './recordings' })`；不是启动主项目后端 |
| 网页快速接入和产品显示 | ✅ 浏览器有 | `await Shroom.connectStream({ port: 19999 })`，再 `Shroom.createProductView('#view', { source: stream })`；二维分区或矩阵，不是 3D 手模 |
| 标签录制、CSV / JSONL 下载 | ✅ Node.js + 浏览器有 | 通过 stream 的 `startRecording / stopRecording / listRecordings / downloadRecording` 控制服务端持久化；Python 无此接口 |
| 没硬件也能开发 | ✅ 有 | `Shroom.mock()` 验证基础矩阵功能，不模拟手套序号、包类型和 IMU |
| 画成热力图 / 点阵 | ✅ 有 | `Shroom.createHeatmap()` |
| 压力重心、受力面积、最大值 | ✅ 有 | 每帧算好了，直接读 `frame.center` / `frame.area` / `frame.max` |
| 让画面位置和垫子对上 | ✅ 有 | 产品入口已映射；通用接口再按产品选 layout，见 §3 |
| 换算成 kPa / 牛顿 | ❌ 没有 | **做不到**，见 §3 的警告 |
| 曲线图 / 折线图 | ❌ 没有 | 你自己攒 `frame.max` 进数组，用 Chart.js / canvas 画 |
| 历史录制回放 | ❌ 没有 | 可用快速服务保存和下载完整帧，但播放、时间轴、暂停和定位由应用实现；不能只把手套 raw 再交给 decodeFrame() |
| 手势识别 / 姿态分类 | ❌ 没有 | 你自己在 `onFrame` 里写逻辑 |
| 滤波、去噪 | ❌ 没有 | 你自己对 `frame.values` 处理（SDK 只在**显示**时做了柔化，数据是原始的） |

---

## 2. 三十秒上手

现有产品先按[快速接入六章](docs/QUICK-START.md#guide-prepare)运行对应完整示例。产品页默认展示完整可运行示例；核心片段需手动切换，只适合已授权、已有会话管理的项目，不要当作首次接入文件。六章稳定链接为 `guide-prepare / guide-config / guide-run / guide-connect / guide-verify / guide-code`。

- 浏览器：SDK 根目录 `glove-left-example.html`、`glove-right-example.html` 或 `hand-pad-example.html`。执行 `node start.mjs --no-open`，访问终端实际地址加对应文件名；先独立激活，再点击连接。完整示例自动保存当前来源的稳定安装标识，来源、浏览器或存储变化可能占用新名额。
- Node.js：同名 `.mjs` 文件，先 `npm install`、设置 `SHROOM_LICENSE_KEY`，再 `node glove-left-example.mjs 实际串口`。串口来自 `process.argv[2]`，必须显式提供。示例调用 `./node/license-env.js` 的 `activateLicenseFromEnv()`，默认在用户目录 `.shroom-sdk/device-id` 保存并复用标识；不要每次随机生成，也不要要求新人自己编造 64 位值。
- 这些文件由 SDK 公共生成源 `examples/product-examples.js` 生成。读取有效帧、触按位置、断开与重连都验证后，再替换 `onData` 中的业务处理。不要把 Mock 运行成功、授权通过或串口打开当作实机数据通过。

需要前后端、渲染、录制与下载时，再使用[可选扩展](docs/QUICK-START.md#extensions)；不要让用户手写 WS 序列化或把帧无限塞进浏览器数组。以下是已完成准备后的 API 组合参考，不是完整生命周期示例：

```js
// Node.js，SDK 根目录的 .mjs 文件。
import { Shroom } from './node/index.js';
import { activateLicenseFromEnv } from './node/license-env.js';
// 读取密钥并复用稳定安装标识，再打开真实设备。
await activateLicenseFromEnv();
const device = await Shroom.connectGlove({ path: 'COM3', side: 'left' });
const server = await Shroom.serveDevice(device, { port: 19999, recordingsDir: './recordings' });
```

```js
// 浏览器，SDK web/ 目录中通过 HTTP 打开的页面。
import { Shroom } from './index.js';
const stream = await Shroom.connectStream({ port: 19999 });
const view = Shroom.createProductView('#view', { source: stream });
// 以下对应开始、停止和下载按钮，不要页面加载时连续执行。
await stream.startRecording({ label: '握拳' });
const recording = await stream.stopRecording();
stream.downloadRecording(recording.id, { format: 'csv' });
```

一次会话一个人工标签；Node.js 持续写入 JSONL 与元数据，停止等待写入完成，浏览器下载真实文件。`downloadRecording()` 同步返回 URL 并触发下载，不确认浏览器已保存完成，不能因此提示“下载完成”。CSV 数组和分区为 JSON 单元格，不是每通道单列。`serveDevice()` 默认仅本机回环和本机网页来源；跨机要显式配置 host / allowedOrigins / 前端地址，HTTPS 使用 wss 反代和自己的安全控制。关闭服务不自动关闭调用者设备，分别释放；浏览器断开不自动停止后台录制。具体生命周期以类型与快速文档为准。

浏览器直连（不需要 Node.js 转发时）：下列片段假设激活已单独完成，页面已有按钮与画布；首次接入用完整 HTML 示例。

```js
import { Shroom } from './sdk/web/index.js';

const heatmap = Shroom.createHeatmap('#view');       // #view 是一个 <canvas>

document.querySelector('#btn').onclick = async () => {
  const device = await Shroom.connectHandPad({       // ⚠️ 必须在点击回调里
    onData: (data) => heatmap.render(data),
    onError: (error) => console.error(error.code, error.suggestion),
  });
  window.addEventListener('pagehide', () => { void device.close().catch(console.error); }, { once: true });
};
```

Node / Electron：下列业务片段假设 SDK 产品授权已激活；完整文件还需捕获连接 Promise 并释放资源。

```js
import { Shroom } from './sdk/node/index.js';        // 需要先 npm i serialport

const device = await Shroom.connectGlove({
  path: 'COM3', side: 'left',
  onData: (data) => {
    console.log(data.fingers.thumb.raw);
    console.log(data.fingers.index.pulp.raw[0]);
    console.log(data.palm.matrix);
  },
  onError: (error) => console.error(error.code, error.suggestion),
});
process.once('SIGINT', () => { void device.close().catch(console.error); });
```

产品入口的 `onData / onError` 在打开串口前注册，避免漏掉首帧；连接前的失败仍用 `try / catch`。Node 省略 path 时只有恰好一个端口才自动选择，零口为 `PORT_NOT_FOUND`、多口为 `PORT_AMBIGUOUS`。浏览器可传已授权 `port` 或 `filters`，仍需用户手势。`side: 'left' | 'right'` 必须明确提供，不能通过 `packetType` 推断。

首帧可能早于连接 Promise 完成。`onData` 直接使用传入的 data，不要引用尚未初始化的外层 `const device`；回调确需设备时先声明 `let device` 并判空，或连接后使用 `device.onData()` 订阅。

产品入口不接受 `baudRate / delimiter / rows / cols / layout` 等协议覆盖。需要自定义协议继续使用 `Shroom.connect()`。没有硬件时用 `Shroom.mock({ rows: 32, cols: 32, fps: 30 })` 先验证基础矩阵显示；不要把它当成手套整包模拟器。

> **`mock()` 是同步的**（`connect()` 是 async）。写成 `await Shroom.mock()` 也不会出错——
> `await` 一个非 Promise 值就是它本身——所以两种写法都能跑。

### mock 产生的是什么数据

**两个高斯亮斑绕着中心转**（一大一小，反向旋转），外加一点底噪：

- 峰值 `max` 稳定在 **0.9 以上**，底噪约 0.01
- 亮斑**持续移动**，`center` 一直在变，绕中心画圈
- 默认 32×32、30fps；`fps` 必须是有限数值，范围为 `1000 / 2147483647` 至 `1000`（含边界，约 `4.657e-7` 至 `1000`），JS / Python 一致

**它能验证什么**：渲染、`center` 跟随、`max`/`area` 读数、曲线、录制回放——链路整体是通的。

**它不能验证什么**：
- **真实的按压节奏**。mock 的 `max` 一直很高、从不「松手」，所以**「按下→抬起」这类状态机在 mock 下不会触发**。
  测这类逻辑要么手动造数据，要么就得插真设备。
- 你的传感器实际的数值范围和噪声水平。

---

## 3. 通用 Frame 与产品数据

通用串口、Mock 与检测垫使用以下基础矩阵字段；Node.js / 浏览器产品设备的 `onData` 是 `onFrame` 别名。整包手套使用下方 `fingers / palm` 命名分区，不将整只手套当成规则矩阵：

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

产品字段只在 Node.js / 浏览器产品入口提供：

| 产品 | 原始压力 | 推荐业务字段 | 其他数据 |
| --- | --- | --- | --- |
| `hand` | `raw / pressure`，1024 个扫描顺序 ADC | `pressureMatrix` 为 1024 个 ADC，`values` 为 32×32 归一化值 | 内置 1000000 波特率、1024 点、mat32 |
| `handGloveFullPacket` | `raw / pressure`，256 个 ADC | `fingers.*.raw` 为五指主体；`fingers.*.pulp.raw` 为独立指腹；`palm.matrix` 为 72 点手掌 | `side / sequence / packetType / imu.raw`（16 字节） |

整包手套内置 921600 波特率，274 字节 payload = 1 字节序号 + 1 字节包类型 + 256 字节压力 + 16 字节 IMU，尾标记 `AA 55 03 99`。左右手映射由必填 side 决定；不提供物理压力单位、手势识别或 IMU 单位/姿态解算承诺。手套显示和算法直接使用五指、指腹与手掌分区，检测垫使用已映射的 `pressureMatrix / values`；不要再次调用 `decodeFrame()` 或套 layout。

整包手套新分区直接用命名属性，不按左右手对象顺序猜测：`data.fingers.thumb / index / middle / ring / little` 对应五指主体，每指 4×3、12 点；每指 `.pulp` 是独立 1×1 指腹点。`data.palm` 为手掌，rows=5、cols=15，但 rowLengths=`[12, 15, 15, 15, 15]`，实际 72 点，matrix 不补零，不要假定 raw.length=rows*cols。合计 137 个映射位置，不要求覆盖原 256 通道。

各 `GloveRegion` 字段为 `name`（中文）、`rows / cols`、`rowLengths: number[]`、`sourceIndices: Uint16Array`（按行展开的 0-based 原扫描索引，用户表点号已减 1）、`raw: Uint8Array`（ADC）、`values: Float32Array`（按父帧 fullScale 归一化）、`matrix: number[][]`（按真实行长排列的 ADC）。例如直接读 `data.fingers.thumb.raw`、`data.fingers.index.pulp.raw[0]`、`data.palm.matrix`。

手套分区按左右手点位表直接从原始 `pressure` 提取，不通过其他矩阵切片获得。区域 max/avg/重心等统计由应用从目标分区计算，不能把基础 Frame 的矩阵统计解释为五指与手掌整体统计。分区读数不是力学单位或弯曲角度。表中 btPacketSize=128 仅是元数据，不新增蓝牙或双包传输，仍使用 274 字节整包串口；Python 与通用 Mock 没有这些分区。

检测垫或通用矩阵按行列取点；手套使用上面的命名分区：

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

### 点位排列（画面位置对不上时看这里）

串口里的字节是**采集板的扫描顺序**，不等于垫子上的位置。不转换直接铺成方阵，
按垫子最上面一行，画面上亮的可能是中间那一行——数值是对的，位置是错的。

每种产品走线不同，猜不出来，按产品选一个：

```js
await Shroom.connect({ layout: 'carSeat' });
decodeFrame(payload, { layout: 'carSeat' });   // 自己接数据源时
Shroom.listLayouts();  // [{ name, label, rows, cols }, ...] 按「走线」列的
```

**新建整包手套 / 手部检测垫的连接菜单用 `Shroom.listDeviceProducts()`**，返回 `{ product, label, family, baudRate, payloadLength, sensorPoints, rows, cols }[]`，当前只有 `handGloveFullPacket / hand`，不查询硬件。以下旧通用矩阵菜单才用 `listProducts()`，不要用 `listLayouts()`。前者列的是产品
（手部检测、宠物看护、温度全床系统…，和公司桌面端菜单一字不差），后者列的是走线名
（`mat32`、`carSeat`…）。好几款产品共用一条走线，写走线名用户对不上自己那台设备。
下拉里**只写产品名，别加「（32×32）」这种行列后缀**，桌面端菜单里没有这些：

```js
Shroom.listProducts();
// [{ name: 'hand', label: '手部检测', layout: 'mat32', rows: 32, cols: 32 }, ...]

// 下拉里的 value 是产品名，解码要的是线序名，中间换一道
const p = Shroom.getProduct(select.value);
await Shroom.connect({ layout: p.layout });
// 'raw' 的产品（几款「高速」和「正常测试」）没有线序可问，行列要显式带上，
// 否则只能按帧长猜：1024 字节会被猜成 32×32，而 16*16高速 其实是 16×16
if (p.layout === 'raw') Object.assign(opts, { rows: p.rows, cols: p.cols });
```

**选了 `layout` 就不要再传 `rows` / `cols`**——排列自己知道这块垫子是几行几列，
比如 `car10` 是从 1024 个扫描点里取 10×10，`frame.rows / cols` 就是 10。

可选值：`raw`（不转换，默认）、`mat32`（32×32 压力垫，床垫 / 手部垫 / 眠枕 / 宠物垫都是它）、
`sit`、`bed1`、`carSeat`、`carBack`、`car10`、`car10Back`、`sit10`、`yanfeng10`、
`yanfeng10Back`、`volvo`、`volvoBack`、`volvoHead`、`smallM`、`rect`、`short`、
`matCol`、`sitCol`、`xiyue`、`carCol`、`sit100`、`endiSit`、`sofa`、`handSinglePoint`、
`wholeChair`（整椅坐垫）、`wholeChairBack`、`wholeChairHead`、`tempFullBed`、
`smallSample`、`footInsole`。

几点注意：

- 排列**只搬位置，不改数值**。正式上位机在某些产品上还会做坏点插值、空行填补、高斯柔化、
  压力换算，那些不在这个 SDK 里，所以同一帧的数字可能和正式上位机对不上，位置是对的。
- 有的产品有**没装传感器的空位**（如 `carCol` 中间那一列），这些位置固定是 0。
- 大多数产品一帧 1024 个点，`smallSample` / `footInsole` 是 256 个。排列自己知道要几个点，
  但**选了帧长对不上的排列，画面会大片空白**——用户说「一大半是黑的」先怀疑这里。
- `tempFullBed` 只给压力矩阵（12×15），那三个温度点不在排列里；用户要温度得自己从原始帧取。
- **整包手套 `handGloveFullPacket` 使用 JS 产品入口 `connectGlove({ side })`，不通过通用 layout 表接入。** 其他手套型号和 Python 手套接入仍需另行适配。

不知道用户手里是哪一款时**别猜**：让他打开网页测试台挨个换，按下去的位置和画面对上就是那个。

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
Shroom.connectGlove(options)          // → Promise<产品设备>，side 必填；协议内置
Shroom.connectHandPad(options?)       // → Promise<产品设备>，hand 检测垫
Shroom.connectProduct(options)        // → Promise<产品设备>，product 必填
Shroom.listDeviceProducts()           // → 已封装产品清单，不查询硬件
Shroom.mock(options?)                 // → Device，模拟数据
Shroom.createHeatmap(target, opts?)   // → Heatmap
Shroom.isSupported()                  // → boolean，当前浏览器能不能用串口
Shroom.version                        // '0.1.0'
```

也可以按名字导入，还额外导出了底层件（自己接别的数据源时用）：

```js
import {
  connectSerial, isSerialSupported, createHeatmap, createMockDevice,
  connectGlove, connectHandPad, connectProduct, listDeviceProducts,
  createFramer, decodeFrame, resolveShape, DEFAULT_DELIMITER,
  ShroomError, asShroomError, ERROR_CODES,
  jet, jetWhite, grey, getColormap,
} from './sdk/web/index.js';
```

### 4.2 Node 入口 `sdk/node/index.js`

```js
Shroom.connect(options?)     // → Promise<Device>，options.path 不填就自动挑第一个串口
Shroom.connectGlove(options) // → Promise<产品设备>，side 必填；可传 path/onData/onError
Shroom.connectHandPad(options?) // → Promise<产品设备>，可传 path/onData/onError
Shroom.connectProduct(options) // → Promise<产品设备>，product: 'handGloveFullPacket'|'hand'
Shroom.listDeviceProducts()  // → 已封装产品清单；与旧 listProducts 不同
Shroom.listPorts()           // → Promise<PortInfo[]>，列出机器上的串口
Shroom.mock(options?)        // → Device
Shroom.renderAscii(frame, o?) // → string，终端里的彩色方块图，直接 console.log
```

需要 `npm i serialport`（原生模块，按需加载；不装也不影响 mock 和 core）。

### 4.3 Device（连接后拿到的东西，两端一致）

```js
device.info            // { source: 'web-serial'|'node-serial'|'mock', rows, cols, baudRate|path|fps }
device.onFrame(fn)     // 订阅每一帧，返回一个「取消订阅」的函数
// 产品设备的 device.onData(fn) 是 onFrame 别名；也可创建时传 onData
device.onError(fn)     // 订阅运行期 ShroomError，返回取消订阅函数
device.state           // 'open' | 'closed' | 'error'
device.getDiagnostics() // 当前状态、计数、最近错误、status 和 hint
await device.close()   // 断开，幂等；不自动重连

// 串口为输入计数；Mock 为生成计数，不是串口吞吐
device.bytesReceived   // 收到或模拟生成的原始字节总数
device.frameCount      // 串口成功切出的 payload 数；Mock 生成的帧数
device.droppedCount    // 被丢掉的脏帧数
device.frameLength     // 串口锁定帧长；Mock 首帧前 0、首帧后为模拟点数
```

`onFrame` 可以订阅多个；一个回调抛错不影响其他回调。取消订阅：

```js
const off = device.onFrame(handler);
off();   // 不再收
```

> **`close()` 会自动清掉所有订阅**，不用先挨个 `off()` 再 `close()`。
> `off()` 只在「设备还连着，但某个模块不想再收了」时才需要。

`getDiagnostics()` 无参数，立即返回 `{ source, state, bytesReceived, frameCount, droppedCount, frameLength, lastError, status, hint }`，串口与 Mock 都支持。`status` 为 `waiting-data / waiting-frame / streaming / closed / error`；`hint` 提供排查建议。快照描述累计观测，不能自动判定根因；`streaming` 不证明仍在持续发送，也不保证产品、尺寸与线序正确。

查询和连接用 `try / catch`，连接后的读流、解析和设备错误用 `onError()`。错误统一为 `ShroomError`，有 `code / stage / suggestion / details / cause`；可具名导入 `asShroomError(error)` 归一化未知异常，`ERROR_CODES` 提供错误码常量。JS 串口读取、解析或断开错误会自动停止并尝试清理，应用可 `await device.close()` 确认清理结果。用户帧回调抛错同样可触发 `onError()`，码为 `CALLBACK_FAILED`、阶段为 `callback`，不会停止采集，不应当作设备断线。Mock 丢帧计数为 0，帧长在首帧前为 0、首帧后为模拟 payload 点数。

### 4.3.1 connect() 抛错的两种情况

用户在串口选择框上点「取消」也会抛错，**要和真正的连接失败分开处理**，
否则用户取消一下就看到一句「连接失败」，很莫名其妙：

```js
import { ERROR_CODES } from './sdk/web/index.js';
try {
  device = await Shroom.connect();
} catch (err) {
  // 用户主动取消：静默返回，什么都不用提示
  if (err?.code === ERROR_CODES.USER_CANCELLED) return;
  // 其余才是真的出问题了
  showError('连接失败：' + err.message);
}
```

原生选择框的 `NotFoundError / AbortError` 已归一化为 `USER_CANCELLED`；其他错误可展示 `message / suggestion`。诊断 `lastError` 和 `error.toJSON()` 不包含原始 `cause`，需要底层异常时读取捕获的错误对象。

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

以下为通用 `connect()` 的进阶参数；产品入口已固定协议与线序，不接受这些覆盖。高层参数和输出见[产品接入 API](docs/BACKEND-GUIDE.md#node-connect-product)。

```js
await Shroom.connect({
  baudRate: 1000000,                    // 默认 1000000
  delimiter: [0xAA, 0x55, 0x03, 0x99],  // 帧分隔符，默认就是这个
  layout: 'mat32',                      // 点位排列，按产品选，见 §3；不填就是 'raw' 不转换
  rows: 32, cols: 32,                   // 不填按方阵推断：1024 个点 → 32×32；给了 layout 就不用填
  fullScale: 255,                       // 满量程，默认 255
  threshold: 0.02,                      // 算 area / center 的有效点阈值
  lockLength: true,                     // 锁定帧长，默认开，见 §6
  filters: [{ usbVendorId: 0x1a86 }],   // 仅浏览器：过滤设备选择框
  path: 'COM3',                         // 仅 Node：端口号
});
```

串口、拆帧和解码参数在打开端口前严格校验。`rows / cols` 成对提供正整数；`baudRate`、长度范围、非空分隔符、`fullScale`、`threshold` 与 `layout` 都必须有效。配置失败也要向用户展示错误的 `stage / suggestion`，不要等到“没有画面”才排查。

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

想接自定义 WebSocket、蓝牙、文件回放中的原始字节流，用这两个就能拿到同样的 Frame；已有 Shroom 后端的 JSON 帧请用 `BackendSdkClient`，不要送进这两个函数：

```js
import { createFramer, decodeFrame } from './sdk/web/index.js';

const framer = createFramer();                    // 字节流 → 一帧一帧
for (const payload of framer.push(someBytes)) {   // push 返回本次切出的所有帧
  const frame = decodeFrame(payload, { layout: 'mat32' });  // 或 { rows: 32, cols: 32 }
  heatmap.render(frame);
}
```

`createFramer()` 返回 `{ push(chunk), reset(), droppedCount, frameLength }`。

`getLayout(name)` / `listLayouts()` 也在这一层，需要自己排布点位时用得上：
`getLayout('mat32').perm[显示位置]` 就是这个位置在扫描顺序里的下标，`-1` 表示这里没有传感器。
`getProduct(name)` / `listProducts()` 是它上面一层的**产品**表，给界面下拉框用。

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

把配置读取和 SDK 异步激活放在连接点击之前完成；激活成功后，再由用户单独点击连接。不要在串口按钮中先等待 `fetch` 或 `activateLicense()`。断开或授权失效后应更新界面状态，确认旧连接清理，再提供重新激活与连接入口。

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

通用帧的 `raw` 可能是原始 buffer 的视图，`values` 每帧都是新的；产品帧的 `raw / pressure` 是同一份帧内采样快照。要存起来或独立修改数据，
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
| 帧在涨、画面也正常，但按下去的位置不对 | 没选点位排列，画的是采集板扫描顺序 | 按产品传 `layout`，见 §3 |
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
├─ python/             Python 独立包，pip 本地安装
│  ├─ src/shroom_sdk/   ← from shroom_sdk import Shroom
│  └─ README.md         Python API、同步读取与示例
├─ start.mjs          本地服务器（根目录 = sdk/，端口 5178 起，占用则顺延到 5182）
└─ index.d.ts         TypeScript 类型定义
```

**JavaScript 只需要 import 两个入口之一**：`web/index.js` 或 `node/index.js`，
路径怎么写见 §0.5。其余文件不用读，本文已经涵盖了它们的全部对外行为。

> 唯一的例外是 §4.6 的 `createFramer` / `decodeFrame`——接非串口数据源时才用，
> 它们同样从入口文件导出，不用去 `core/` 里单独引。

---

## 10. 写代码时的默认选择

除非用户另有要求，按这个来：

- **整包手套 / 手部检测垫优先使用 `connectGlove()` / `connectHandPad()`，回调直接处理 onData。** 用户无设备时可先用通用 `Shroom.mock()` 验证基础矩阵功能，但它没有产品 onData 和手套附加字段。
- 默认先交付能运行的产品完整示例及六章操作路径，再按需求集成业务；只有需要前后端展示、带标签录制和下载时才扩展 WS 链路。只需直接连接设备时可用浏览器 Web Serial。用户需要 Python 时使用 `shroom_sdk` 基础能力，不要捏造 Python 产品、WS 或录制 API。
- 连接按钮的文案和禁用状态要处理好：先 `Shroom.isSupported()` 判断，
  不支持就禁用按钮并说明原因（是 `file://`？还是浏览器不对？），别让用户点了没反应。
- 数值一律按 0~1 显示，或者显示成百分比，**不要编造物理单位**。
- 做位置相关的功能时，手套直接使用 `fingers / palm` 命名分区，左右手由用户明确选择；检测垫直接使用已映射的 `pressureMatrix / values`。可直连产品菜单用 `listDeviceProducts()`；其他通用矩阵产品才使用旧 `listProducts()` 选择 layout，不要默认 raw 后假定位置正确。
- `onFrame` 里只做计算和 `heatmap.render()`，DOM 更新降频到 10Hz 左右。
- 需要本地起服务时提醒用户：不能双击 html 文件，要 `node start.mjs`（SDK 里自带）。
