# Shroom SDK

压力传感器最小 SDK。**只做三件事**：连接串口 → 拿到数据 → 画成图。

提供 **浏览器 / Node.js / Python** 三种入口。Python 3.10+ 可独立安装，不需要 Node；详见 [Python SDK](python/README.md)。

官网下载时可选择 **Python** 或 **Node.js（含浏览器）**，分别得到 `shroom-sdk-python.zip` / `shroom-sdk-node.zip`。Node.js 包不含 Python 源码；Python 包内的 `python/README.md` 和 `python/AI-CONTEXT.md` 提供专用说明。旧链接 `shroom-sdk.zip` 仍保留完整包，兼容已有使用方式。

曲线、回放、报表、算法这些都不在里面，那是你（或者 AI）在这个基础上写的部分。

> **不想自己写代码？** 看 [怎么用AI开发.md](怎么用AI开发.md)——把 [AI-CONTEXT.md](AI-CONTEXT.md)
> 丢给 AI，然后说人话描述你要什么就行。

**Windows / macOS / Linux 都支持**，SDK 是同一份，不分平台版本。
浏览器示例的启动脚本（`start-demo.bat` vs `sh start.sh`）与串口驱动/权限随系统不同；Python 使用 pip 安装。
浏览器方案要 Chrome 或 Edge —— Safari 和 Firefox 三个平台上都没有 Web Serial。

---

## 30 秒跑起来

**想连真实设备 → 双击 `start-demo.bat`**（macOS / Linux 用 `sh start.sh`）。
它会自己切到正确目录、检查 Node、起服务器并打开浏览器；出错也不会一闪就关，能看清报错。
需要 Node 18 以上（`node -v` 查一下，没有就去 https://nodejs.org 装）。

**只想先看看长什么样 → 双击 `web/index.html`**，什么都不用装。
模拟数据、热力图、配色切换都能正常跑，只有「连接设备」是灰的 —— 要连真实设备用上面那个 `start-demo.bat`。

命令行开法：

```bash
# 浏览器示例（推荐先看这个）
node start.mjs
# 会自动打开浏览器；端口被占用会自动顺延到 5179、5180…

# 终端示例
node node/demo.js            # 模拟数据
node node/demo.js --list     # 列出串口
node node/demo.js COM3       # 连真实设备
```

macOS / Linux 可以用 `sh start.sh`。

---

## 浏览器里用

```js
import { Shroom } from './sdk/web/index.js';

const heatmap = Shroom.createHeatmap('#view');   // #view 是一个 <canvas>

document.querySelector('#btn').onclick = async () => {
  const device = await Shroom.connect({ baudRate: 1000000 });
  device.onFrame((frame) => heatmap.render(frame));
};
```

三行就是全部。`Shroom.connect()` **必须写在点击回调里**——浏览器规定串口只能由用户手势触发。

没有硬件就把 `Shroom.connect()` 换成 `Shroom.mock()`，其余代码一个字不用改：

```js
const device = Shroom.mock({ rows: 32, cols: 32, fps: 30 });
```

**浏览器要求**：Chrome 或 Edge（Safari / Firefox 没有 Web Serial），页面是 https 或 localhost。
用 `Shroom.isSupported()` 提前判断。

---

## Node / Electron 里用

```bash
npm i serialport
```

```js
import { Shroom } from './sdk/node/index.js';

const device = await Shroom.connect({ path: 'COM3', baudRate: 1000000 });
device.onFrame((frame) => {
  console.log(Shroom.renderAscii(frame));   // 终端里的彩色热力图
});
```

---

## Python 里用

在解压后的 SDK 根目录执行（在本仓库根目录时将路径改为 `./sdk/python[serial]`）：

```bash
python -m pip install "./python[serial]"
python -m shroom_sdk --frames 3   # 无硬件，先跑模拟数据
python -m shroom_sdk --list       # 列出串口
python -m shroom_sdk COM3         # 真实设备
```

```python
from shroom_sdk import Shroom

with Shroom.connect("COM3", rows=32, cols=32) as device:
    for frame in device:
        print(frame.max, frame.area, frame.center.x, frame.center.y)
```

