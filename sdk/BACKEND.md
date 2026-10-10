# 连接已有后端（Node.js / 浏览器）

`BackendSdkClient` 通过 HTTP 控制接口和 WebSocket 实时通道连接已运行的 Shroom 主项目后端。这条链路来自独立 ShroomSDK 的后端客户端，已适配当前 SDK 的 ES 模块、浏览器和下载包。

## 先选对连接方式

| 你的场景 | 使用入口 | 设备由谁连接 |
| --- | --- | --- |
| 程序直接读取传感器串口 | `Shroom.connect()` | 当前程序 |
| 主项目后端已连接设备，第三方程序想订阅数据或控制它 | `new BackendSdkClient()` | 已运行的后端 |

这是一个客户端，不会启动后端、不带数据库，不会自行打开串口或启动采集。网站提供的 **Shroom Monitor 串口监视器不等于这个 HTTP/WS 后端**；仅打开 Monitor 或当前开发者网站，并不会出现以下 API。

本次只支持 Node.js / Electron / 浏览器。**Python 包未包含这个客户端。**

## 后端与运行环境

需要运行与下述接口兼容的 Shroom 主项目后端，默认地址是：

```text
HTTP: http://127.0.0.1:19245
WebSocket: ws://127.0.0.1:19999
```

这两个地址分别配置，改 HTTP 地址不会自动推导 WebSocket 端口。连接其他机器时把两者都改为实际地址；`127.0.0.1` 指运行客户端的那台机器。

- Node.js 18+ 内置 `fetch`。有全局 `WebSocket` 的 Node 可直接运行；没有时，在解压后的 SDK 根目录执行 `npm install ws`，Node 入口会自动使用它。不需要为了后端连接安装串口驱动或 `serialport`。
- 浏览器使用原生 `fetch` / `WebSocket`，不依赖 Web Serial。ES 模块页面应通过本地 HTTP 服务打开，不使用 `file://`。
- SDK 保留原有串口功能，`Shroom.connect()` 的含义不变。

## Node.js 最小例子

把下面的程序放到解压后的 SDK 根目录，例如 `backend-example.mjs`：

```js
import { BackendSdkClient } from './node/index.js';

const client = new BackendSdkClient({
  httpBaseUrl: 'http://127.0.0.1:19245',
  wsUrl: 'ws://127.0.0.1:19999',
  timeoutMs: 10000,
});

console.log(await client.getContract());
console.log(await client.listSerialPorts());
console.log(await client.getSerialStatus());

client.on('error', (error) => console.error('连接异常:', error.message));
client.on('frame', (frame) => {
  console.log(frame.channelId, frame.portId, frame.value);
});
client.connectRealtime({ channels: ['sit', 'back'] });

process.once('SIGINT', () => client.disconnectRealtime());
```

若已通过本地依赖方式安装此包，也可使用 `import { BackendSdkClient } from 'shroom-sdk/backend'` 或 `'shroom-sdk/node'`。这不表示已经发布到公共 npm 仓库。

SDK 已附带只读示例，无需创建文件：

```bash
node node/backend-demo.js --help
node node/backend-demo.js --channels sit,back --duration 10000
node node/backend-demo.js --http http://192.168.1.10:19245 --ws ws://192.168.1.10:19999
```

示例只读取契约、串口状态并订阅实时数据，结束或 Ctrl+C 时释放 WebSocket，不会改变传感器类型、打开串口或启动采集。若后端没有正在发送数据的设备，成功连接也可能收到 0 帧。

## 浏览器最小例子

在你自己的页面中使用（示例假定页面位于 SDK 的 `web/` 目录，且有 `connect` / `disconnect` 按钮和 `output` 元素）：

```js
import { BackendSdkClient } from './index.js';

const output = document.querySelector('#output');
const client = new BackendSdkClient({
  httpBaseUrl: 'http://127.0.0.1:19245',
  wsUrl: 'ws://127.0.0.1:19999',
});

client.on('error', (error) => { output.textContent = error.message; });
client.on('frame', (frame) => { output.textContent = JSON.stringify(frame); });
document.querySelector('#connect').onclick = async () => {
  try {
    await client.getContract();
    client.connectRealtime({ channels: ['sit'] });
  } catch (error) {
    output.textContent = error.message;
  }
};
document.querySelector('#disconnect').onclick = () => client.disconnectRealtime();
window.addEventListener('pagehide', () => client.disconnectRealtime());
```

使用经典脚本 `web/shroom.bundle.js` 时，对应入口是 `new Shroom.BackendSdkClient(options)`。React 中在组件卸载时调用 `disconnectRealtime()`，不要在每次 render 时创建连接。

## HTTP 能力与返回值

