---
name: shroom-sdk
description: 在现有 JavaScript 或 TypeScript 项目中接入 Shroom SDK 设备取数、串口选择、WebSocket、SQLite 采集与下载，并排查接入错误。用于触觉手套、手部检测垫、人体全身和鞋垫的 SDK 开发；不用于控制上位机，也不提供硬件访问或 MCP 服务。
---

# Shroom SDK 接入

把用户选定的 Shroom 产品接入现有应用，优先用一次 `readProduct()` 得到产品数据。只在用户需要网页传输或保存记录时继续五步流程。本文以 `shroom-sdk@0.5.0` 为基线；分包手套要求 0.4.0，人体和鞋垫从 0.3.0 起支持。先核对项目已安装版本、类型声明和现有调用，再根据用户的接入任务安装或升级依赖；安装 Skill 本身不会升级 SDK。npm 安装和版本核对见调用参考。

## 工作方式

1. 先检查项目框架、运行位置和已有 SDK 集成。确认产品与串口由谁选择；手套先确认分包/整包协议；Node 0.5.0 分包手套可自动识别左右手或手动选择，鞋垫确认是受支持的 A 版、明确左右脚并按固件核对 `12bit / 8bit` 协议。Node 服务与网页端使用相同版本；使用分包手套时两端都需至少为 0.4.0，不能只更新串口服务而保留旧 WS 解码器。缺少必要信息时询问，先完成不依赖这些信息的代码。不要从串口名称、压力或帧长猜型号、侧别或协议。
2. 实现接入代码时读 [references/integration.md](references/integration.md)，按需要取用 Node、浏览器和采集片段。普通项目使用公开包入口，不把 SDK 源码复制到业务目录，也不导入安装包内部文件。
3. 将串口查询、取数和采集动作接到现有界面或调用点；显示错误与连接状态。保留用户已有业务流程，不为只取数的需求添加完整示例站或数据库管理界面。
4. 运行项目已有的类型、构建或相关验证。真机测试只在用户已授权连接所选设备、启动服务或采集的范围内执行；写接入代码和安装本 Skill 本身不授予这些权限。没有真机时明确哪些行为尚未验证，不将模拟帧当成实测结果。

## 必须保持的 API 边界