没有硬件时用 `Shroom.mock(rows=32, cols=32)` 替换 `Shroom.connect(...)`。
`with` 自动关闭连接；需要超时判断时用 `device.read_frame(timeout=2)`，无完整帧返回 `None`。
Python 使用同步迭代和 snake_case 参数；字段语义、float32 数值和点位排列与 JS 一致。
提供终端文字热力图、可选 Matplotlib 示例；完整 API、安装和排错见 [Python SDK](python/README.md)。

---

## Frame：唯一的数据结构

不管数据从哪来（浏览器串口、Node 串口、Python、模拟），输出的字段含义一致。以下是 JavaScript 的 `onFrame` 对象；Python 使用 `Frame` 数据类，`raw` 为 bytes、`values` 为 array('f')：

```js
{
  raw,        // Uint8Array    原始 ADC 值 0~255，一个点一个字节
  values,     // Float32Array  归一化到 0~1，长度 = rows * cols
  rows, cols, // 矩阵尺寸
  min, max, avg,  // 归一化后的极值和均值
  area,       // 受力点数（超过阈值的点）
  center,     // { x, y } 压力重心，都是 0~1
  timestamp,  // 毫秒时间戳
}
```

`values` 是 0~1 的**相对值**，不是物理单位。要换算成 kPa 需要每台设备的标定数据，
不在这个 SDK 里。

要按行列取某个点：

```js
const v = frame.values[y * frame.cols + x];
```

---

## 点位排列（线序）

串口里那一串字节是**采集板的扫描顺序**，不等于垫子上的位置。不做转换直接铺成方阵，
按垫子最上面一行，画面上亮的可能是中间那一行——数值没问题，位置是错的。

每种产品的走线不一样，猜不出来，得按产品选：

```js
await Shroom.connect({ layout: 'carSeat' });   // 连接时选
Shroom.decodeFrame(payload, { layout: 'carSeat' });  // 自己接数据源时选
```

选了排列就**不用再传 `rows` / `cols`**，排列自己知道这块垫子是几行几列。

| layout | 产品 | 输出 |
| --- | --- | --- |
| `raw` | 不转换，按扫描顺序原样铺 | 按方阵推断 |
| `mat32` | 32×32 压力垫（床垫 / 手部垫 / 眠枕 / 宠物垫） | 32×32 |
| `sit` | 坐垫 | 32×32 |
| `bed1` | 床垫（另一版走线） | 32×32 |
| `carSeat` | 汽车坐垫 / 脚垫 | 32×32 |
| `carBack` | 汽车靠背 | 32×32 |
| `car10` | 汽车坐垫 10×10 | 10×10 |
| `car10Back` | 汽车靠背 10×10 | 10×10 |
| `sit10` | 坐垫 10×10 | 10×10 |
| `yanfeng10` | 延锋坐垫 | 10×10 |
| `yanfeng10Back` | 延锋靠背 | 10×10 |
| `volvo` | volvo 坐垫 | 32×32 |
| `volvoBack` | volvo 靠背 | 32×32 |
| `volvoHead` | volvo 头枕 | 10×10 |
| `smallM` | 长条垫 | 32×10 |
| `rect` | 方垫 | 16×10 |
| `short` | 短垫 | 32×32 |
| `matCol` | 列式垫 | 16×10 |
| `sitCol` | 列式坐垫 | 32×32 |
| `xiyue` | 喜悦 | 32×32 |
| `carCol` | 列式汽车垫 | 9×10 |
| `sit100` | sit100 坐垫 | 12×6 |
| `endiSit` | 恩迪坐垫 | 23×23 |
| `sofa` | 沙发 | 16×16 |
| `handSinglePoint` | 手部单点垫 | 32×32 |
| `wholeChair` | 整椅坐垫 | 16×16 |
| `wholeChairBack` | 整椅靠背 | 16×16 |
| `wholeChairHead` | 整椅头枕 | 10×10 |
| `tempFullBed` | 温度全床，只取压力那块 | 12×15 |
| `smallSample` | 小样垫（一帧 256 点） | 10×10 |
| `footInsole` | 触觉足底（一帧 256 点） | 10×6 |

这张表在代码里也能拿到：

