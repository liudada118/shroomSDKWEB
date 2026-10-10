# Node.js 接入

适合 Node.js 服务、命令行采集和 Electron 应用。通过串口直接读取设备，或通过 HTTP / WebSocket 连接已经运行的后端。

## 安装与入口

从首页下载 Node.js SDK，解压进入含有 `package.json`、`node/` 和 `web/` 的目录。以下例子均放在这个目录，以 `.mjs` 文件运行。使用 Node.js 18+。

```bash
npm install
node node/demo.js --list
```

`serialport` 用于真实串口，`ws` 用于没有原生 WebSocket 的 Node 环境。模拟设备无需这两项依赖。SDK 当前通过下载包或本地依赖使用，尚未发布到公共 npm 仓库。

## 先用模拟数据

将下面的代码保存为 `example.mjs`，运行 `node example.mjs`：

```js
import { Shroom } from './node/index.js';

const device = Shroom.mock({ rows: 32, cols: 32, fps: 20 });
const unsubscribe = device.onFrame((frame) => {
  console.log(frame.timestamp, frame.max, frame.area);
});

try {
  await new Promise((resolve) => setTimeout(resolve, 1000));
} finally {
  unsubscribe();
  await device.close();
}
```

`mock()` 同步返回设备，`connect()` 异步返回设备。两者使用相同的 `onFrame()` 与关闭接口。

## 改为串口采集

枚举端口，再把设备创建语句换成实际串口：

```js
console.log(await Shroom.listPorts());
const device = await Shroom.connect({
  path: 'COM3',
  baudRate: 1000000,
  rows: 32,
  cols: 32,
  layout: 'raw',
});
```

`COM3` 是示例。macOS / Linux 使用枚举得到的设备路径。波特率、尺寸与线序应按实际产品设置，详见[串口接入](SERIAL.md)。

## 连接已有后端

已有后端负责连接设备时，使用 `BackendSdkClient`，无需让当前程序再次打开串口。HTTP 与 WebSocket 地址分别设置，示例与完整接口见[后端通讯](../BACKEND.md)。

```js
import { BackendSdkClient } from './node/index.js';

const client = new BackendSdkClient();
console.log(await client.getContract());
client.on('error', (error) => console.error(error.message));
client.on('frame', (frame) => console.log(frame));
client.connectRealtime({ channels: ['sit'] });
process.once('SIGINT', () => client.disconnectRealtime());
```

## 下一步

- [串口接入](SERIAL.md)：端口、参数、点位与连接排错。
- [数据存储](STORAGE.md)：在应用中保存数据快照。
- [SDK 说明与排错](../README.md)：完整 API 与诊断指标。

Electron 的真实串口通常放在主进程，通过应用的 IPC 发送可序列化数据给渲染进程；当前 SDK 不会替你搭建 IPC、数据库或采集服务。