- 五个快速函数均来自 `shroom-sdk/quick-flow`：`readProduct`、`createWS`、`startRecording`、`stopRecording`、`downloadRecording`。`listPorts` 与 `scanProductPorts` 来自 `shroom-sdk/node`；自动取数内部复用扫描，不发明第六个快速函数。
- Node 使用 `readProduct({ product, path, side?, onData, onError, onStateChange? })` 直连串口。Node 0.5.0 分包手套可省略 path/side 自动发现，也可传 path+side 手动连接；鞋垫 `insole` 必须传 `side: 'left' | 'right'`；手垫 `pad`、人体 `body` 不传 side。鞋垫另支持 `protocol: '12bit' | '8bit'`（默认 12bit）及限定的 `baudRate`，其余产品不接受这两个覆盖参数。规范 ID、配置与字段见调用参考；不在业务代码中重复实现线序。
- 从 0.4.0 起，`glove` 与 `connectGlove()` 默认使用 `handGloveSegmented` 分包手套。一只手一个串口，手动模式按实物传 side；自动模式根据 packetType 的 1=左/2=右识别，同侧至少 3 个完整配对才匹配。类型不是唯一设备编号或 sequence。旧整包设备必须显式用 `handGloveFullPacket`，不能沿用 `glove` 别名。
- 浏览器通过 `readProduct({ url, onData, onError })` 接收 Node WS；不传串口参数，不在浏览器调用 `createWS`。直接 Web Serial 是另一条基础 API 路线，需要用户手势，不能套用 Node 重连配置。
- `listPorts()` 仅枚举串口，不打开设备、不需要激活。提供明确选择与刷新入口，不默认取 `ports[0]`。设备不可见时先检查驱动、USB 连接与权限：[Windows 驱动](https://shroom.jq-industries.com/drive/CH341SER.EXE)、[macOS 驱动](https://shroom.jq-industries.com/drive/CH34xVCPDriver.zip)。
- 真实设备需独立 Shroom SDK 密钥，不能使用上位机密钥。由客户在本机配置密钥与稳定安装标识，调用 `Shroom.activateLicense`；不要要求客户把密钥、认证配置或完整授权响应贴到聊天，也不把密钥写入代码、日志、Skill 或前端构建产物。有效期、电脑名额及功能权限仍受校验；SDK 授权不限制传感器型号。
- 用户要求断公网工作时，先确认许可模式：只有不限电脑数量的有效 RSA 离线码可纯本地验签；在线密钥和限制电脑数量的 RSA 离线码均需联网持续复核。不能因为设备、WS 和 SQLite 都在本机，就承诺可离线采集；具体激活分支见调用参考。

- `scanProductPorts()` 需要 serial 授权，按 921600 波特率逐口只读探测，默认每口 1200ms，不发送指令；样本不进入业务回调或采集，所有探测口关闭后才正式连接。零匹配为 PORT_NOT_FOUND、多匹配为 PORT_AMBIGUOUS，详情在 error.details.scan；可用 side 筛选或 scan.paths 限定。只支持 Node 分包手套，Web Serial 仍需手动 side。

## 连接与采集语义

- 首次查询、连接、起停失败用 `try/catch`；运行错误用 `onError`。显示 `error.code / message / suggestion` 的必要信息，不假装所有错误都可重试。
- Node 产品入口从 0.2.0 起默认重连原 `path`，间隔 3 秒、最多 3 次；`reconnect: false` 可关闭。使用 `onStateChange({ state, path, attempt, maxAttempts })` 或 `device.onStateChange`，状态为 `open / reconnecting / closed / error`。`open` 不等于已收到有效帧；回调可能早于连接 Promise 完成，不引用尚未赋值的 device。
- 重连复用原设备和数据订阅；不要在每次 `onError` 中再次创建连接或调用 close。首次打开失败、主动关闭、授权失效、解析错误及清理失败不自动重试；COM 号变化需重新选择。通用 Node `connectSerial` 默认关闭重连，Web Serial、WS 客户端没有此重连能力。
- Node 采集保存在 SQLite，CSV/JSONL 是导出格式。开始、停止、下载由用户动作分别触发，复用同一 `stream` 或 `server`；停止等待写入完成，下载使用刚停止的记录 ID。串口断线将当前记录以 error 收尾；重连只恢复取数，用户需显式开始新记录，不自动续录或补齐缺失帧。
- 网页 WS 断线不自动重连，也不会停止 Node 录制。重新建立的 `stream` 不继承旧连接的快速下载记录 ID；先用基础 `getRecordingStatus / listRecordings` 核对服务端状态，按实际记录 ID 恢复下载。不要把两类断线混为一谈，或靠重新 start 猜测恢复；流程见调用参考。
- `createWS` 接管设备，退出时 `await server.close()`；只取数则 `await device.close()`。网页 `stream.close()` 不会停止服务端录制，结束记录要显式 stop。不要猜测 SQLite 表字段、串口协议或产品字段；需要扩展时查对应版本的类型与基础文档。

## 交付

说明改动位置、调用方式、实际使用的 SDK 版本、已验证结果及仍需客户本机完成的驱动/授权/真机步骤。手套读取 `fingers / palm / imu.raw`，手垫读取 `pressureMatrix / values`；人体读取 `regions`（十区、400 个唯一通道），鞋垫读取 `sensors`（112 个真实点）和 `imu`。鞋垫 12-bit ADC 用 `Uint16Array` 保留 0–4095，不能压成字节；两种新产品的顶层矩阵都是扫描顺序，不是人体/鞋形图。ADC 和归一化值不是物理压力单位，IMU 不由 SDK 推断为欧拉角。新产品没有内置 `createProductView`，应用自行消费 `onData` 展示；不要编造渲染支持。

本 Skill 是可复用的开发指引，不包含 SDK 运行包、密钥、实时设备数据或 MCP 工具。当前 Shroom 未提供 MCP 服务，不生成虚构的 MCP URL 或配置。