```js
Shroom.listLayouts();  // [{ name: 'mat32', label: '32×32 压力垫', rows: 32, cols: 32 }, ...]
```

**但界面下拉框别用它**——上面这张表是按**走线**列的，用户手里拿的是**产品**。
好几款产品共用一条走线（手部检测、小床监测、宠物看护走的都是 `mat32`），
下拉框里写「32×32 压力垫」，用户对不上自己那台设备。下拉框用 `listProducts()`：

```js
Shroom.listProducts();
// [{ name: 'hand', label: '手部检测', layout: 'mat32', rows: 32, cols: 32 }, ...]

const p = Shroom.getProduct('petCare');
await Shroom.connect({ layout: p.layout });   // 下拉里的 value 是产品名，解码要的是线序名
```

| 产品 | 走线 | 输出 |
| --- | --- | --- |
| 手部检测 | `mat32` | 32×32 |
| 10*10小样 | `smallSample` | 10×10 |
| 触觉足底 | `footInsole` | 10×6 |
| 小床监测 | `mat32` | 32×32 |
| 小床检测(数据) | `mat32` | 32×32 |
| 温度全床系统 | `tempFullBed` | 12×15 |
| 宠物看护 | `mat32` | 32×32 |
| mini看护 | `mat32` | 32×32 |
| 16*16高速 | `raw` | 16×16 |
| 32*32高速 | `raw` | 32×32 |
| 32*32(检测点) | `handSinglePoint` | 32×32 |
| 正常测试 | `raw` | 32×32 |
| 人体全身 | `raw` | 32×32 |

名字和顺序都照抄公司桌面端的「请选择传感器」菜单，用户在两边看到的是同一串字，
下拉里也只写产品名，不写几乘几。
走线为 `raw` 的那几款，桌面端也不做线序转换，按扫描顺序原样铺就是对的。
桌面端的「整椅展示」是一项、三块板子接三个串口拼成一把椅子，这里一次只连一个口，
拼不出来，所以**整个不收**；小床褥监测则是桌面端菜单里本来就没有的一项，也没收。
这两个的走线（`wholeChair` / `wholeChairBack` / `wholeChairHead` / `matCol`）都还在上面那张走线表里，
真要单个垫子，自己传 `layout` 即可。

产品表里没有的设备，直接传 `layout` 用上面那张走线表，或者自己传 `rows` / `cols`。

三件要知道的事：

- **只搬位置，不改数值。** 个别产品的正式上位机还会做坏点插值、空行填补、压力换算，
  那些属于数值处理，不在这个 SDK 里。所以同一帧数据，这里的数字和正式上位机可能对不上，
  位置是对的。
- 有的产品有**没装传感器的空位**（比如 `carCol` 中间那一列），这些位置固定是 0。
- 大多数产品一帧是 1024 个点，`smallSample` 和 `footInsole` 是 256 个。排列自己知道要几个点，
  不用你操心；但**排列选错了帧长，画面会大片是空的**——这是选错型号最明显的症状。
- `tempFullBed` 只给压力矩阵，那三个温度点不在排列里，需要温度得自己从原始帧取。
- **手套类产品的线序不在这里**，找官方技术人员要。

拿不准手里是哪一款？打开网页测试台，挨个换着看，按下去的地方和画面上亮的地方对上了就是它。

---

## API

### 浏览器（`web/index.js`）

| 方法 | 说明 |
| --- | --- |
| `Shroom.connect(options?)` | 连接串口，返回 `Promise<Device>`。必须在用户点击里调用 |
| `Shroom.mock(options?)` | 模拟设备，接口与 `connect()` 完全一致 |
| `Shroom.createHeatmap(canvas, options?)` | 在 canvas 上创建热力图 |
| `Shroom.isSupported()` | 当前浏览器是否支持串口 |

### Node（`node/index.js`）

| 方法 | 说明 |
| --- | --- |
| `Shroom.connect(options?)` | 连接串口，`options.path` 不填就自动挑第一个 |
| `Shroom.listPorts()` | 列出可用串口 |
| `Shroom.mock(options?)` | 模拟设备 |
| `Shroom.renderAscii(frame, options?)` | 把一帧画成终端里的彩色方块 |

