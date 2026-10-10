# 后端 SDK API

按接口查阅串口、模拟数据、帧解析、点位配置、后端通讯和存储。每个接口列出用途、调用方式、参数、返回值、示例与注意事项；语言下拉框同时切换正文与本页目录。

## 环境与导入 {#setup}

<div data-sdk-language="node">

### Node.js 入口 {#node-import}

使用 Node.js 18+。在含有 `node/`、`web/` 和 `package.json` 的 SDK 解压目录运行：

```bash
npm install
```

```js
import { Shroom, BackendSdkClient, createFramer, decodeFrame, resolveShape,
  getLayout, listLayouts, getProduct, listProducts } from './node/index.js';
```

示例保存为根目录的 `.mjs` 文件，用 `node 文件名.mjs` 运行。真实串口依赖 `serialport`；没有原生 WebSocket 的 Node 环境按需使用 `ws`。模拟数据和核心解析不需要串口硬件。

</div>

<div data-sdk-language="python">

### Python 入口 {#python-import}

使用 Python 3.10+，进入含有 `python/` 的解压目录：

```bash
python -m pip install "./python[serial]"
```

```python
from shroom_sdk import Shroom, Framer, decode_frame, resolve_shape, get_layout
```

示例保存为 `.py` 文件，用 `python 文件名.py` 运行。串口需要 pySerial；Mock 与核心解析没有第三方运行依赖。Python 是同步读取模型，不提供 JavaScript 的帧回调接口。

</div>

SDK 使用 ZIP 或本地依赖安装，尚未发布公共 npm / PyPI 包。浏览器接入见 [前端通讯 API](FRONTEND-COMMUNICATION.md)，Canvas 见 [渲染 API](RENDERING.md)。

## 串口 {#serial}

<div data-sdk-language="node">

### Shroom.listPorts() {#node-list-ports}

**用途**：枚举当前机器的串口；具名函数 `listPorts()` 是相同入口。

**参数**：无。**返回值**：`Promise<PortInfo[]>`，无设备时为空数组。字段为 `path`，以及可选的 `manufacturer / serialNumber / vendorId / productId`。

**示例**：

```js
import { Shroom } from './node/index.js';
console.log(await Shroom.listPorts());
```

**注意事项**：需要 `serialport`。端口路径如 `COM3`、`/dev/ttyUSB0`，不是产品型号。

### Shroom.connect(options) {#node-connect}

**用途**：打开真实串口，自动分帧与解码。具名 `connectSerial(options)` 是同一入口。

**调用方式**：`await Shroom.connect(options)`。

| 参数 | 类型 | 默认值 / 说明 |
| --- | --- | --- |
| `path` | `string` | 可选，未提供时选择第一个端口；生产应用建议明确指定 |
| `baudRate` | `number` | `1000000`，与设备一致 |
| `delimiter / minLength / maxLength / lockLength` | 分帧选项 | 同 `createFramer()` |
| `rows / cols / points / fullScale / threshold / layout` | 解码选项 | 同 `decodeFrame()` |

**返回值**：`Promise<Device>`；失败拒绝 Promise，成功后用 `onFrame()` 接收帧。

**示例**：

```js
import { Shroom } from './node/index.js';
const device = await Shroom.connect({ path: 'COM3', baudRate: 1000000, rows: 32, cols: 32 });
const unsubscribe = device.onFrame((frame) => console.log(frame.max));
process.once('SIGINT', async () => { unsubscribe(); await device.close(); });
```

**注意事项**：端口不存在、占用或权限不足时失败；不要与上位机共用同一端口。JS `Device` 没有 `write()` 或 `device.on('error')`，运行中底层串口错误记录到控制台。

### Shroom.mock(options) {#node-mock}

**用途**：创建模拟设备；具名 `createMockDevice()` 相同。

| 参数 | 类型 | 默认值 / 说明 |
| --- | --- | --- |
| `rows / cols` | `number` | 各 `32` |
| `fps` | `number` | `30` |
| 其他解码选项 | `DecodeOptions` | 同 `decodeFrame()` |

**返回值**：同步 `Device`，不是 Promise。自动产生帧，结束时必须关闭。

**示例**：

