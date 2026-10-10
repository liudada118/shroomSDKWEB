# 串口接入

串口接入的工作是把设备字节转换成统一 `Frame`。Python 与 Node.js 可直接访问系统串口；网页直连方式见[前端通讯](FRONTEND-COMMUNICATION.md)。

## 连接前确认

- 插入设备，确认操作系统识别到串口。
- 按产品确认波特率、矩阵尺寸、分隔符与点位排列。
- 关闭占用该端口的上位机或其他采集程序。
- 先用模拟设备运行代码，再换成真实端口。

SDK 的默认协议以 `AA 55 03 99` 分帧，每个采样点为一个字节。设备协议不同需要显式配置或另行适配；不能仅根据“手套”或“压力垫”名称确定协议。

## Node.js 连接

以下代码保存到解压后 SDK 根目录的 `serial-example.mjs`，使用 `node serial-example.mjs` 运行：

```js
import { Shroom } from './node/index.js';

console.log(await Shroom.listPorts());
const device = await Shroom.connect({
  path: 'COM3',
  baudRate: 1000000,
  rows: 32,
  cols: 32,
  layout: 'raw',
});

device.onFrame((frame) => console.log(frame.max, frame.center));
process.once('SIGINT', async () => { await device.close(); });
```

## Python 连接

安装 Python 包的串口依赖后运行；安装步骤见[Python SDK](../python/README.md)。

```python
from shroom_sdk import Shroom

print(Shroom.list_ports())
with Shroom.connect("COM3", baud_rate=1_000_000, rows=32, cols=32) as device:
    frame = device.read_frame(timeout=5.0)
    if frame is None:
        print("等待数据超时")
    else:
        print(frame.max, frame.center)
```

Python 用 `with` 释放连接；Node.js 在结束时调用 `device.close()`。不要同时启动多个程序读取同一端口。

## 数据帧与点位

- `raw`：原始采样字节。
- `values`：默认归一化到 0～1 的相对 ADC 数值。
- `rows` / `cols`：矩阵形状。
- `max` / `avg` / `area` / `center`：帧统计。
- `timestamp`：毫秒时间戳。

Node.js 可按产品指定 `layout`。Python 当前仅内置 `raw` / `mat32`，也可提供自定义排列，不能直接照搬全部 JavaScript 产品名称。点位配置与 API 对照见[SDK 说明与排错](../README.md)及[Python SDK](../python/README.md)。

## 排错顺序

1. 没有端口：检查连接、驱动与系统权限。
2. 端口打不开：检查端口占用和权限。
3. 没有字节：确认设备在发送、选对端口和数据线。
4. 有字节没有帧：检查波特率、协议和分隔符。
5. 有帧但位置不对：检查矩阵尺寸与点位排列。

不要直接把相对 ADC 值当成 kPa 或牛顿；物理单位换算需要产品对应的标定数据。