### Device

```js
device.info                    // { source, rows, cols, baudRate | path | fps }
const off = device.onFrame(fn) // 订阅，返回取消订阅的函数
device.bytesReceived           // 收到的原始字节数（串口设备才有）
device.frameCount              // 成功切出的帧数（串口设备才有）
device.droppedCount            // 丢掉的脏帧数，一直涨说明参数配错了
device.frameLength             // 锁定下来的帧长（字节），还没锁上是 0
await device.close()           // 断开
```

### Heatmap

```js
const heatmap = Shroom.createHeatmap('#view', { mode: 'dots' })
heatmap.render(frame)
heatmap.setOptions({ colormap: 'jetWhite', gain: 2, dotSize: 1.4 })
heatmap.clear()
```

**三种画法**：

| mode | 长什么样 | 适合 |
| --- | --- | --- |
| `'dots'`（默认） | 带透视的点阵，没受力的地方是一片蓝色底噪，受力的地方顶起来并变绿变黄变红 | 和 Shroom 桌面端一样的观感 |
| `'heat'` | 每个传感点一个圆斑，边缘淡出，叠加成一片 | 看整体压力分布 |
| `'grid'` | 一个点一个方格 | 看原始矩阵、调试尺寸 |

点阵那条链路和桌面端是同一套：把每个传感点甩到一个更密的格子上 → 高斯摊开 →
逐点做时间柔化 → 按值定高度、按值取颜色。**每个格点都画**，包括没受力的，
它们落在 jet 的最低档正好是纯蓝，那片蓝底就是点阵的底子。整个过程只用 canvas，
不依赖 Three.js。

其他参数：`colormap` 可选 `'jet'`（彩虹）、`'jetWhite'`（白底）、`'grey'`（灰度），
也可以直接传自己的函数 `(t) => [r, g, b]`，`t` 是 0~1；
`gain` 是显示增益，信号弱时调大；`dotSize` 是点 / 圆斑的大小倍数；
`relief` 是点阵起伏高度倍数（给 `0` 就是平的俯视点阵）；
`tilt` 是俯视角（度，默认 70）——**嫌点阵看着太扁就调它**，越大越像正俯视、
方阵看过去越方，示例页面上有个「视角」滑块可以直接拖；
`flipY` 决定数据第一行画在近处还是远处（默认 `true` = 近处）——**按下面却是上面鼓起来
就把它设成 `false`**，示例页面上是「前后翻转」那个勾。

`render()` 只是记下这一帧，实际绘制放在下一个屏幕刷新周期。所以数据来得再快
（串口 1000000 波特下一秒上百帧）也不会多画一次，画面不会闪，CPU 也不会白烧。

---

## 连接参数

```js
await Shroom.connect({
  baudRate: 1000000,                       // 默认 1000000
  delimiter: [0xAA, 0x55, 0x03, 0x99],    // 帧分隔符，默认就是这个
  layout: 'mat32',                        // 点位排列，见上面那张表；不填就是 'raw' 不转换
  rows: 32, cols: 32,                     // 不填按方阵推断：1024 个点 → 32×32；给了 layout 就不用填
  fullScale: 255,                         // 满量程
  threshold: 0.02,                        // 算 area / center 时的有效点阈值
  lockLength: true,                       // 锁定帧长，默认开，见下
});
```

**关于 `lockLength`。** 分隔符只有 4 个字节，数据里迟早会撞出一模一样的一串
`AA 55 03 99`，于是切出一个长度不对的短帧。这种长度多半不是完全平方数，
解码时会退化成 `1×N`——画面就在方阵和一条横线之间来回闪。
所以切帧器默认会：连着 3 帧长度一致就把这个长度锁死，之后长度对不上的一律当脏帧丢掉；
万一锁错了（比如开头第一帧本身就是残的），另一个长度连着来 12 次就改锁它，能自己纠回来。
`device.frameLength` 能看到锁在了多少字节。真要收变长帧就传 `lockLength: false`。

**点「连接设备」没反应？** 对照下面这张表：

