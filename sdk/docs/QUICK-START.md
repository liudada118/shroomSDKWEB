# 快速接入：真实设备取数与应用集成

按六章完成实机取数：**环境准备 → 产品与参数 → 下载并运行 → 授权与连接 → 验收与结束 → 集成到项目**。本主线适用于浏览器 JavaScript / Node.js 已封装的整包手套 `handGloveFullPacket` 和手部检测垫 `hand`。读取设备数据不要求启动 WS、录制或文件下载；这些能力保留在文末[可选扩展](#extensions)。新硬件与协议进入[基础文档](CUSTOM.md)。

## 准备环境与 SDK 密钥 {#guide-prepare}

**前置**：准备设备、支持数据传输的 USB 线和连接设备的电脑。

**操作**：先安装对应系统的串口驱动，再准备运行环境。CH34x 设备缺少可用驱动时，系统无法提供串口，SDK 与浏览器都读不到设备。

- [Windows 驱动 CH341SER.EXE](https://shroom.jq-industries.com/drive/CH341SER.EXE)：安装后重新插拔，在“设备管理器 → 端口 (COM 和 LPT)”确认实际端口。
- [macOS 驱动 CH34xVCPDriver.zip](https://shroom.jq-industries.com/drive/CH34xVCPDriver.zip)：解压并按安装说明操作，重新插拔后用 `ls /dev/cu.*` 核对新增串口。
- Linux 先确认系统串口与当前用户权限；驱动和权限排查见[驱动安装与排查](DRIVERS.md)。

| 使用环境 | 本主线要求 | 能力边界 |
| --- | --- | --- |
| 浏览器 JavaScript | 支持 Web Serial 的桌面 Chrome / Edge；localhost 或 HTTPS；本地示例启动需 Node.js 18+ | 可直接连接整包手套或手部检测垫，连接必须由用户点击触发 |
| Node.js / Electron | Node.js 18+，安装 SDK 的串口依赖 | 可直接连接同样两个产品，连接时指定实际系统端口 |
| Python | Python 3.10+，按 [Python 文档](../python/README.md) 安装独立包 | 当前是基础串口、模拟与矩阵解析；没有本篇的产品快捷接口、整包手套协议或 WS 录制链路 |

SDK 授权**不限制传感器型号**，仍校验 SDK 产品密钥、有效期、功能和电脑名额。上位机密钥不能启用 SDK；放开型号授权不代表任意通信协议都已适配。准备方式见[SDK 授权](LICENSE.md)。

**完成标志**：系统已能看到设备端口，运行环境已确认，并已向交付方取得有效 SDK 产品密钥。浏览器弹出选择框不等于系统驱动已安装；没有端口时先完成驱动排查。

## 确认产品与运行参数 {#guide-config}

**前置**：环境准备完成，并确认实际设备是整包手套还是手部检测垫。

**操作**：按产品选示例。手套左右手由用户按实物指定；SDK 不会根据包类型或串口名称猜测。

| 实际产品 | 产品标识 / 参数 | 浏览器完整示例 | Node.js 完整示例 |
| --- | --- | --- | --- |
| 左手整包手套 | `handGloveFullPacket`，`side: 'left'` | `glove-left-example.html` | `glove-left-example.mjs` |
| 右手整包手套 | `handGloveFullPacket`，`side: 'right'` | `glove-right-example.html` | `glove-right-example.mjs` |
| 手部检测垫 | `hand`，不接受 `side` | `hand-pad-example.html` | `hand-pad-example.mjs` |

产品入口已经内置波特率、分帧、尺寸与映射，不填写 `baudRate / delimiter / layout` 等协议覆盖。`hand` 不是左手手套；改变一个字符串不会获得 Python 整包手套支持。

Node.js 使用系统实际端口，例如 Windows 的 `COM3`、macOS 的 `/dev/cu.usbserial-实际名称` 或 Linux 的 `/dev/ttyUSB0`。这些仅是格式示意；安装第 3 章依赖后，可在 SDK 根目录执行 `node node/demo.js --list` 查看端口。端口枚举只列出设备，不识别产品型号。浏览器在第 4 章通过系统选择框选择端口。

**完成标志**：已确定产品、手套手侧、运行环境和对应示例文件；Node.js 已记下实际串口路径。切换产品或手侧时，应先结束已有连接，再使用对应示例。

## 下载并运行完整示例 {#guide-run}

**前置**：已确定产品与环境，当前没有其他上位机或采集程序占用设备串口。

**操作**：下载当前 SDK `v0.1.0` 的 [Node.js（含浏览器）SDK ZIP](/shroom-sdk-node.zip)，解压并进入 `shroom-sdk-node/`。包含 `node/`、`web/`、`examples/`、`package.json` 和上述完整示例的目录才是 SDK 根目录。旧 [完整 SDK ZIP](/shroom-sdk.zip) 的根目录为 `shroom-sdk/`，接口与示例用法相同；Python 独立包见 [Python 下载](/shroom-sdk-python.zip)。SDK 尚未发布公共 npm 包，不要执行 `npm install shroom-sdk`。

在 SDK 根目录安装本地包依赖：

```bash
npm install
```

**浏览器 JavaScript**：在同一目录启动本地服务器，终端保持运行：

```bash
# 不先打开旧的通用示例，接下来访问选中的产品文件。
node start.mjs --no-open
```

终端会显示实际地址，例如 `http://localhost:5178`。把选中的文件名接在该地址后，例如 `http://localhost:5178/glove-left-example.html`；右手用 `/glove-right-example.html`，检测垫用 `/hand-pad-example.html`。端口被占用会自动顺延，以终端实际地址为准。不要双击产品 HTML，也不要把文件移到 `web/`：这些完整示例在根目录导入 `./web/index.js`。

**Node.js**：保留对应根目录 `.mjs` 文件，下一章设置密钥后再运行。示例从第一个命令行参数读取实际串口，未提供时会显示用法，不默认使用 `COM3`。文件在根目录导入 `./node/index.js` 和 `./node/license-env.js`，不要只复制文件到其他目录就直接运行。

**完成标志**：浏览器已通过终端实际 localhost 地址打开对应产品示例；Node.js 已完成依赖安装并能找到选中的 `.mjs` 文件。此时尚未证明设备连接成功。

## 激活 SDK 授权，再连接设备 {#guide-connect}

**前置**：系统端口可见，完整示例已准备好，并持有有效 SDK 产品密钥。

**操作 — 浏览器 JavaScript**：先在表单激活授权，成功后再单独点击“连接设备”，在系统选择框中选择端口。不要在串口连接按钮里先等待远程激活，否则可能丢失 Web Serial 所需的用户手势。完整示例自动生成并保留稳定的 64 位安装标识；正常使用不需要手工编造标识。标识随浏览器来源保存，换浏览器、改变 localhost 端口或清除存储可能登记为新的安装，迁移前按[授权说明](LICENSE.md)处理名额。

**操作 — Node.js**：PowerShell 设置密钥后，运行选定产品与实际端口：

```powershell
# 仅填入交付方签发的 SDK 密钥，不要把密钥提交到源码仓库。
$env:SHROOM_LICENSE_KEY = '你的SDK产品密钥'
# COM3 仅示意；替换为第 2 章确认的实际系统端口。
node glove-left-example.mjs COM3
```

macOS / Linux 终端使用对应环境变量语法：

```bash
export SHROOM_LICENSE_KEY='你的SDK产品密钥'
# 串口路径替换为本机真实路径，右手或检测垫改用对应 .mjs 文件。
node glove-left-example.mjs /dev/cu.usbserial-实际名称
```

完整 Node.js 示例调用 `activateLicenseFromEnv()`：默认把安装标识保存在用户目录 `.shroom-sdk/device-id`，重启复用，不保存密钥。已有稳定标识可设置 `SHROOM_DEVICE_ID`；`SHROOM_LICENSE_FILE`、离线模式与自建服务配置见[SDK 授权](LICENSE.md)。这些是示例辅助函数的行为，SDK 核心不会自动读取环境变量。

连接前错误由 Promise 拒绝，连接后通过 `onError` 报告。许可到期、续验失败或清除授权会停止实机；重新激活后要重新连接。运行期断开后先确认旧连接清理结束，再按错误提示重试，避免同时占用端口。

**完成标志**：授权通过，示例显示串口已打开并进入“等待首帧”或持续取数状态。只显示“已连接”还不能算数据验收完成；下一章验证真实数据。

## 验收真实数据，安全结束采集 {#guide-verify}

**前置**：已连接正确端口，设备正在发送对应产品的协议。

**操作**：按“有字节 → 有有效帧 → 位置正确 → 持续更新 → 能结束并重连”的顺序检查，不能用模拟画面代替实机验收。

| 检查 | 预期结果 / 下一步 |
| --- | --- |
| 持续收到帧 | 诊断中的 `bytesReceived`、`frameCount` 随输入增长；零字节先查端口、USB 线与设备供数 |
| 有字节但零帧 | 查实际产品和协议；产品入口不要盲目覆盖波特率或重复套用映射 |
| 整包手套 | 按压对应手指、独立指腹与手掌，核对 `fingers.*.raw`、`fingers.*.pulp.raw`、`palm.matrix` 的位置变化 |
| 手部检测垫 | 核对 `pressureMatrix` / `values` 的 32 × 32 位置；已经映射，无需再次重排 |
| 停止与恢复 | 浏览器点击“断开”，Node.js 按 `Ctrl+C`；确认串口释放后重新连接，核对断连报错与恢复入口 |

ADC 是原始读数，检测垫 `values` 和手套各分区的 `values` 是相对归一化值，不能标成牛顿或帕斯卡。手套五指、指腹与手掌通过对应命名分区访问；`imu.raw` 是 16 字节原始数据，不是姿态或手势。完整字段见[产品数据](BACKEND-GUIDE.md#node-product-data)。

排查时可在持有设备对象的代码中调用：

```js
// 诊断是当前累计观测，streaming 不保证设备此刻仍在发数据。
console.log(device.getDiagnostics());
// 应用退出或切换产品时，等待清理完成后再打开下一个连接。
await device.close();
```

严重串口或授权错误会自动停止并尝试释放资源；应用仍应观察关闭结果。`CALLBACK_FAILED` 表示应用回调失败，不会自动停止整个采集。更多情形见[连接排查](#troubleshooting)。

**完成标志**：真实设备有持续有效帧，触按位置与产品配置一致，断开后能释放并重新连接。未收到帧、只验证 Mock、只成功打开串口，都不能勾选实机取数完成。

## 阅读代码，接入自己的项目 {#guide-code}

**前置**：完整示例已通过实机验收，并确认业务需要哪些字段。

**操作**：先保留完整示例作为可运行基线，再把业务处理放进 `onData`。产品页默认展示完整可运行示例，并可下载或复制当前产品配置；`examples/product-examples.js` 是这些示例的公共生成源。已有项目可手动切换核心片段；短片段仅适合已经完成授权、按钮和生命周期管理的项目，不能代替首次运行所需的完整文件。

Node.js 可在 SDK 根目录保存以下 `app.mjs`，设置上一章的密钥后执行 `node app.mjs 实际串口`。使用稳定标识辅助函数，中文注释标出业务入口和清理责任：

```js
import { Shroom } from './node/index.js';
import { activateLicenseFromEnv } from './node/license-env.js';

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error('请传入实际端口，例如 node app.mjs COM3');
  // 辅助函数读取环境变量，并保存、复用同一次安装的电脑标识。
  await activateLicenseFromEnv();
  const device = await Shroom.connectGlove({
    path,
    side: 'left', // 右手改为 right；检测垫按下文同时更换入口和业务字段。
    onData: (data) => {
      // data 已完成产品解析和映射，在这里调用自己的业务函数。
      console.log(data.fingers.index.pulp.raw[0]);
    },
    onError: (error) => console.error(error.code, error.message, error.suggestion),
  });
  process.once('SIGINT', () => {
    // 生命周期结束：等待串口关闭，观察清理失败，不能只取消绘制。
    void device.close().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
}

// 打开之前的错误与运行期 onError 是不同出口，都要处理。
main().catch((error) => {
  console.error(error.code ?? 'APP_ERROR', error.message, error.suggestion ?? '');
  process.exitCode = 1;
});
```

检测垫改用 `Shroom.connectHandPad({ path, onData, onError })`，业务读取 `data.pressureMatrix` / `data.values`。浏览器从对应完整 HTML 改写，保留独立激活和连接按钮、支持检测、错误提示、断开清理及页面退出处理；更换文件位置时同步调整 `./web/index.js` 相对路径。

应用保存帧时复制所需数组或标量，界面更新节流，避免在高频回调里无限堆积对象。曲线、回放、手势识别、数据库与物理量标定由应用实现。Python 使用同步读取与 `with` / `finally` 释放资源，不能把 JavaScript 的 `connectGlove()`、Promise 或 `onData()` 改名后直接使用。

**完成标志**：业务已读取并正确解释产品数据，错误与关闭路径可见，重新运行能继续使用同一安装标识。需要网页展示、标签录制或按记录 ID 下载时，再进入可选扩展。

## 可选扩展：网页展示、采集与下载 {#extensions}

主线六章只要求实机取数。下方保留已有设备服务、Mock、前端、采集、下载及排错章节与链接；仅在业务需要时使用。实时展示和录制是并行能力：关闭画面不会停止服务端录制，录制也不依赖页面是否持续绘制。

## 可选：设备与网页数据服务 {#device}

需要浏览器展示、录制或下载时，在同一 SDK 根目录创建 `server.mjs`，使用下面的服务版本。它与主线的产品 `.mjs` 完整示例是二选一路线：切换前用 `Ctrl+C` 停止正在运行的程序，不要同时打开同一串口。如果此前启动过模拟数据服务，也应先停止，避免占用数据服务端口。依赖安装与密钥环境变量沿用主线第 3、4 章。

```js
import { Shroom } from './node/index.js';
import { activateLicenseFromEnv } from './node/license-env.js';

// 复用稳定安装标识；不要每次运行重新生成标识。
await activateLicenseFromEnv();
const device = await Shroom.connectGlove({
  path: 'COM3',
  side: 'left', // 右手改为 'right'，由使用者明确选择
  onError: (error) => console.error(error.code, error.message, error.suggestion),
});

const server = await Shroom.serveDevice(device, {
  port: 19999,
  recordingsDir: './recordings',
});

// 服务和设备分别持有资源：停止服务不会自动关闭调用者的设备。
process.once('SIGINT', async () => {
  try { await server.close(); }
  catch (error) { console.error(error); process.exitCode = 1; }
  finally { await device.close(); }
});
```

运行：

```bash
node server.mjs
```

手部检测垫只需把设备连接这一行替换为：

```js
const device = await Shroom.connectHandPad({ path: 'COM3' });
```

随后按[前端接入](#view)、[数据采集](#record)与[按 ID 下载](#download)继续。只取数的客户无需执行后续章节。

## 可选：展示与采集完整示例 {#demo}

下载 Node.js SDK ZIP，解压后进入包含 `node/`、`web/`、`package.json` 的目录。需要 Node.js 18+；真实设备连接使用 `serialport`，WS 服务使用 `ws`：

```bash
npm install
```

在第一个终端启动数据服务。没有硬件时先用模拟数据：

```bash
node node/quick-demo.js --mock --port 19999
```

在同一目录打开第二个终端，启动示例网页服务器：

```bash
node start.mjs
```

浏览器打开 `http://localhost:5178/web/quick-start.html`，若网页端口被占用，以第二个终端实际打印的端口为准。两个终端都需要保持运行；`5178` 是网页端口，`19999` 是数据服务端口，不能混用。

在页面填写 WS 端口 `19999` 并连接，看到画面后输入标签，例如“握拳”，点击“开始录制”，再“停止录制”，最后下载 CSV 或 JSONL。Mock 仅验证软件链路，不证明硬件、手套点位或实际动作已经通过验收。

## 可选：前端连接与二维展示 {#view}

使用真实设备时，保持“启动网页展示与采集服务”中的 `node server.mjs` 运行；使用模拟数据时，保持“展示与采集完整示例”中的 Mock 服务运行。在 SDK 解压目录另开一个终端，启动网页 HTTP 服务：

```bash
node start.mjs
```

打开 `http://localhost:5178/web/quick-start.html`，网页端口以终端实际打印的地址为准；数据服务端口仍为 `19999`。使用真实设备时沿用 `server.mjs`，不需要另外启动 Mock 数据服务。

集成自己的网页时，将页面放在 SDK 的 `web/` 目录，通过上述 HTTP 服务访问。页面使用一个普通容器，而不是自己创建手套的每块画布：

```html
<div id="view"></div>
<script type="module">
  import { Shroom } from './index.js';

  const stream = await Shroom.connectStream({ port: 19999 });
  const view = Shroom.createProductView('#view', { source: stream });

  stream.onData((frame) => {
    // 数据可同时用于业务计算；不用再次解析 JSON 或做产品点位映射。
    if (frame.fingers) console.log(frame.fingers.index.pulp.raw[0]);
  });
  stream.onError((error) => console.error(error.code, error.message));

  window.addEventListener('pagehide', () => {
    view.destroy();
    void stream.close(); // 只关闭前端连接，不会停止服务端录制
  }, { once: true });
</script>
```

`createProductView()` 根据产品数据绘制手套二维分区热力图或手部检测垫矩阵。手套展示五指、独立指腹和手掌；不是 3D 手模，也不提供手势识别。显示的是 ADC 相对数据，不是 kPa、牛顿或关节角度。

## 可选：数据采集 {#record}

开始和停止属于同一次采集的生命周期；完成采集后，再到下一节按记录 ID 下载文件。

### 输入标签，开始录制 {#start-recording}

在同一个页面的按钮事件里调用：

```js
const session = await stream.startRecording({ label: '握拳' });
console.log('本次采集记录 ID：', session.id);
```

这会在 Node.js 服务端新建一个录制会话，并把每个收到的数据帧持续写入磁盘。一次会话对应一个标签；切换动作时先停止，再用新标签开始下一次录制。

标签是人工标注，不是 AI 自动判断动作。SDK 保留会话标识、标签、时间戳、产品、左右手及帧数据；录制不靠浏览器无限堆积数组，也不会因为渲染节流而只保存画面刷新时的帧。

### 停止录制，确认采集结果 {#stop-recording}

```js
const recording = await stream.stopRecording();
console.log(recording.id, recording.status, recording.error, recording.frameCount);
```

`stopRecording()` 等待已经接收的数据写完后才返回。应检查 `recording.status`、`recording.error` 和 `recording.frameCount`：异常结束或零帧不能提示采集成功。会话与每帧的 `source` 标记数据来源，`mock` 是合成样本；实时进度以服务端已写入帧数为准，不以画面刷新次数计数。

需要显示采集状态时：

```js
const status = await stream.getRecordingStatus();
console.log(status);

const unsubscribe = stream.onRecording((recording) => {
  console.log('服务端录制状态：', recording?.status ?? '未录制');
});
// 界面模块销毁时调用 unsubscribe()，关闭连接时调用 stream.close()。
```

录制目录由 Node.js 端的 `recordingsDir` 指定，默认相对当前进程工作目录的 `.shroom-recordings`。页面应在开始、停止请求期间禁用重复操作，并明确显示结果。

## 可选：按记录 ID 下载 {#download}

下载是独立操作，不会开始或停止采集。以下示例使用上一节 `stopRecording()` 返回的 `recording` 对象，也可以改为用户从历史列表中选中的记录。

```js
const recordingId = recording.id; // 上一节已经停止的这次采集记录 ID
stream.downloadRecording(recordingId, { format: 'csv' });

// 如需保留完整帧字段，改用 JSONL（一次点击选择一种格式）。
// stream.downloadRecording(recordingId, { format: 'jsonl' });
```

**下载必须传入对应的采集记录 ID**：`stream.downloadRecording(recordingId, { format: 'csv' })`。这个 ID 是服务端为每次采集生成的唯一标识，不是产品 ID、WS 端口或人工标签；相同标签的两次采集也有不同 ID。SDK 不会默认下载最近一次记录。

ID 可以从 `startRecording()` 返回的 `session.id`、`stopRecording()` 返回的 `recording.id`，或 `listRecordings()` 的对应记录中取得。历史下载不要求刚刚执行停止操作：页面选中哪条记录，就传入那条记录的 `id`。

不传 ID 或 ID 格式无效时，客户端返回 `INVALID_CONFIG`，不发起下载；ID 不存在时服务端返回 404；对应记录仍在录制或尚未写完时返回 409。ID 用于定位记录，不是访问授权凭据。

`downloadRecording()` 触发浏览器从服务端下载文件，并同步返回下载 URL；它不等待浏览器保存完成，不能把返回值当成“文件已落盘”的确认。下载不是只返回一个 Node.js 本地路径。

CSV 每帧一行，标签和时间是独立列，原始数组与手套分区保留为 JSON 单元格，并非每个传感器一列。JSONL 每行一个完整帧记录，更适合程序读取。具体字段和存储边界见[数据存储](STORAGE.md)。

需要再次下载历史会话时：

```js
const recordings = await stream.listRecordings();
console.log(recordings);

// 用户选择目标记录后，把对应的 id 交给这个函数；不是按列表第一条自动下载。
function downloadById(recordingId) {
  stream.downloadRecording(recordingId, { format: 'csv' });
}
```

浏览器下载不会删除服务端原始记录。下载完成或失败由浏览器下载管理器显示，不要仅凭触发下载就提示“下载完成”。

## 地址、安全与排错 {#troubleshooting}

默认服务仅监听本机回环地址，并只接受本机网页 Origin。前后端在同一台电脑时，填写同一个 WS 端口即可；端口不是服务器地址，不能用于任意跨机器部署。

跨机器需要显式配置服务监听 `host`、允许的网页 `allowedOrigins`，前端也要填写服务器地址。生产环境还需要自己的认证、网络访问控制与 TLS 反向代理；HTTPS 网页使用 `wss://`，不能直接连接明文 `ws://`。不要把本地默认示例直接暴露到公网。

| 现象 | 优先检查 |
| --- | --- |
| 网页打不开 | `node start.mjs` 是否仍运行；访问终端实际打印的网页端口 |
| WS 连接失败 | Node 数据服务是否启动；是否把网页端口误填成 WS 端口；端口是否被占用 |
| Origin 被拒绝 | 默认仅本机网页可接入；跨机显式配置允许来源，不要关闭校验 |
| 已连接但没有数据 | 串口是否选对；设备是否发送数据；查看 `device.getDiagnostics()` |
| 开始或停止失败 | 不要重复点击；确认是否已有录制、磁盘是否可写，并展示返回错误 |
| 下载失败 | 先完成停止录制；确认记录存在、服务仍运行，不要只判断本地路径 |

浏览器关闭或网络断开不等于服务端停止录制。操作完成后明确停止录制；关闭 Node 服务会结束其资源，但调用者仍需单独关闭设备。完整的生命周期与自定义 API 见[基础文档](CUSTOM.md)。

Python 当前提供基础串口、模拟、解析和矩阵接口，不提供本篇的产品连接、WS 服务、浏览器录制控制或产品渲染链路。Python 使用者请看[后端基础文档](BACKEND-GUIDE.md)并切换到 Python。
