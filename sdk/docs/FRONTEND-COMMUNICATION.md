# 前端通讯 API

浏览器入口支持 Web Serial 直连、Mock 和已有后端 HTTP / WebSocket。先确定设备由谁连接；本页按接口说明参数、返回值和生命周期。

## 导入与环境 {#environment}

SDK 根目录的 HTML 页面通过本地 HTTP 服务打开，页面与 web/ 同级：

```js
import { Shroom, connectSerial, isSerialSupported, BackendSdkClient } from './web/index.js';
```

Web Serial 需要支持该功能的浏览器、安全上下文（HTTPS / localhost）和用户授权；连接必须在用户手势中调用。模拟和网络后端入口不依赖 Web Serial。真实支持情况以运行时检测为准。

## Web Serial {#web-serial}

### Shroom.isSupported() / isSerialSupported() {#supported}

**用途**：检测当前环境是否暴露 navigator.serial；两者相同。

**参数**：无。**返回值**：boolean。**示例**：`if (!Shroom.isSupported()) console.log('当前环境未开放 Web Serial')`。

**注意事项**：true 不代表设备已连接或用户已授权。file://、非安全来源或缺少浏览器能力时可能不可用。

### Shroom.connect(options) / connectSerial(options) {#connect}

**用途**：选择并打开设备，后台读取字节、分帧和解码。

| 参数 | 类型 | 默认值 / 说明 |
| --- | --- | --- |
| `baudRate` | number | 1000000 |
| `filters` | USB 筛选对象数组 | 未提供，展示可选端口；如 `[{ usbVendorId: 0x1a86 }]` |
| `port` | 已获得的浏览器 SerialPort | 未提供时弹授权选择框；不是 COM 路径字符串 |
| `delimiter / minLength / maxLength / lockLength` | 分帧选项 | 默认 AA 55 03 99、8、8192、true |
| `rows / cols / points / fullScale / threshold / layout` | 解码选项 | 见 [帧解析 API](BACKEND-GUIDE.md#frame) |

**返回值**：`Promise<Device>`。取消选择、占用、权限或打开失败时拒绝 Promise。

**示例**：页面已有 connect 按钮：

```js
document.querySelector('#connect').onclick = async () => {
  try {
    const device = await Shroom.connect({ baudRate: 1000000, rows: 32, cols: 32 });
    device.onFrame((frame) => console.log(frame.max));
    window.addEventListener('pagehide', () => { device.close(); }, { once: true });
  } catch (error) {
    console.error(error.message);
  }
};
```

**注意事项**：不要在页面加载时自动请求串口；Web 入口没有 path 参数。真实应用应避免重复创建连接，完整生命周期示例在下方。

### device.onFrame(handler) {#on-frame}

**用途**：接收 Web Serial 或 Mock 的每一帧。

**参数**：必填 `(frame: Frame) => void`。**返回值**：`() => void` 取消监听函数。

**示例**：`const unsubscribe = device.onFrame((frame) => heatmap.render(frame))`；结束用 `unsubscribe()`。

**注意事项**：回调同步执行，异步处理不会被等待；帧的 raw 可能共享视图，异步保存前复制。不要把它当成网络客户端的 on('frame')。

### device.close() {#close}

**用途**：清理帧监听、取消 reader 并释放串口；Mock 时停止定时器。

**参数**：无。**返回值**：`Promise<void>`。**示例**：`await device.close()`。

**注意事项**：清理应用内的其他监听仍由调用方负责。连接错误与运行期读取错误的处理不同，运行期错误记录到控制台，不提供 device.on('error')。

### 设备属性与诊断 {#device-properties}

| 属性 | 说明 |
| --- | --- |
| info | source、baudRate 和调用方设置的 rows/cols |
| bytesReceived | 真实串口接收字节数 |
| frameCount | 已切出的 payload 数 |
| droppedCount | 丢弃帧数 |
| frameLength | 已锁定长度，未锁定为零 |

**示例**：`console.log(device.bytesReceived, device.frameCount, device.frameLength)`。Mock 不提供串口诊断计数；输出形状以实际 Frame 为准。

## 模拟数据 {#mock}

### Shroom.mock(options) / createMockDevice(options) {#mock-device}

**用途**：无需硬件，生成与串口同结构的 Frame。具名函数从 web/index.js 导入。

| 参数 | 类型 | 默认值 |
| --- | --- | --- |
| rows / cols | number | 各 32 |
| fps | number | 30 |
| 其他解码选项 | DecodeOptions | 与 decodeFrame 相同 |

**返回值**：同步 Device，不是 Promise。**示例**：`const device = Shroom.mock({ rows: 32, cols: 32, fps: 20 })`。

**注意事项**：同样需要取消监听和 close()；不需要串口授权。Mock 不会启动真实后端。

## 已有后端连接 {#backend}

### BackendSdkClient {#backend-client}

**用途**：设备已由后端连接时，网页通过 HTTP 查询 / 控制，WS 订阅，不重复打开串口。

**参数**：构造选项含 httpBaseUrl、wsUrl、timeoutMs、headers、contract、routes 与实现注入。默认 HTTP 127.0.0.1:19245、WS 127.0.0.1:19999，超时 10000 毫秒。

**返回值**：BackendSdkClient。所有方法、事件与参数表见 [后端通讯 API](../BACKEND.md#constructor)。

**示例**：

```js
const client = new BackendSdkClient({
  httpBaseUrl: 'http://127.0.0.1:19245', wsUrl: 'ws://127.0.0.1:19999',
});
client.on('error', (error) => console.error(error.message));
client.on('frame', (frame) => console.log(frame));
await client.getContract();
client.connectRealtime({ channels: ['sit'] });
window.addEventListener('pagehide', () => client.disconnectRealtime(), { once: true });
```

**注意事项**：CORS / WS Origin 由后端配置；HTTPS 页面用 HTTPS / WSS。构造不会发请求，不自动启动后端、控制设备或重连。HTTP headers 不会自动变成浏览器 WS 请求头。

### 网络帧与基础 Frame {#frame-adapter}

网络 frame 事件保留后端 JSON，字段与单位由后端决定，不保证存在基础 values/rows/cols。必须依据真实契约适配，不能将任意 JSON 直接传给 heatmap.render()，也不能臆造物理单位。

## 完整生命周期示例 {#example}

以下页面放在 SDK 根目录，通过 HTTP 服务打开；重复连接和退出时释放旧设备：

```html
<button id="connect">连接设备</button>
<button id="disconnect">断开</button>
<pre id="output"></pre>
<script type="module">
  import { Shroom } from './web/index.js';
  const output = document.querySelector('#output');
  const connectButton = document.querySelector('#connect');
  let device;
  let unsubscribe;
  async function disconnect() {
    unsubscribe?.();
    unsubscribe = undefined;
    const previous = device;
    device = undefined;
    if (previous) await previous.close();
  }
  connectButton.onclick = async () => {
    connectButton.disabled = true;
    try {
      await disconnect();
      device = await Shroom.connect({ rows: 32, cols: 32, baudRate: 1000000 });
      unsubscribe = device.onFrame((frame) => { output.textContent = `最大值：${frame.max}`; });
    } catch (error) { output.textContent = error.message; }
    finally { connectButton.disabled = false; }
  };
  document.querySelector('#disconnect').onclick = disconnect;
  window.addEventListener('pagehide', () => { void disconnect(); });
</script>
```

框架应用只在挂载后、用户授权动作中连接，卸载时执行相同清理；绘图接口见 [渲染 API](RENDERING.md)。