| 现象 | 原因 | 怎么办 |
| --- | --- | --- |
| 「连接设备」是灰的，页面顶上有黄条 | 你是双击 `web/index.html` 打开的，`file://` 下没有串口 | 改用 `start-demo.bat` |
| 页面一片空白 / 样式全乱 | 浏览器太老 | 换新版 Chrome 或 Edge |
| `localhost:5178` 打不开 | 服务器没起来 | 见下面「服务器起不来」 |
| 提示「不是安全上下文」 | 页面地址不是 https 或 localhost | 换成 localhost，或给站点配 https |
| 提示「没有 Web Serial API」 | 浏览器不支持（Safari / Firefox / 部分国产壳浏览器） | 换 Chrome 或 Edge |
| 弹了框但列表是空的 | 设备没插好，或缺 USB 串口驱动 | 见下面「按系统看驱动与权限」 |
| 点了「连接设备」直接说「你取消了选择」 | 弹框被你关掉了 | 重新点，在列表里选中设备再确认 |

**按系统看驱动与权限**（列表是空的、或 Node 端 `listPorts()` 返回空时看这里）：

| 系统 | 要做的事 |
| --- | --- |
| Windows | 装 CH341SER 通用驱动，然后在**设备管理器 → 端口 (COM 和 LPT)** 里确认出现了 COM 口 |
| macOS | 较新的系统自带 CH34x 驱动，插上后应能看到 `/dev/tty.usbserial-*`（终端里 `ls /dev/tty.*` 查）。没有就装 CH34x 驱动，装完要在「系统设置 → 隐私与安全性」里放行 |
| Linux | 驱动通常在内核里，但**默认用户没有串口权限**：打开设备会报 `Permission denied`。执行 `sudo usermod -aG dialout $USER` 后**重新登录**（`newgrp dialout` 可临时生效）。设备名一般是 `/dev/ttyUSB0` 或 `/dev/ttyACM0` |

> Linux 上还有一个坑：某些发行版的 `brltty` 服务会把 CH340 抢走当盲文设备。
> 插上后 `/dev/ttyUSB0` 一闪就消失的话，`sudo systemctl stop brltty` 试一下。

**服务器起不来 / `localhost:5178` 打不开？** 先看运行 `node start.mjs` 的那个窗口打印了什么：

| 窗口里的提示 | 意思 | 怎么办 |
| --- | --- | --- |
| `这个目录下没有 web/index.html` | 你在外层文件夹里跑的 | 解压出来常常是 `shroom-sdk\shroom-sdk\`，要 cd 到**里面**那层 |
| `'node' 不是内部或外部命令` | 没装 Node 或没进 PATH | 装 Node.js 18+，装完**重开**一个终端窗口 |
| `端口 5178 被占用，换 5179 试试` | 端口冲突 | 按它最后打印的那个地址开 |
| 窗口一闪就没了 | 双击了 `start.mjs` | 双击 `start-demo.bat`，或在终端里跑 |
| 什么都没打印 | 命令没真正执行 | 确认你按了回车、且当前目录下有 `start.mjs`（`dir` 看一下） |

服务器起来的标志是窗口里出现 `Shroom SDK 示例已启动：http://localhost:xxxx`，**并且这个窗口不能关**。关掉窗口服务器就停了，页面自然打不开。

**连上了但没画面 / 画面是花的？** 示例页面右下角有一行诊断数字，照着它判断：

| 诊断 | 说明 | 怎么办 |
| --- | --- | --- |
| 字节 = 0 | 设备根本没往外发数据，和解析无关 | 确认选对了 COM 口；设备是否需要先发启动指令；换根数据线 |
| 字节在涨，帧 = 0 | 数据来了但切不出帧 —— **波特率或分隔符不对** | 换波特率：`1000000`（默认）、`921600`（手套 / 机器人）、`1500000`、`3000000`、`115200` |
| 帧在涨，画面花 | 帧切对了但矩阵尺寸不对 | 显式指定 `rows` / `cols`，别靠方阵推断 |
| 帧在涨，按下去的位置不对 | 没选点位排列，画的是采集板的扫描顺序 | 按产品选 `layout`，见上面那张表 |
| 画面变成一条横线 | 帧长不是完全平方数，推不出方阵 | 显式指定 `rows` / `cols`；`device.frameLength` 就是实际帧长 |
| 帧在涨，丢弃也在涨 | 数据里撞出了假分隔符，被帧长锁定挡掉了 | 正常现象，画面稳就不用管；一直猛涨才是波特率不稳，换一档试试 |

