# 后端能力来源

本目录是 2026-08-28 从本机 `E:\ShroomSDK` 工作区迁入的 Node 后端能力快照。

- 上游包版本：`shroom-backend-sdk@0.2.0`
- 上游 Git 基线：`f5eb7f7`
- 迁入状态：上游工作区包含未提交修改，因此当前下载包版本标记为 `0.2.0-preview.1`
- 已验证范围：串口管理、协议与手套解析、采集、SQLite / 内存存储、回放、CSV、同步算法通道
- 基线验证：迁入前运行 120 个后端测试，全部通过
- 集成验证：增加 Frame 桥接、资源关闭与可选依赖测试后共 124 项通过

网站不会加载本目录。这里使用 CommonJS 与 Node 本地依赖，只通过 `shroom-sdk/backend` 或解压目录中的 `./backend` 使用；Web、Mock 和原有 Node ESM 入口保持不变。

## 当前工作区的集成差异

相对迁入时的 E 盘快照，当前技术预览包含以下可追踪调整：

- 新增 `src/integration/CoreDeviceBridge.js`，负责 Core / Backend Frame 双向适配、数值尺度标记和 TypedArray 恢复。
- 串口依赖改为按使用路径延迟加载；缺失时统一返回 `SERIAL_DEPENDENCY_MISSING`，内存存储和算法入口仍可加载。
- `ShroomSensorSDK.close()` 会等待关闭串口会话，再关闭存储。
- 采集记录支持 TypedArray；回放通过 `rawFrameHex` 恢复原始字节，桥接帧的统计字段与 CSV 对齐。
- 新增 Backend 公开类型声明、根导出合同测试、Core Bridge 测试、可选依赖测试和资源关闭测试。
- 示例命令与 CommonJS 生命周期按当前 `shroom-sdk/backend` 子入口修正。

正式版本仍应把 E 盘工作区提交为可复现的 Git 基线，并据此替换本技术预览快照。
