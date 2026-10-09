# Shroom Python SDK

Python 3.10+ 的压力传感器基础 SDK：串口读取、拆帧、统一 Frame、点位排列、模拟设备与终端热力图。Python 包版本为 `0.1.0`，不依赖 Node.js。默认协议与 JavaScript SDK 一致：`AA 55 03 99` 分隔帧，每个采样点占一个字节。

`values` 是默认满量程 255 下的 **0～1 相对 ADC 值**；`area` 是超过阈值的点数，不是平方厘米。SDK 不提供 kPa/N 换算、手套专用协议、IMU、手势识别、数据库或采集回放。

## 安装

官网 SDK 下载区直接点击 **下载 Python SDK**，获取 `shroom-sdk-python.zip`。**尚未发布到 PyPI**。解压后进入 `shroom-sdk-python` 目录（里面有 `python/` 文件夹），再执行本地安装。旧版完整包 `shroom-sdk.zip` 也使用相同命令；Node.js 下载包只附此说明，不含 Python 源码，请另外下载 Python 版本：

```bash
# 仅核心解码、模拟设备与文字热力图：无需第三方运行依赖
python -m pip install ./python

# 需要连接真实设备：同时安装 pySerial
python -m pip install "./python[serial]"

# 可选 Matplotlib 图形示例（含串口）
python -m pip install "./python[serial,plot]"
```

在本项目根目录开发时，路径改为 `./sdk/python`；Windows 可用 `py -3` 替代 `python`，macOS/Linux 常用 `python3`。推荐先创建虚拟环境。若仅缺串口依赖，可以运行 `python -m pip install pyserial`，不要安装名称相近的 `serial` 包。

需要 AI 辅助接入时，让 AI 先读下载包里的 `python/AI-CONTEXT.md` 和 `python/README.md`，不要混用 JavaScript 的回调 API。

## 30 秒运行

```bash
python -m shroom_sdk --frames 3                # 模拟设备，输出三帧文字热力图
python -m shroom_sdk --list                    # 列出串口，需要 [serial]
python -m shroom_sdk COM3 --rows 32 --cols 32   # Windows 真实设备
python -m shroom_sdk /dev/ttyUSB0              # Linux 真实设备
python -m shroom_sdk /dev/cu.usbserial-XXXX    # macOS，替换为实际端口
python -m shroom_sdk COM3 --layout mat32 --frames 10 --json
```

也可以使用安装后生成的 `shroom-demo` 命令。省略端口表示使用模拟设备；`--frames 0`（默认）持续读取直到 Ctrl+C。`--json` 每行输出一个完整 Frame，方便接其他工具。真实设备默认等待一帧 5 秒，超时会给出错误并退出，可用 `--timeout` 调整。

## 在 Python 程序中使用

```python
from shroom_sdk import Shroom

with Shroom.mock(rows=32, cols=32, fps=30) as device:
    for frame in device:
        print(frame.max, frame.area, frame.center.x, frame.center.y)
        # 示例只取第一帧；移除 break 可持续读取
        break
```

连接真实设备只需替换设备创建语句：

```python
from shroom_sdk import Shroom

with Shroom.connect("COM3", baud_rate=1_000_000, rows=32, cols=32) as device:
    frame = device.read_frame(timeout=2.0)
    if frame is None:
        print("等待完整帧超时", device.bytes_received, device.frame_count)
    else:
        print(Shroom.render_ascii(frame))
```

`with` 会在正常结束、异常或 Ctrl+C 时关闭连接。`read_frame()` 返回一帧或 `None`；`timeout` 单位是秒，可传 `None` 持续等待。设备关闭后再读写会抛出异常。

`for frame in device` / `device.frames()` 会在无数据时继续等待，不会因为一次超时终止。需要“没数据就结束”的任务，请直接用 `read_frame(timeout=...)` 判断。串口断开等 I/O 错误会向调用方抛出，不会静默忽略。

采用同步、单消费者读取，没有后台线程和无限累积的数据队列。不要让多个线程同时读取同一设备；耗时算法应与采集分离并使用有界队列，避免处理过慢导致操作系统串口缓冲区溢出。`break` 只结束循环，连接由外围 `with` 或 `close()` 释放。

## Frame 字段

| 字段 | Python 类型 | 含义 |
| --- | --- | --- |
| `raw` | `bytes` | 原始字节快照，未重排 |
| `values` | `array('f')` | float32 相对值，长度始终等于 rows × cols |
| `rows / cols` | `int` | 行列数 |
| `min / max / avg` | `float` | 极值与均值，计算规则与 JS 相同 |
| `area` | `int` | 超过 threshold 的点数 |
| `center.x / center.y` | `float` | 0～1 的加权重心，无有效点时为 0.5 / 0.5 |
| `timestamp` | `int` | 本机解码时的 Unix 毫秒时间，不是硬件采样时钟 |

行优先索引为 `frame.values[y * frame.cols + x]`。`frame.matrix()` 返回二维列表，`frame.to_dict()` 返回可以直接 `json.dumps()` 的快照。

需要 NumPy 时，用户自行安装后转换，不增加 SDK 基础依赖：