代码里对应的是这三个计数：

```js
device.bytesReceived   // 串口收到的原始字节数
device.frameCount      // 成功切出的帧数
device.droppedCount    // 长度不合法被丢掉的帧数
device.frameLength     // 锁定下来的帧长（字节）
```

---

## 目录

```
sdk/
├─ core/          纯逻辑，浏览器和 Node 共用，不碰任何设备 API
│  ├─ framer.js     字节流 → 一帧一帧
│  ├─ frame.js      一帧字节 → Frame 对象
│  ├─ colormap.js   0~1 → 颜色
│  ├─ device.js     帧订阅
│  └─ mock.js       模拟数据源
├─ web/           浏览器：Web Serial + canvas 热力图 + 示例页面
│  ├─ serial.js         ★ 串口连接就在这里（Web Serial API）
│  ├─ heatmap.js        canvas 渲染，三种画法
│  ├─ index.js          模块版入口，正经项目 import 这个
│  ├─ index.html        示例页面，代码已内联，单独拷到哪都能双击打开
│  └─ shroom.bundle.js  单文件版（自动生成），给不想用模块的人直接 script 引
├─ node/          Node / Electron
│  ├─ serial.js     ★ 串口连接就在这里（serialport）
│  ├─ ascii.js      终端里的彩色方块图
│  ├─ demo.js       命令行示例
│  └─ index.js      Node 入口
├─ python/        Python 3.10+，独立 pip 包（无需 Node）
│  ├─ pyproject.toml   本地安装与 wheel/sdist 构建配置
│  ├─ src/shroom_sdk/  串口、Frame、拆帧、排列、Mock、CLI
│  ├─ examples/        逐帧读取与 Matplotlib 热力图
│  ├─ tests/           Python 测试、串口回环、JS 对照校验
│  └─ README.md        Python 完整使用文档
├─ start.mjs      打开浏览器示例用的小服务器
├─ AI-CONTEXT.md  给 AI 看的说明，直接把这个文件丢给它
├─ 怎么用AI开发.md  给人看的：怎么把这个 SDK 交给 AI
└─ index.d.ts     TypeScript 类型
```

**JavaScript 串口连接在哪？** 上面打 ★ 的那两个文件：浏览器是 `web/serial.js`，
Node 是 `node/serial.js`。两者都是「读到字节 → `core/framer.js` 切帧 →
`core/frame.js` 解码 → 通过 `core/device.js` 发给你的 `onFrame`」，
所以两端拿到的 Frame 完全一样，业务代码可以直接搬。

Python 串口入口在 `python/src/shroom_sdk/device.py`；调用 Python 的 `framer.py` 和 `frame.py`，
通过同步迭代或 `read_frame()` 读取。它与 JS 使用相同协议，通过跨语言测试保持数值和拆帧一致。

`core/` 不依赖任何环境 API，想接别的数据源（WebSocket、蓝牙、文件回放）
自己调 `createFramer()` + `decodeFrame()` 就行，拿到的还是同一个 Frame。

---

## 拿去问 AI

SDK 里有一份专门写给 AI 读的说明：**[AI-CONTEXT.md](AI-CONTEXT.md)**。
把它整个丢给 AI（拖进对话框，或者复制粘贴），然后描述你想做的东西：

> 帮我做一个页面：用重心控制一个小球移动，压力超过 0.5 就变色。

它里面写全了 API、Frame 结构、几条硬性约束（用户手势、安全上下文、
数据是 0~1 相对值而不是 kPa）和可以直接抄的例子，AI 照着就能写出跑得起来的代码。

完整流程见 **[怎么用AI开发.md](怎么用AI开发.md)** ——包括怎么描述需求、
AI 写出来的东西怎么跑起来、报错了怎么跟它说。

SDK 负责把数据稳定地给到你手上，剩下的想怎么玩都行。