```js
import { Shroom } from './node/index.js';
const device = Shroom.mock({ rows: 32, cols: 32, fps: 20 });
const unsubscribe = device.onFrame((frame) => console.log(frame.timestamp, frame.area));
try { await new Promise((resolve) => setTimeout(resolve, 1000)); }
finally { unsubscribe(); await device.close(); }
```

**注意事项**：JS Mock 没有随机种子参数，也没有真实串口的字节数或丢帧计数。

### device.onFrame(handler) {#node-on-frame}

**用途**：订阅串口或 Mock 每一帧。

**参数**：必填函数 `(frame: Frame) => void`，同步调用。**返回值**：`() => void` 取消订阅函数。

**示例**：已有连接 `device` 时：

```js
const unsubscribe = device.onFrame((frame) => console.log(frame.avg, frame.center));
// 结束这个监听：
unsubscribe();
```

**注意事项**：多个监听可以共存；回调异常会记录，其他监听继续。异步回调不会被等待，避免重计算与无限积累数据。

### device.close() {#node-close}

**用途**：停止 Mock 或关闭串口，并清理监听。

**参数**：无。**返回值**：`Promise<void>`。**示例**：`await device.close()`。

**注意事项**：在程序退出或组件卸载时显式释放设备。

### createFramer(options) {#node-framer}

**用途**：把字节流切成 payload，不连接串口、不解码数值。

| 参数 | 类型 | 默认值 |
| --- | --- | --- |
| `delimiter` | `number[]` | `[0xAA, 0x55, 0x03, 0x99]`，导出为 `DEFAULT_DELIMITER` |
| `minLength` | `number` | `8` |
| `maxLength` | `number` | `8192` |
| `lockLength` | `boolean` | `true` |

**返回值**：带 `push / reset / droppedCount / frameLength` 的切帧器。**示例**：`const framer = createFramer({ minLength: 8 })`。

**注意事项**：连续 3 个相同长度后锁定；锁定后不匹配帧丢弃，连续 12 帧新长度可重新锁定。两端分隔符界定完整 payload。

### framer.push(chunk) / reset() {#node-framer-push}

**用途**：追加字节并提取全部完整 payload；重置时清空缓存、锁定和计数。

| 接口 | 参数 | 返回值 |
| --- | --- | --- |
| `push(chunk)` | 必填 `Uint8Array` | `Uint8Array[]`；未成帧时为空数组 |
| `reset()` | 无 | `void` |

**示例**：

```js
import { createFramer, decodeFrame } from './node/index.js';
const framer = createFramer();
const packet = Uint8Array.from([0xAA, 0x55, 0x03, 0x99, 1, 2, 3, 4, 5, 6, 7, 8, 0xAA, 0x55, 0x03, 0x99]);
for (const payload of framer.push(packet)) console.log(decodeFrame(payload, { rows: 2, cols: 4 }));
framer.reset();
```

**注意事项**：跨 chunk 分隔符自动缓存。`droppedCount` 为丢弃帧数，`frameLength` 未锁定时为 `0`。

### decodeFrame(payload, options) {#node-decode-frame}

**用途**：把完整 payload 转为统一 `Frame`，适用于应用自己的数据源。