```python
import numpy as np

matrix = np.frombuffer(frame.values, dtype=np.float32).reshape(frame.rows, frame.cols)
# 上面是共享视图；需要独立修改/长期保存时使用 matrix.copy()
```

## API 与 JavaScript 对照

| JavaScript | Python |
| --- | --- |
| `Shroom.connect({path: 'COM3'})` | `Shroom.connect('COM3')` |
| `Shroom.mock({rows: 32, cols: 32})` | `Shroom.mock(rows=32, cols=32)` |
| `Shroom.listPorts()` | `Shroom.list_ports()` |
| `device.onFrame(callback)` | `for frame in device` 或 `device.read_frame()` |
| `await device.close()` | `device.close()`，推荐 `with` |
| `Shroom.renderAscii(frame)` | `Shroom.render_ascii(frame)`（纯文字） |
| `decodeFrame(payload, options)` | `decode_frame(payload, **options)` |
| `createFramer(options)` | `Framer(**options)` |
| `bytesReceived / frameCount` | `bytes_received / frame_count` |
| `droppedCount / frameLength` | `dropped_count / frame_length` |

也可直接导入 `connect`、`mock`、`list_ports`、`decode_frame`、`get_layout`、`resolve_shape`、`render_ascii`、`Framer`、`Frame`。`list_ports()` 返回 `PortInfo` 列表，包含 path、description、manufacturer、serial_number、vendor_id 和 product_id。

`connect()` 未传端口时，仅在检测到恰好一个端口时自动连接；存在多个端口会提示明确指定。`mock()` 可传 `seed=7` 获得可复现的模拟数据；Python 与 JS 的随机数算法不同，模拟原始字节不保证逐字节相同，但相同输入字节的解码结果一致。

## 协议和点位配置

```python
from shroom_sdk import Shroom

with Shroom.connect(
    "COM3",
    baud_rate=1_000_000,
    delimiter=bytes.fromhex("AA 55 03 99"),
    min_length=8,
    max_length=8192,
    lock_length=True,
    rows=32, cols=32,
    full_scale=255,
    threshold=0.02,
    layout="mat32",
) as device:
    frame = device.read_frame(timeout=2)
```

- `rows` 和 `cols` 必须成对指定；省略时，平方点数推断成方阵，其他长度推断成单行。
- `points=N` 只使用前 N 个字节；不足 rows × cols 的位置补零。默认 min_length=8，小于 8 点的设备需要调整。
- `layout='raw'` 保持扫描顺序；`layout='mat32'` 使用已有 32×32 压力垫排列，会连同重心一起变换。也支持一维排列列表 `perm[显示位置] = 原始下标`。
- Python 会拒绝未知布局、错误的 mat32 尺寸和无效排列，避免静默显示错误点位。
- 帧长锁定规则与 JS 相同：连续 3 帧同长度后锁定；新长度连续出现 12 次后重新锁定。可用 `lock_length=False` 接收变长帧。
- 两个分隔符之间才构成一个完整帧；最后一帧要等到下一个分隔符，超时不会强行输出半帧。
- 如协议要求发送启动命令，可用 `device.write(bytes.fromhex('...'))`，命令内容应来自该设备的协议文档。

手套不应直接套用 mat32；需要先确认手套实际协议、通道定义和 Mapping。

## 自己提供原始数据

```python
from shroom_sdk import Framer, decode_frame

framer = Framer()
chunk = bytes.fromhex("AA 55 03 99 00 20 40 60 80 A0 C0 FF AA 55 03 99")
for payload in framer.push(chunk):
    frame = decode_frame(payload, rows=2, cols=4)
    print(frame.matrix())
```

`Framer.push()` 支持分隔符跨数据块、一次收到多帧和前导杂字节；返回本次切出的 payload 列表。`reset()` 清理缓存与计数器。核心模块只使用 Python 标准库。

## 图形示例

安装 `[plot]` 后，在解压后的 SDK 根目录执行：

```bash
python python/examples/heatmap.py         # 模拟数据图形热力图
python python/examples/heatmap.py COM3    # 真实串口
python python/examples/read_frames.py    # 输出 100 帧基础统计
```

Matplotlib 示例显示相对值，不作物理标定。关闭图形窗口或按 Ctrl+C 会释放设备。纯服务器环境使用命令行和 `--json` 即可。

## 测试与构建

在本项目根目录，安装 `./sdk/python[serial]` 后：

```bash
python -m unittest discover -s sdk/python/tests -v
python -m pip install build
python -m build sdk/python
```

测试覆盖核心数值、线序、拆帧、长度锁定、异常释放、模拟设备、CLI，以及 pySerial `loop://` 回环。若可用 Node，测试会调用现有 JS 实现逐项比较 Frame 和拆帧结果；Node 只用于此项开发校验，不是 Python SDK 的运行依赖。硬件回环测试不能替代真实传感器联调。

wheel / sdist 生成在 `sdk/python/dist/`；官网统一 ZIP 包含 Python 源码、安装配置、测试和示例，排除本地虚拟环境、缓存和构建产物。独立 wheel/sdist 不带依赖兄弟 JS 目录的测试。

串口底层 API 参考 [pySerial 官方文档](https://pyserial.readthedocs.io/en/latest/pyserial_api.html)。
