# Shroom SDK、手套接入与 Skill 待办

> 更新日期：2026-08-26
> 目标：让用户只需说明产品型号、连接方式和开发目标，Shroom Skill 就能基于 SDK 生成、验证并排查可运行的接入代码，而不需要猜测 Profile、Frame 字段或 Mapping 规则。

## 范围与原则

- `E:\ShroomSDK` 是 SDK 实现、类型、Schema、设备描述和示例的事实源。
- `C:\sdk` 是 SDK 展示站，负责呈现真实能力、兼容性、下载和文档入口，不自行定义 SDK 接口。
- Shroom Skill 只描述接入决策与工作流，并按需读取 SDK 事实源；不要复制一份容易过期的 API 手册。
- 首个闭环以一款真实手套产品为样板，验证通过后再推广到床垫、鞋垫和其他传感器。

## P0：先完成一款手套的可验证闭环

### 1. 确定首款样板手套

- [ ] 确认产品名称、销售型号、硬件版本和固件版本范围。
- [ ] 确认它对应现有哪个 Profile：`hand0205`、`hand0205Double`、`handGlove115200`、`handGloveFullPacket`、`hand` 或 `handSinglePoint`。
- [ ] 明确单手/双手、每只手的压力点数、串口数量和默认波特率。
- [ ] 明确现有 `sit` / `back` 通道与左手 / 右手的对应关系；公共接口改用可理解的角色名。

验收标准：给出产品型号后，可以唯一确定 Profile、固件范围、点数、串口参数和左右手角色，不依赖口头经验。

### 2. 建立产品自描述文件

- [ ] 在 SDK 中增加版本化的设备描述，例如 `devices/glove-<model>.json`。
- [ ] 至少包含 `productId`、产品名称、Profile、固件范围、通道角色、点数、串口参数、Mapping ID 和驱动要求。
- [ ] 定义设备描述 Schema，并在测试中校验所有内置设备描述。

验收标准：Skill 可以读取设备描述自动生成连接参数，不需要在 `SKILL.md` 中硬编码产品知识。

### 3. 统一 SensorFrame 公共契约

- [ ] 定义并导出版本化的 `SensorFrame` 类型与 JSON Schema。
- [ ] 统一压力数据字段，避免串口的 `data` / `pressureData`、后端的 `value` / `frames`、UI 的 `wsPointData` 并存。
- [ ] 明确 `sensorType`、`productId`、`channel`、`side`、`timestamp`、点数、矩阵尺寸、排列方向、单位和统计字段。
- [ ] 明确手套 `rotate` 数据究竟是原始字节、欧拉角还是四元数，并记录单位、端序与标定方式。
- [ ] 为旧数据结构提供显式适配器，避免直接破坏现有调用方。

验收标准：本地串口、上位机后端和 UI 渲染器都能消费同一个 `SensorFrame`；TypeScript 能在编译期发现字段错误。

### 4. 定义手套 Mapping 合同

- [ ] 增加 `glove-mapping.schema.json`，包含版本、产品、左右手、通道编号、部位和三维坐标。
- [ ] 明确通道编号从 0 还是 1 开始、坐标单位、原点、轴方向、row-major 规则和左右手镜像规则。
- [ ] 为样板手套提供经过业务确认的左手、右手 Mapping 文件。
- [ ] 校验 Mapping 点数与设备描述、Frame 点数一致。
- [ ] 提供 `validate-mapping` 脚本，并输出可定位到具体点位的错误。

验收标准：同一真实帧经过 Mapping 后，手掌和五根手指的位置、左右手方向均正确；非法 Mapping 会明确失败。

### 5. 增加真实数据 Fixture 与协议校验

- [ ] 为样板手套保存脱敏后的真实原始帧和期望解析结果。
- [ ] 覆盖静止、按压、左右手、多帧连续输入、脏帧和截断帧。
- [ ] 根据真实协议校验包头、包尾、长度、包类型、点数以及校验和/CRC（若协议存在）。
- [ ] Profile 不匹配时返回明确错误，而不是继续输出看似有效的错误数组。

建议结构：

```text
fixtures/gloves/<model>/
├─ raw-frame.bin
├─ expected-frame.json
└─ expected-mapping.json
```

验收标准：没有实体硬件时也能用 fixture 重放并得到固定结果；错误 Profile 和损坏帧不会被误判为正常数据。

### 6. 提供一站式手套 Quick Start

- [ ] 新增一个最小示例，覆盖发现端口、选择产品、连接左右手、接收 Frame、校准、渲染和关闭资源。
- [ ] 示例不得要求用户理解 `sit` / `back`、内部深路径或 `wsPointData`。
- [ ] 同时提供 mock/fixture 模式和真实硬件模式。
- [ ] 写明成功时的预期输出和常见失败提示。

验收标准：新开发者从安装到看到第一帧数据只需一个示例文件，并且示例可由自动测试执行。

### 7. 修正展示站当前的概念性接口与能力承诺

- [ ] 核对页面中的 `Shroom.create()`、`sdk.devices.connectFirst()`、`device.loadMapping()`、`device.onFrame()` 是否真实存在。
- [ ] 尚未实现的接口要么替换为当前 SDK 可运行写法，要么明确标注为“规划 API”，不能作为 Quick Start 展示。
- [ ] 在 Skill 尚未正式创建前，将“Skill 已包含设备协议、Mapping 规则与示例”改为与实际交付状态一致的描述。
- [ ] 在跨平台安装和原生依赖尚未经过兼容矩阵验证前，将“SDK 不区分操作系统”调整为“统一 API、目标跨平台”。
- [ ] 页面代码片段应来自 SDK 中可执行的 example，并在发布检查中实际运行。

