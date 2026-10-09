# Shroom Python SDK · AI 接入指南

先阅读同目录的 [README.md](README.md)，它是 Python API 的完整使用说明。本文件是接入上下文，不是可安装的 Agent Skill。

## 安装与验证

- 要求 Python 3.10+，无需 Node.js，尚未发布 PyPI。
- 解压 `shroom-sdk-python.zip`，在包含 `python/` 的根目录运行 `python -m pip install "./python[serial]"`。
- 在本仓库根目录开发时路径是 `./sdk/python`，不要混淆。
- 没有设备时先运行 `python -m shroom_sdk --frames 3` 验证模拟数据。
- 图形示例可安装 `"./python[serial,plot]"` 后运行 `python python/examples/heatmap.py`。

## Python 接口

```python
from shroom_sdk import Shroom

with Shroom.mock(rows=32, cols=32) as device:
    for frame in device:
        print(frame.max, frame.area, frame.center.x, frame.center.y)
        break
```

- 实机替换为 `Shroom.connect("COM3", baud_rate=1_000_000, rows=32, cols=32)`，端口和尺寸必须由设备资料确定。
- 使用 `Shroom.list_ports()` 枚举串口，`device.read_frame(timeout=2)` 单次读取；超时返回 `None`。
- `for frame in device` 在无数据时持续等待；用 `with` 或 `close()` 释放串口，`break` 本身不负责关闭。
- API 是同步接口，不使用 Promise、`onFrame()` 或 `on_frame()`，没有后台采集线程。
- `frame.values` 是 float32 数组，`frame.raw` 是 bytes；`frame.matrix()` / `frame.to_dict()` 用于转二维列表 / JSON 可序列化快照。
- 参数使用 `baud_rate`、`full_scale`、`lock_length` 等 snake_case；不要照抄 JavaScript 参数。

## 能力边界

提供串口读取、拆帧、raw/mat32 排列、Mock、文字热力图及可选 Matplotlib 示例。
默认协议是 `AA 55 03 99` 分隔帧，每点一个字节；默认 values 为 0～1 相对 ADC 值，area 为阈值以上的点数。
不提供 kPa/N 换算、手套专用协议、IMU、手势识别、数据库、录制回放。
先确认设备协议与点位排列，再接真实设备；未知协议不要编造。
