# 按需接入：Shroom SDK 0.3.0

先用项目锁文件、`npm ls shroom-sdk` 和对应类型声明核对实际版本，再使用这些片段。只做用户需要的部分，变量应接入真实业务选择与配置。浏览器项目需支持包名导入的构建工具。

在业务项目中运行 `npm install shroom-sdk` 安装 SDK。人体与鞋垫从 **0.3.0** 起支持；已有较旧版本的项目可执行 `npm install shroom-sdk@0.3.0` 升级并更新锁文件，再用 `npm ls shroom-sdk` 或运行时 `Shroom.version` 核对实际版本。安装 Skill 不会改变 SDK 依赖。若用户提供 TGZ 或本地源码，按其真实路径和 README 使用对应依赖与入口，不把内部文件复制进业务项目；离线 TGZ 安装需保留安装包与锁文件。

Node 服务与网页项目都要安装相同且至少为 0.3.0 的版本，并重新构建前端；只升级 Node 不能让旧 0.2.0 浏览器 WS 解码器识别 `humanBody / jqInsole`。

## 1. Node：搜索串口

```js
import { listPorts } from 'shroom-sdk/node';

try {
  const ports = await listPorts();
  console.table(ports); // 用 path 和厂商信息填充选择框，让用户选择。
  if (ports.length === 0) console.log('未发现串口，请检查驱动和 USB 连接。');
} catch (error) {
  console.error(error.code, error.message); // 查询失败与空列表分别提示。
}
```

Windows path 可能是 `COM3`，macOS/Linux 使用查询结果中的完整路径。这里不连接设备，也不识别型号；后续片段中的 COM3 必须替换为用户选择的 path。

## 2. Node：授权后一步取数

```js
import { Shroom } from 'shroom-sdk/node';
import { readProduct } from 'shroom-sdk/quick-flow';

// 由客户在本机提供，禁止硬编码真实密钥或提交到仓库。
const key = process.env.SHROOM_LICENSE_KEY;
const deviceId = process.env.SHROOM_DEVICE_ID;
// 标识应由应用持久保存，使用 64 位小写 hex，不能每次启动重新随机生成。
if (!key || !deviceId) throw new Error('请先在本机配置 SDK 密钥与稳定安装标识。');

let device;
try {
  await Shroom.activateLicense(key, { deviceId });
  device = await readProduct({
    product: 'glove',
    path: 'COM3', // 替换为用户选中的串口。
    side: 'left', // 按实物选择 left/right；不要推断。
    onData(data) {
      console.log(data.fingers, data.palm, data.imu.raw);
    },
    onError: error => console.error(error.code, error.message),
    onStateChange: status => console.log(status.state, status.attempt),
  });
} catch (error) {
  console.error(error.code, error.message); // 首次失败不会后台重试。
  throw error;
}
// 只需要取数时到这里即可；应用退出时 await device.close()。
```

按实际产品替换上例参数与 `onData`，WS 和采集三个按钮的调用保持不变：

| 产品别名 / 规范 ID | 连接参数 | 读取字段 |
| --- | --- | --- |
| `glove` / `handGloveFullPacket` | 必须明确左右手 `side` | `fingers`、`palm`、`imu.raw` |
| `pad` / `hand` | 不传 `side` | `pressureMatrix`、`values` |
| `body` / `humanBody`（0.3.0） | 不传 `side`；固定 1000000 baud | `regions.back.raw` 等十个源矩阵 |
| `insole` / `jqInsole`（0.3.0） | 必须明确左右脚 `side`；`protocol` 默认 `'12bit'` 或显式 `'8bit'`；默认 921600 baud | `sensors.raw / values / positions`、`imu` |

人体与鞋垫只改变取数配置，不增加第六个快速函数。规范 ID 用于返回帧和 WS；新增其他产品仍须扩展 SDK 适配器与注册表，不能仅在业务中虚构字符串。

```js
// 人体：沿用已完成的授权，path 替换为用户选中的串口。
device = await readProduct({
  product: 'body', path: 'COM3',
  onData: data => console.log(data.regions.back.raw),
  onError: error => console.error(error.code, error.message),
});
```