验收标准：展示站中的每一段接口代码都能在对应 SDK 版本运行；每一项能力承诺都能链接到实现、文档或测试证据。

## P1：让 Shroom Skill 稳定完成接入

### 8. 创建最小 Skill

- [ ] 创建 `shroom-sdk-integration/SKILL.md`，只保留任务识别、模式选择、执行步骤、验证方式和停止条件。
- [ ] 区分“连接正在运行的上位机后端”和“SDK 本地直读串口”两条路径。
- [ ] 让 Skill 优先读取 SDK 的类型、Schema、设备描述和真实示例，不重新抄写 API。
- [ ] 未确认产品型号、固件或 Mapping 时明确标记未知，不猜测。

建议按需资料：

```text
references/
├─ device-profiles.md
├─ compatibility.md
└─ troubleshooting.md
```

只有当 Skill 需要新增自定义协议/Profile 时，再增加底层串口协议资料。

验收标准：Skill 能根据样板手套描述选择正确路径和资料，不加载无关产品文档。

### 9. 补充兼容性与故障恢复

- [ ] 列出已验证的 Windows、macOS、Linux、CPU 架构、Node 版本、浏览器和驱动组合。
- [ ] 记录 CH34x 驱动、Linux 串口权限、端口占用和原生依赖安装问题。
- [ ] 定义稳定错误码，例如 `PROFILE_MISMATCH`、`FRAME_LENGTH_MISMATCH`、`MAPPING_SIZE_MISMATCH`、`PORT_IN_USE`。
- [ ] 按现象编写排障决策树：找不到设备、有原始帧无解析帧、左右手颠倒、画面全黑、WebSocket 断开等。

验收标准：Skill 可以根据错误码选择下一步，并在有限次数后停止，不进行无边界重试。

### 10. 做独立场景测试

- [ ] 测试“已知型号 + 已知端口”的本地串口接入。
- [ ] 测试“已知型号 + 上位机地址”的 HTTP/WebSocket 接入。
- [ ] 测试左右手 Mapping 生成与校验。
- [ ] 测试型号未知、固件未知、端口被占用和错误 Profile。
- [ ] 检查生成代码是否只使用稳定公开入口。

验收标准：至少一组不提前告知预期答案的测试可以从用户描述走到可验证结果。

## P1：SDK 接口与可靠性整改

- [ ] 修复 WebSocket `error` 无监听者时可能终止 Node 进程的问题。
- [ ] 修复 `getContract()` 刷新后丢失用户自定义 routes 的问题。
- [ ] 修复实时消息 `value: 0` 不触发 Frame 的问题。
- [ ] 让 SDK 统一跟踪并关闭 Session、采集、串口和存储资源，提供可等待且幂等的 `dispose()`。
- [ ] 为 HTTP 增加 timeout、`AbortSignal`、headers/auth 和结构化错误。
- [ ] 为 WebSocket 增加状态机、可选重连、心跳、退避和恢复订阅。
- [ ] 为串口开放必要的 `dataBits`、`stopBits`、`parity`、流控和缓冲配置。
- [ ] 补齐根 SDK、Frame、Profile、事件和渲染器的 TypeScript 类型。
- [ ] 新增稳定语义入口，逐步废弃公开的 `src/*` 深路径。

验收标准：示例和 Skill 不依赖内部文件路径；连接失败、断线和关闭过程可预测且有测试覆盖。

## P1：展示站真实业务接入

- [ ] 将产品、规格书、SDK、Skill、Mapping、网页测试和上位机按钮替换为真实链接。
- [ ] 为 Skill 提供明确的安装入口、支持任务和首个手套示例。
- [ ] 展示真实兼容矩阵；完成验证前使用“统一 API、目标跨平台”，不要承诺任意平台开箱即用。
- [ ] 接入真实试用申请接口、隐私说明和提交失败处理。
- [ ] 提供稳定在线文档地址，并让 SDK README、包元数据和展示站指向同一地址。
- [ ] 增加真实手套数据驱动的在线演示，而不只使用生成数组。

验收标准：页面没有占位下载和空链接，所有公开承诺都能由已发布 SDK、文档或测试证明。

## P2：发布与长期维护

- [ ] 明确 SDK 是内部包还是公开包；公开包补齐源码许可证、仓库、主页、问题反馈和支持渠道。
- [ ] 将 HTTP/WebSocket 客户端、平台无关 Core、Node 串口/SQLite Adapter 和 React UI 拆为独立入口或独立包。
- [ ] 构建并发布可直接消费的 ESM/CJS、CSS 和 `.d.ts`，减少宿主转译未编译 JSX/SCSS 的负担。
- [ ] 建立 Node LTS × Windows/macOS/Linux 的 CI；发布任务中至少一个环境必须完整运行 SQLite 测试，不允许静默跳过。
- [ ] 统一 package 版本、Git tag、CHANGELOG、在线文档版本和发布产物。
- [ ] 从类型与 Schema 生成可生成的 API 表格，避免文档与实现漂移。

## 完成定义

满足以下条件后，首款手套的 SDK + Skill 接入闭环才算完成：

- 用户只提供产品型号、操作系统、端口或上位机地址和目标功能。
- Skill 能唯一选择设备描述和 Profile，生成只使用稳定公开 API 的代码。
- 代码可通过真实 fixture 自动验证，并能正确处理左右手 Mapping。
- 错误 Profile、损坏帧、端口占用和连接失败都有明确错误与恢复步骤。
- SDK 类型、Schema、设备描述、示例和在线文档是唯一事实源，Skill 不保存重复副本。
- 展示站的安装、下载、文档和试用入口全部真实可用。
