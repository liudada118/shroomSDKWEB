# Shroom 本地 Node 后端

这个子入口把轻量 Web / Node / Mock `Device` 延伸为本地数据链：串口、采集、SQLite / 内存存储、回放、CSV 和同步算法通道。

它运行在 Node 18+、Electron 或上位机进程中，不会在浏览器和托管 Worker 中打开 COM 口，也不包含 HTTP 服务端。

## 使用

在解压后的 `shroom-sdk` 根目录执行：

```bash
npm install
npm run backend:serial-demo -- --mock
```

后端模块是独立 CommonJS 边界：

```js
const {
  MemoryCaptureStore,
  ShroomSensorSDK,
  attachCoreDevice,
} = require('./backend')
```

已有轻量 `Device` 时，可以直接桥接：

```js
const session = attachCoreDevice(device, {
  store: new MemoryCaptureStore(),
  sensorType: 'matrix',
  channel: 'sit',
})

session.startCapture({ name: 'demo', frequencyMode: 'serial' })
session.on('frame', (frame) => console.log(frame.stats))
```

桥接后的 `values` 标记为 `valueScale: 'normalized-0-1'`。原始 ADC 算法的阈值不能直接用于这些归一化数据。

## 依赖边界

- `csv-writer` 是 CSV 导出的基础依赖。
- `serialport` 和 `@serialport/parser-delimiter` 仅在使用增强串口时加载。
- `better-sqlite3` 仅在首次创建 `CaptureStore` 时加载；无原生 binding 时仍可使用 `MemoryCaptureStore`。
- `ws` 仅由 `BackendSdkClient` 的实时连接路径使用；该客户端不包含服务器实现。

结束时使用 `await sdk.close()`，它会关闭全部串口会话和已创建的存储。接口声明见 `index.d.ts`，快照来源与验证状态见 `SOURCE.md`。