```js
// 鞋垫：用这一配置替换上面的取数调用；左右脚各自建立连接。
device = await readProduct({
  product: 'insole', path: 'COM3',
  side: 'left',       // 按实物确认，不通过压力或串口名称推断。
  protocol: '12bit',  // 按固件选择；8-bit 设备传 '8bit'。
  onData: data => console.log(data.sensors.raw, data.imu.quaternion),
  onError: error => console.error(error.code, error.message),
});
```

这两个片段放入与上例相同的 `try/catch` 和退出清理中，按选定产品只运行一个，切换前释放已有连接。鞋垫允许的其他 `baudRate` 为 `1500000 / 3000000 / 460800 / 256000 / 115200 / 9600`；仅按已知固件配置传入，不自动扫描协议或速率。

### 新产品数据不能混用的地方

- **人体**：`raw / pressure` 是 1024 个 `Uint8` 扫描 ADC，`pressureMatrix / values` 按原序排成 32×32 存储形状，不能直接当人体平面；空间重心也不能从顶层 `center` 推断。`regions` 为 `back / chest / rightArm / rightShoulder / leftArm / leftShoulder / backPantsRight / backPantsLeft / frontPantsLeft / frontPantsRight`。每区的 `sourceIndices` 是 0 基 `Uint16Array`，可到 1023；`raw / values / matrix` 对应同一批原始通道，十区合计 400 个唯一点。名称保持源表 key，不自行翻转成模型左右；没有显示插值或重复行。
- **鞋垫 ADC**：`raw` 是原始 **ADC 字节**，12-bit 为 512 字节（每点两个字节，小端），8-bit 为 256 字节，均不含头和 IMU。`pressure / pressureMatrix` 是 256 个扫描 ADC，12-bit 用 `Uint16Array`、范围 0–4095；8-bit 用 `Uint8Array`、范围 0–255。`values` 对应 ADC / `fullScale`（4095/255）；不要对产品帧再次 `decodeFrame`、套 8-bit 满量程或改写原始值。
- **鞋垫真实点**：`sensors` 是 A 版 112 点（14×8），含 `raw / values / sourceIndices / positions`；坐标为 `{ row, col, xMm, yMm }`。112 个点不是源页面插值后的 224 点，顶层 16×16 扫描矩阵也不是鞋形图。左右脚使用各自线序，不能自动镜像、猜脚跟方向或计算未经标定的物理足底重心。
- **鞋垫 IMU**：`imu.raw` 在 12-bit / 8-bit 分别是 40 / 16 字节；两种协议均有原始 `quaternion`，按 w/x/y/z；仅 12-bit 另有 `gyroscope / acceleration`，各三个原始分量。SDK 不归一化四元数、不推断单位或融合姿态；不要声称已输出欧拉角。8-bit 才有 `sequence`，不把该分段 index 当设备时钟。
- **展示与验证**：人体/鞋垫没有现成 `createProductView` 渲染器，应用自行消费字段。合成帧与 WS/SQLite/HTTP 测试只验证软件通路，尚未经过真实设备验收。

Node 产品重连默认值可用 `reconnect: { intervalMs: 3000, maxAttempts: 3 }` 显式表示。重连后收到有效帧才清零次数，状态订阅不会替代 onData。

### 需要断公网使用时

上例按在线密钥激活。只有**不限电脑数量、未过期且具备所需功能的 RSA 离线码**可纯本地验签；这时由客户本机提供离线码，前置检查只要求 key（无需 deviceId），将激活调用改为：

```js
await Shroom.activateLicense(key, { mode: 'offline' }); // key 此时是客户的 RSA 离线码。
```

限制电脑数量的 RSA 离线码仍须传稳定 `deviceId` 并联网登记；它与在线密钥都会约每 30 秒复核，单次授权最长 60 秒且不超过到期时间，没有离线租约缓存。公网中断不能保证继续采集。授权失效会关闭串口并结束记录；恢复授权后需重新连接设备、启动服务，并由用户开始新记录。不要将 `.env` 中的模式变量当成 SDK 会自动读取的配置。

## 3. 需要网页时：Node 创建 WS，浏览器连接一次

Node 在上面的 device 创建成功后执行：