| 方法 | 用途 | 是否改变后端状态 |
| --- | --- | --- |
| `getContract({ refresh? })` | 获取契约，并更新接口路径和订阅消息类型 | 否 |
| `getChannels()` / `getWsStatus()` | 查询通道、实时服务状态 | 否 |
| `listDisplaySystems()` / `getDisplaySystem(id)` | 查询展示系统配置 | 否 |
| `listSerialPorts()` / `getSerialStatus(role?)` | 枚举后端机器串口、查询连接状态 | 否 |
| `getCurrentSensor()` | 查询当前传感器 | 否 |
| `setSensorType(type)` | 切换后端传感器类型 | **是** |
| `openSerial({ role, port })` / `closeSerial({ role })` | 在后端机器上打开／关闭串口 | **是** |
| `startCollection(options)` / `stopCollection()` | 调用后端启动／停止采集 | **是** |

只有显式调用控制方法才改变设备状态。不要对 `openSerial`、`startCollection` 等写操作做无条件自动重试，HTTP 超时不代表服务端没有执行。

一般 HTTP 方法将 `{ code: 0, data }` 解包为 `data`；非零 `code`、HTTP 非成功状态、无效 JSON 都会报错。为兼容原客户端，`getChannels`、`getWsStatus`、`listDisplaySystems`、`getDisplaySystem` 保留原始 JSON；`getContract` 同时支持裸契约与 `{ code: 0, data: contract }`。

`getContract()` 默认缓存，`{ refresh: true }` 重新拉取。构造时显式提供的 `routes` 优先于契约，刷新后仍保留。可通过 `request('/path', { method, query, body, signal, timeoutMs, headers, raw })` 调用其他接口；这里只接受当前后端上的相对路径，不会读取网站的环境密钥。

## 实时帧与生命周期

- `connectRealtime({ channels })` 立即返回 WebSocket，连接完成后自动发送订阅并触发 `open`。默认 10 秒握手超时；`error` 报告连接错误，`close` 报告连接关闭。
- `subscribe('sit')` / `unsubscribe(['sit', 'back'])` 要在连接成功后调用。消息类型优先采用后端契约的 `SUBSCRIBE` / `UNSUBSCRIBE`，未配置时为 `subscribe` / `unsubscribe`。
- `message` 接收解析后的 JSON；`frame` 接收单帧，批量 `{ frames: [...] }` 会逐帧通知；非 JSON 文本通过 `raw` 事件交付。支持的是 JSON 文本协议，不提供二进制传感器拆包。
- `on` / `off` / `once` / `removeAllListeners` 管理监听器，回调应保持轻量。关闭连接不会删除监听器，可重用同一个客户端；`disconnectRealtime()` 可重复调用。
- 不自动重连。异常断开后由应用决定何时再调用 `connectRealtime({ channels })`，重新传入所需通道；SDK 不会趁重连重放控制命令。

**后端帧不等于串口 `Frame`。** `frame.value`、`pressureData`、姿态、时间戳等字段以实际后端契约为准，SDK 原样保留，不截成 uint8、不自动除以 255、不二次套线序，也不承诺其值是 N/kPa。

因此不能直接把后端帧传给 `heatmap.render()`，也不要把已经解析好的数据送进 `decodeFrame()`。若需使用基础热力图，应根据具体通道的矩阵尺寸、数值范围与点位顺序显式适配；手套字段需要后端确实支持对应协议。

## 连接失败与安全边界

| 情况 | 检查方向 |
| --- | --- |
| HTTP 拒绝连接 / 超时 | 后端是否启动、HTTP 端口、地址、防火墙 |
| 404 | 后端版本是否提供 `/api/sdk/contract` 等接口；按部署配置覆盖 `routes` |
| HTTP 正常、WS 失败 | 独立检查 WS 地址、端口、反向代理 Upgrade 配置及 Origin 限制 |
| 浏览器 CORS 或混合内容错误 | 后端允许当前页面来源；HTTPS 页面使用 HTTPS/WSS 或由受信任代理转发 |
| 已连接但无帧 | 通道名是否正确、设备是否已由后端连接、后端是否正在推送 |
| Node 提示没有 WebSocket | 在 SDK 根目录安装 `ws`，使用 `node/index.js` 或包的 `shroom-sdk/backend` 入口 |

不要为调试关闭浏览器安全限制。默认回环地址用于本地连接；部署到局域网或公网前，后端需配置认证、权限、允许的来源和 TLS。不要无鉴权公开串口控制、采集接口。

构造参数 `headers` 只用于 HTTP；浏览器 WebSocket 不支持任意自定义请求头，需遵循后端实际认证协议，可传 `protocols` 或注入兼容的 `WebSocketImpl`。SDK 不签发许可证、不绕过后端授权、不自带报告、数据库或采集引擎。