**参数**：必填 `payload: Uint8Array`，不含分隔符；可选选项见 [Frame 与解码参数](#frame)。

**返回值**：同步 `Frame`；非 raw 排列采用该排列尺寸，缺失采样点填 `0`。

**示例**：

```js
import { decodeFrame } from './node/index.js';
const frame = decodeFrame(Uint8Array.from([0, 64, 128, 255]), { rows: 2, cols: 2 });
console.log(frame.values, frame.center);
```

**注意事项**：`raw` 是 payload 子视图，长期保存应复制。默认满量程对应通常的 0～1；修改 `fullScale` 可能超过 `1`。不做物理压力标定。

### resolveShape(points, options) {#node-resolve-shape}

**用途**：按点数推断矩阵。

| 参数 | 类型 | 必填 / 默认值 |
| --- | --- | --- |
| `points` | `number` | 必填，采样点数 |
| `options.rows / options.cols` | `number` | 可选，应成对提供；两者有效时优先使用 |

**返回值**：`{ rows, cols }`；平方数为方阵，否则为 `1 × points`。

**示例**：`resolveShape(1024)` 得到 `{ rows: 32, cols: 32 }`。

**注意事项**：此函数不读取 `layout`，排列尺寸由 `decodeFrame()` 处理。

### getLayout(name) / listLayouts() {#node-layout}

**用途**：获取或枚举点位排列，不改变 ADC 数值。

| 接口 | 参数 | 返回值 |
| --- | --- | --- |
| `getLayout(name)` | 可选排列名，如 `'mat32'` | `{ rows, cols, perm: Int32Array }`；raw、未提供或未知名称为 `null` |
| `listLayouts()` | 无 | `{ name, label, rows, cols }[]` |

**示例**：

```js
import { getLayout, listLayouts } from './node/index.js';
console.log(listLayouts(), getLayout('mat32').perm[0]);
```

**注意事项**：`perm[显示位置]` 为原始下标，`-1` 表示空点。排列被缓存，不应修改。导出的 `LAYOUTS` 是排列定义集合，产品菜单用下面的接口。

### listProducts() / getProduct(name) {#node-products}

**用途**：提供产品名称、线序和尺寸，面向产品选择菜单。

| 接口 | 参数 | 返回值 |
| --- | --- | --- |
| `listProducts()` | 无 | `ProductInfo[]`，保持菜单顺序 |
| `getProduct(name)` | 产品标识，如 `'fast256'` | `{ name, label, layout, rows, cols }`；未知名称为 `null` |

**示例**：

```js
import { Shroom, listProducts, getProduct } from './node/index.js';
console.log(listProducts());
const product = getProduct('fast256');
if (!product) throw new Error('未知产品');
const device = Shroom.mock({ rows: product.rows, cols: product.cols, layout: product.layout });
await device.close();
```

**注意事项**：导出的 `PRODUCTS` 是原始定义数组。raw 产品必须传相应 `rows / cols`，查产品不会连接硬件。手套线序、协议外设备、多串口整椅采集不因此获得支持。

### Shroom.renderAscii(frame, options) {#node-ascii}

**用途**：转换为终端彩色热力图；具名 `renderAscii()` 相同。

| 参数 | 类型 | 默认值 / 说明 |
| --- | --- | --- |
| `frame` | `Frame` | 必填 |
| `options.width` | `number` | `32`，输出列数不超过原始列数 |
| `options.colormap` | 名称或函数 | `'jet'` |
| `options.gain` | `number` | `1`，仅影响显示 |

**返回值**：包含 ANSI 24 位背景色转义的 `string`，不自行打印。

**示例**：

```js
import { Shroom, decodeFrame } from './node/index.js';
const frame = decodeFrame(Uint8Array.from([0, 64, 128, 255]), { rows: 2, cols: 2 });
console.log(Shroom.renderAscii(frame, { width: 16 }));
```

**注意事项**：终端需支持 ANSI 真彩色；调色板见 [渲染 API](RENDERING.md#colormap)。Node.js 不提供 Canvas 渲染器。

</div>

<div data-sdk-language="python">

### Shroom.list_ports() {#python-list-ports}

**用途**：枚举系统串口；顶层 `list_ports()` 相同。

**参数**：无。**返回值**：`list[PortInfo]`，没有设备时为空列表。

**字段**：`path / description / manufacturer / serial_number / vendor_id / product_id`；USB ID 是整数或 `None`，与 Node.js 命名及类型不同。

**示例**：

```python
from shroom_sdk import Shroom
print(Shroom.list_ports())
```

**注意事项**：安装 `pyserial`，不是另一个名为 `serial` 的包。

### Shroom.connect(path, **options) {#python-connect}

**用途**：同步打开串口；顶层 `connect()` 返回同一类 `SerialDevice`。

| 参数 | 类型 | 默认值 / 说明 |
| --- | --- | --- |
| `path` | `str \| None` | `None`，仅单个端口时自动选择；多个端口必须指定 |
| `baud_rate` | `int` | `1_000_000`，正整数 |
| `delimiter / min_length / max_length / lock_length` | 分帧选项 | 同 `Framer()` |
| `rows / cols / points / full_scale / threshold / layout` | 解码选项 | 同 `decode_frame()` |

**返回值**：`SerialDevice`，支持 `with`、同步读取、写入与关闭，不是协程。

**示例**：

```python
from shroom_sdk import Shroom
with Shroom.connect("COM3", baud_rate=1_000_000, rows=32, cols=32) as device:
    frame = device.read_frame(timeout=5.0)
    if frame is not None:
        print(frame.max, frame.center)
```

**注意事项**：非法参数可抛 `ValueError`，缺依赖为 `ImportError`，串口失败为相应 I/O 异常。单线程负责读取；`with` 自动释放。

### Shroom.mock(**options) {#python-mock}

**用途**：创建同步模拟设备；顶层 `mock()` 相同。

| 参数 | 类型 | 默认值 / 说明 |
| --- | --- | --- |
| `rows / cols` | `int` | 各 `32`，正整数 |
| `fps` | `float` | `30`，有限正数 |
| `seed` | `int \| None` | `None`，可控制噪声随机种子 |
| 其他解码选项 | 关键字参数 | 同 `decode_frame()` |

**返回值**：`MockDevice`，按读取或迭代产生帧，没有后台采集线程。

**示例**：

```python
from shroom_sdk import Shroom
with Shroom.mock(rows=32, cols=32, fps=20, seed=1) as device:
    for index, frame in enumerate(device):
        print(frame.max)
        if index >= 19:
            break
```

**注意事项**：没有 JavaScript 的 `onFrame()`，使用同步读取接口。

### device.read_frame(timeout) {#python-read-frame}

**用途**：阻塞等待一帧，适用于串口与 Mock。

**参数**：`timeout: float | None`，默认 `1.0` 秒，有限正数；`None` 持续等待。

**返回值**：`Frame | None`，超时返回 `None`，不代表永久断线。

**示例**：`frame = device.read_frame(timeout=2.0)`，使用前检查是否为 `None`。

**注意事项**：关闭后读取抛 `RuntimeError`；不要在 UI 线程执行阻塞读取。

### device.frames(timeout) / 迭代 {#python-frames}

**用途**：连续产生帧；`for frame in device` 等价于默认 `frames()`。

**参数**：timeout 同 `read_frame()`，默认 `1.0` 秒。**返回值**：`Iterator[Frame]`；超时继续等待，不产出 `None` 或结束。

**示例**：

```python
from shroom_sdk import Shroom
with Shroom.mock() as device:
    for index, frame in enumerate(device.frames(timeout=1.0)):
        print(frame.timestamp)
        if index >= 2:
            break
```

**注意事项**：用 `break`、关闭或中断结束；无限迭代不是后台订阅。

### device.write(data) {#python-write}

**用途**：在真实 `SerialDevice` 上发送调用方提供的协议命令。

**参数**：必填 `data: bytes`，来自实际设备协议。**返回值**：实际写入字节数 `int`。

**示例**：已有连接与协议命令 `command` 时，`written = device.write(command)`。

**注意事项**：Mock 没有 `write()`；SDK 不内置启动、标定或归零命令。关闭后写入抛 `RuntimeError`，不能臆造命令。

### device.close() / with {#python-close}

**用途**：标记关闭、释放串口、清空待处理帧。

**参数**：无。**返回值**：`None`。**示例**：`device.close()`，推荐用 `with Shroom.connect(...) as device:`。

**注意事项**：可读取 `closed: bool`；重复关闭不再次操作设备，与 JS 异步关闭不同。

### Framer(**options) {#python-framer}

**用途**：构造切帧器，不打开设备。

| 参数 | 类型 | 默认值 |
| --- | --- | --- |
| `delimiter` | `bytes` | `bytes((0xAA, 0x55, 0x03, 0x99))`，导出为 `DEFAULT_DELIMITER` |
| `min_length` | `int` | `8`，至少 `1` |
| `max_length` | `int` | `8192`，不小于最小长度 |
| `lock_length` | `bool` | `True` |

**返回值**：带 `push / reset / dropped_count / frame_length` 的 `Framer`。

**示例**：`framer = Framer(min_length=8, lock_length=True)`。

**注意事项**：空分隔符或非法长度抛 `ValueError`。3 帧锁定、12 帧重新锁定规则与 Node.js 相同。

### framer.push(chunk) / reset() {#python-framer-push}

**用途**：追加字节并返回完整 payload；重置清空缓存和计数。

| 接口 | 参数 | 返回值 |
| --- | --- | --- |
| `push(chunk)` | 必填 `bytes / bytearray / memoryview` | `list[bytes]`，可以为空 |
| `reset()` | 无 | `None` |

**示例**：

```python
from shroom_sdk import Framer, DEFAULT_DELIMITER, decode_frame
framer = Framer()
packet = DEFAULT_DELIMITER + bytes(range(1, 9)) + DEFAULT_DELIMITER
for payload in framer.push(packet):
    print(decode_frame(payload, rows=2, cols=4))
framer.reset()
```

**注意事项**：payload 不含分隔符，为独立快照；错误字节类型抛 `TypeError`。未锁定 `frame_length` 为零。

### decode_frame(payload, **options) {#python-decode-frame}

**用途**：将一个完整 payload 解码为 `Frame`。

**参数**：必填 `bytes / bytearray / memoryview`，不含分隔符；选项见 [Frame 与解码参数](#frame)。

**返回值**：同步 `Frame`，`raw` 为字节快照，`values` 为 `array('f')`。

**示例**：

```python
from shroom_sdk import decode_frame
frame = decode_frame(bytes((0, 64, 128, 255)), rows=2, cols=2)
print(frame.values, frame.center.x)
```

**注意事项**：行列成对；`full_scale` 为有限正数，`threshold` 为有限非负数。非法类型抛 `TypeError`，非法值抛 `ValueError`。mat32 显式使用 `rows=32, cols=32`。

### resolve_shape(points, rows=..., cols=...) {#python-resolve-shape}

**用途**：推断矩阵尺寸。

| 参数 | 类型 | 默认值 / 说明 |
| --- | --- | --- |
| `points` | `int` | 必填，非负整数 |
| `rows / cols` | `int \| None` | 各 `None`，设置时必须成对且为正整数 |

**返回值**：`tuple[int, int]`；平方数为方阵，否则 `(1, points)`。

**示例**：`resolve_shape(1024)` 得到 `(32, 32)`。

**注意事项**：不是 JS 的对象返回值；只设一个维度抛 `ValueError`。

### get_layout(layout, rows, cols) {#python-layout}

**用途**：获取显示位置到原始下标的映射。

| 参数 | 类型 | 必填 / 说明 |
| --- | --- | --- |
| `layout` | `str / Sequence[int] / None` | 必填，raw 或 None 为原序；mat32 为内置排列；也可给自定义序列 |
| `rows / cols` | `int` | 必填，mat32 必须 `32 × 32` |

**返回值**：`tuple[int, ...] | None`；原序为 `None`。

**示例**：`get_layout([3, 2, 1, 0], 2, 2)` 得到 `(3, 2, 1, 0)`。

**注意事项**：自定义排列必须是完整 `0 .. rows*cols-1` 置换，不支持 `-1` 空点；未知内置名抛 `ValueError`。Python 没有完整 JS 产品表、`listProducts()` 或 `listLayouts()`。

### Shroom.render_ascii(frame, width=..., gain=...) {#python-ascii}

**用途**：产生纯字符热力图；顶层 `render_ascii()` 相同。

| 参数 | 类型 | 默认值 / 说明 |
| --- | --- | --- |
| `frame` | `Frame` | 必填 |
| `width` | `int` | `32`，正整数，输出列数不超过原始列数 |
| `gain` | `float` | `1.0`，有限正数 |

**返回值**：`str`，使用 ` .:-=+*#%@` 字符，没有 ANSI 颜色。

**示例**：

```python
from shroom_sdk import Shroom, decode_frame
frame = decode_frame(bytes((0, 64, 128, 255)), rows=2, cols=2)
print(Shroom.render_ascii(frame, width=16, gain=1.0))
```

**注意事项**：没有 JS 的 colormap 参数；可选 Matplotlib 图形示例不是 Canvas API。

</div>

### Frame 与解码参数 {#frame}

连接、Mock 与直接解码共用下表；Python 用关键字参数，JS 放进 options。

| Node.js / Python 参数 | 类型 | 默认值 / 说明 |
| --- | --- | --- |
| `rows / cols` | 整数 | 未提供时按点数推断；非方阵显式指定 |
| `points` | 整数 | payload 长度，只取前 N 字节，上限为 payload 长度 |
| `fullScale / full_scale` | 数值 | `255`，归一化分母 |
| `threshold` | 数值 | `0.02`，有效点统计阈值 |
| `layout` | 排列 | `'raw'`，两语言支持范围不同 |

| Frame 字段 | JS / Python 类型 | 含义 |
| --- | --- | --- |
| `raw` | `Uint8Array / bytes` | 原始字节，0～255，保持扫描顺序 |
| `values` | `Float32Array / array('f')` | 按显示排列输出，长度为 rows × cols |
| `rows / cols` | `number / int` | 输出矩阵形状 |
| `min / max / avg` | `number / float` | 输出矩阵极值与平均值 |
| `area` | `number / int` | 大于阈值的点数，不是物理面积 |
| `center` | `{ x, y } / Center` | 0～1 重心，无有效点时 (0.5, 0.5) |
| `timestamp` | `number / int` | Unix 毫秒时间戳 |

默认满量程下通常为 0～1 相对 ADC，不是 kPa / N。Python 使用 `center.x / center.y`；后端网络 JSON 不等于此 Frame。

### 设备信息与诊断 {#diagnostics}

| Node.js / Python 字段 | 说明 |
| --- | --- |
| `info` | 来源、端口、波特率或 Mock 配置；未推断行列可能为空 |
| `bytesReceived / bytes_received` | 真实串口收到的字节数，为零时优先检查设备发送 |
| `frameCount / frame_count` | 成功切出的 payload 数；字节增长而它不增长时检查协议 |
| `droppedCount / dropped_count` | 无效或不匹配锁定长度的丢帧数 |
| `frameLength / frame_length` | 已锁定帧长，未锁定为零 |

计数仅在真实串口设备上提供。info 的行列为调用配置，应以实际 Frame 的尺寸为准。真机排错见 [串口参考](SERIAL.md)。

## 通讯 {#communication}

已有后端连接设备时，用 HTTP 查询 / 控制、WebSocket 订阅。客户端不启动后端，也不直接打开客户端本机串口。开发者网站与 Shroom Monitor 本身不提供以下后端接口。

<div data-sdk-language="node">

### new BackendSdkClient(options) {#backend-client}

**用途**：创建已有后端网络客户端；浏览器也有同名类。

| 参数 | 类型 | 默认值 / 说明 |
| --- | --- | --- |
| `httpBaseUrl` | `string` | `'http://127.0.0.1:19245'` |
| `wsUrl` | `string` | `'ws://127.0.0.1:19999'`，独立配置 |
| `timeoutMs` | `number` | `10000` 毫秒，有限正数 |
| `headers` | `HeadersInit` | `{}`，HTTP 请求头 |
| `contract / routes` | 对象 | 可选已知契约 / 路由覆盖 |
| `fetchImpl / WebSocketImpl` | 函数 / 构造器 | 环境实现；Node 按需使用 ws |

**返回值**：`BackendSdkClient`，构造不发请求。

**示例**：

```js
import { BackendSdkClient } from './node/index.js';
const client = new BackendSdkClient({ httpBaseUrl: 'http://127.0.0.1:19245', wsUrl: 'ws://127.0.0.1:19999' });
```

**注意事项**：URL 不接受内嵌凭据、query 或 hash。HTTP headers 不等于浏览器 WS 鉴权；鉴权由后端负责。

### client.getContract(options) {#backend-contract}

**用途**：查询并缓存契约，更新 HTTP 路由与订阅消息类型。

**参数**：可选 `{ refresh: boolean }`，默认 `false`。**返回值**：`Promise<BackendContract>`。

**示例**：`await client.getContract()`；强制刷新用 `await client.getContract({ refresh: true })`。

**注意事项**：已有契约且不刷新时不发请求；显式 routes 覆盖优先于契约。

### HTTP 查询接口 {#backend-queries}

**用途**：只读查询状态和元数据。下表均返回 Promise，字段由后端定义。

| 接口 | 参数 | 返回结果 |
| --- | --- | --- |
| `getChannels()` | 无 | 原始 JSON 包 |
| `getWsStatus()` | 无 | 原始 JSON 包 |
| `listDisplaySystems()` | 无 | 原始 JSON 包 |
| `getDisplaySystem(id)` | 必填 string ID | 原始 JSON 包 |
| `listSerialPorts()` | 无 | 已解包数据 |
| `getSerialStatus(role?)` | 可选 string；省略不带 role 查询条件 | 已解包数据 |
| `getCurrentSensor()` | 无 | 已解包数据 |

**示例**：`console.log(await client.listSerialPorts(), await client.getSerialStatus('sit'))`。

**注意事项**：已解包方法将 `{ code: 0, data }` 返回为 data，原始包方法保留外层；非零业务码仍抛错。逐接口说明见 [BackendSdkClient API](../BACKEND.md#queries)。

### 设备与采集控制 {#backend-controls}

**用途**：显式请求后端改变状态，不会自动执行。

| 接口 | 参数 / 默认值 | 返回值 |
| --- | --- | --- |
| `setSensorType(type)` | 必填后端认可的 string 类型 | `Promise<unknown>` 已解包数据 |
| `openSerial(options)` | role='sit'；port/path/portPath 至少一个，按此顺序选择 | 同上 |
| `closeSerial(options?)` | role='sit' | 同上 |
| `startCollection(options?)` | 后端定义对象，默认 {} | 同上 |
| `stopCollection()` | 无 | 同上 |

**示例**：确认设备后，`await client.openSerial({ role: 'sit', port: 'COM3' })`；结束用 `await client.closeSerial({ role: 'sit' })`。

**注意事项**：操作后端机器的端口，写操作不自动重试。采集文件、路径和数据库结构由后端决定。

### client.connectRealtime(options) {#backend-realtime}

**用途**：建立 WS；打开后订阅所选通道。

| 参数 | 类型 | 默认值 |
| --- | --- | --- |
| `channels` | `string / string[]` | `[]`，不自动订阅通道 |
| `timeoutMs` | `number` | 客户端 timeoutMs，毫秒 |
| `protocols` | `string / string[]` | 未指定，WS 子协议 |

**返回值**：立即返回 `WebSocket`，不是 Promise；用 open 事件确认就绪。

**示例**：

```js
import { BackendSdkClient } from './node/index.js';
const client = new BackendSdkClient();
await client.getContract();
client.on('error', (error) => console.error(error.message));
client.on('frame', (frame) => console.log(frame.channelId, frame.value));
client.connectRealtime({ channels: ['sit'] });
process.once('SIGINT', () => client.disconnectRealtime());
```

**注意事项**：没有自动重连。`disconnectRealtime()` 返回 void，清理连接和定时器并发出 close；后端没有发送设备数据时可收到零帧。

### subscribe / unsubscribe / sendRealtime {#backend-subscriptions}

**用途**：在已打开连接上管理订阅或发送 JSON。

| 接口 | 参数 | 返回值 |
| --- | --- | --- |
| `subscribe(channels)` | 必填 string/string[]，非空字符串去重 | void |
| `unsubscribe(channels)` | 同上 | void |
| `sendRealtime(message)` | 必填可 JSON 序列化的值 | void |

**示例**：`client.on('open', () => client.subscribe(['sit', 'back']))`。

**注意事项**：连接未打开时抛错，不排队重放。消息必须符合后端协议。

### on / once / off / removeAllListeners {#backend-events}

**用途**：管理事件监听；均返回客户端自身。

| 接口 | 参数 |
| --- | --- |
| `on(event, handler)` | 必填事件名和函数，持续监听 |
| `once(event, handler)` | 必填事件名和函数，仅一次 |
| `off(event, handler)` | 同一函数，移除对应监听 |
| `removeAllListeners(event?)` | 省略事件名时移除全部 |

| 事件 | 回调参数 |
| --- | --- |
| open | 无 |
| close | 关闭事件 |
| error | Error |
| message | 已解析消息 |
| frame | 后端原始 JSON 帧，批量消息逐帧分发 |
| raw | 无法解析为 JSON 的字符串 |

**示例**：`const handler = (frame) => console.log(frame); client.on('frame', handler); client.off('frame', handler)`。

**注意事项**：HTTP 失败由 Promise 拒绝，不自动触发 error。网络帧不自动归一化、点位重排或转为统一 Frame。

### client.request() / route() {#backend-request}

**用途**：通用 HTTP 请求和命名路由解析。

**调用方式**：`await client.request(routeOrName, options)` / `client.route(name, params)`。

**参数**：request 默认 GET、客户端超时，支持 JSON body、query、routeParams、headers、signal、raw；完整表见 [通用 HTTP 请求](../BACKEND.md#request)。route 必填路由名，路径参数需要齐全。

**返回值**：request 为 `Promise<T>`，route 为编码后的根相对路径 string。

**示例**：`await client.request('serialStatus', { query: { role: 'sit' }, timeoutMs: 5000 })`。

**注意事项**：只允许配置后端下的根相对路径，不接受任意远程 URL。

</div>

<div data-sdk-language="python">

### Python 网络通讯支持范围 {#python-network}

**当前 Python SDK 未包含 `BackendSdkClient`，没有已有后端的 HTTP / WebSocket 客户端、通道订阅或采集控制接口。**

Python 可直连串口，在应用中分析和保存。后端已占用设备时，使用现有 Node.js 客户端订阅，或自行开发符合 [后端 API 契约](../BACKEND.md) 的 Python 网络适配；不能调用不存在的 Python SDK 方法。

</div>

## 存储 {#storage}

SDK 提供实时帧，长期文件与数据库由应用实现。以下区分已提供的帧转换方法与应用侧保存示例。

<div data-sdk-language="node">

### 帧快照与 JSONL（应用示例） {#node-save}

**用途**：复制帧中的字节视图，再写文件。这不是新增 SDK save() API。

**输入**：Frame。**输出**：应用快照对象和 UTF-8 frames.jsonl。

**示例**：最多缓存 100 帧，短时采集后写入：

```js
import { writeFile } from 'node:fs/promises';
import { Shroom } from './node/index.js';
const snapshots = [];
const device = Shroom.mock({ rows: 32, cols: 32, fps: 20 });
const unsubscribe = device.onFrame((frame) => {
  if (snapshots.length >= 100) return;
  snapshots.push({ timestamp: frame.timestamp, rows: frame.rows, cols: frame.cols,
    raw: Array.from(frame.raw), values: Array.from(frame.values),
    min: frame.min, max: frame.max, avg: frame.avg, area: frame.area, center: { ...frame.center } });
});
try { await new Promise((resolve) => setTimeout(resolve, 2500)); }
finally { unsubscribe(); await device.close(); }
await writeFile('frames.jsonl', snapshots.map((frame) => JSON.stringify(frame)).join('\n') + '\n', 'utf8');
```

**注意事项**：持续采集需要有界队列、批量落盘、文件轮转与磁盘异常处理，不应无限积累帧。

</div>

<div data-sdk-language="python">

### frame.to_dict() {#python-to-dict}

**用途**：生成 JSON 可序列化快照，保留与 JS 一致的字段名。

**参数**：无。**返回值**：dict；raw/values 变为列表，center 变为 `{ "x": ..., "y": ... }`。

**示例**：

```python
import json
from shroom_sdk import decode_frame
frame = decode_frame(bytes((0, 64, 128, 255)), rows=2, cols=2)
print(json.dumps(frame.to_dict(), ensure_ascii=False))
```

**注意事项**：只转换，不写文件或入库；不能直接把含 array/Center 的对象假设成可序列化字典。

### frame.matrix() {#python-matrix}

**用途**：按行列返回二维 values，无需 NumPy。

**参数**：无。**返回值**：`list[list[float]]`，rows 行、cols 列，行优先。

**示例**：`matrix = frame.matrix()`。

**注意事项**：数值是解码后的相对值，不是原始字节或物理单位。

### 写入 JSONL（应用示例） {#python-save}

**用途**：用 Python 标准库保存有限帧，不是 SDK 数据库接口。

**输入**：Frame。**输出**：UTF-8 JSONL 文件。

**示例**：

```python
import json
from shroom_sdk import Shroom
with Shroom.mock(fps=20) as device, open("frames.jsonl", "w", encoding="utf-8") as output:
    for index, frame in enumerate(device):
        output.write(json.dumps(frame.to_dict(), ensure_ascii=False) + "\n")
        if index >= 99:
            break
```

也可运行 CLI：`python -m shroom_sdk --frames 100 --json > frames.jsonl`。省略端口为 Mock；真实设备加 `COM3 --rows 32 --cols 32`。重定向编码由 shell 决定。

**注意事项**：示例会覆盖同名输出文件；真实应用需设计文件名、异常处理与轮转。

</div>

### 数据库与能力边界 {#storage-boundary}

SDK 没有内置数据库、历史查询、CSV 导出、录制回放、力学标定、手势算法或付费许可校验。Node.js 的 startCollection() 只请求已有后端，Python 没有此网络控制接口。

长期保存由采集程序或应用后端实现，并记录协议、产品、点位配置和采样信息。更多见 [数据存储参考](STORAGE.md)。