```js
import { createWS } from 'shroom-sdk/quick-flow';

let server;
try {
  server = await createWS(device, { port: 19999 });
  console.log(server.url); // 默认本机 ws://127.0.0.1:19999。
} catch (error) {
  console.error(error.code, error.message); // 创建失败时 SDK 会释放 device。
  throw error; // 交给应用错误提示，不能继续使用已释放的设备。
}
// 程序退出时 await server.close()，同时释放设备。
```

浏览器调用；以下连接属于网页，不能直接搜索本机串口：

```js
import {
  readProduct, startRecording, stopRecording, downloadRecording,
} from 'shroom-sdk/quick-flow';

let stream;
try {
  stream = await readProduct({
    url: 'ws://127.0.0.1:19999',
    onData: data => console.log(data), // 根据已选择的产品处理其真实字段。
    onError: error => console.error(error.code, error.message),
  });
} catch (error) {
  console.error(error.code, error.message); // 提示用户确认 Node 服务已启动。
  throw error; // 交给页面错误状态，不启用采集按钮。
}
```

连接失败交给页面的 try/catch 和错误提示。默认只服务同一台电脑；跨主机部署要查 `host / allowedOrigins`，HTTPS 页面使用 WSS，不为图方便开放任意来源。

## 4. 需要保存时：分别接到三个按钮

```js
// “开始采集”按钮：此后才开始保存，不能在页面初始化时直接连续起停。
await startRecording(stream, { label: '本次采集' });
```

```js
// “停止采集”按钮：等待 SQLite 写完，并保留本次记录 ID。
const recording = await stopRecording(stream);
console.log(recording.id, recording.status);
```

```js
// “下载”按钮：下载同一 stream 刚停止的记录。
downloadRecording(stream, { format: 'csv' }); // 完整帧用 'jsonl'。
```

每个异步按钮处理器捕获失败，操作中禁用重复点击；开始新记录后需等新记录停止再下载。`downloadRecording` 同步返回 URL，浏览器触发下载；传入 Node server 时只返回 HTTP URL，不等于文件已经写入客户磁盘。历史记录用基础 `listRecordings / downloadRecording(id)`，不要把数据库内部表当成公共 API。

### 串口断线与网页断线分别处理

- **串口断线**：当前记录以 error 收尾，仍保留已接收数据。串口重连只恢复实时取数，用户需显式开始新记录。原 stream 仍连接时，可调用 `stopRecording(stream)` 取得这次结束结果，再下载已保存部分。
- **网页 WS 断线或关闭**：Node 录制继续，WS 客户端不会自动重连或重发起停命令。重新调用浏览器 `readProduct({ url, ... })` 后，先 `await stream.getRecordingStatus()` 核对实际状态，不能直接再次 start。请求超时也应先查状态，不能认定服务端没有执行。
- **重建 stream 后下载**：新 stream 没有旧快速流程的记录 ID。已结束的历史记录通过 `await stream.listRecordings()` 展示并让用户选择，随后用基础 `stream.downloadRecording(id, { format: 'csv' })`；id 必须来自真实记录，不能用标签或端口代替。若记录仍在进行，按用户操作先停止，再下载。快速 `downloadRecording(stream)` 不会自动找回旧记录。

正常退出网页前明确停止本次采集，再 `await stream.close()`；不要用关闭 WS 来代替停止采集。

## 可选的深入参考

本文件包含完成基础接入所需的规则与片段，无需联网即可使用。需要完整参数或扩展能力时，再查对应版本类型或以下文档：

- [五步接入](https://sdk.jq-industries.com/docs/quick-start)：环境准备、调用流程。
- [基础 API](https://sdk.jq-industries.com/docs/backend)：产品参数、重连和诊断字段。
- [SDK 授权](https://sdk.jq-industries.com/docs/license)：稳定安装标识和授权边界。
- [采集存储](https://github.com/liudada118/shroomSDK/blob/main/docs/STORAGE.md)：数据库与导出语义。
- [产品适配器](https://github.com/liudada118/shroomSDK/tree/main/src/core/products)：扩展新的产品协议。

人体和鞋垫详情查对应版本源码的 `docs/HUMAN-BODY.md`、`docs/INSOLE.md`；精简 npm 包以附带类型声明为准。排查旧项目时以实际安装版本为依据，不用远端 main 的新字段替代旧版合同。

在线文档可能随 SDK 更新；与本机版本不一致时先核对包的类型和对应版本源码，明确差异。
