# 基础文档

如果你使用已支持的手套或手部检测垫，只需要完整的取数、展示、带标签录制和下载，请先看[快速接入](QUICK-START.md)。这篇路线用于新设备、新协议、自定义界面和已有系统集成，不需要重做快速方案里已经封装好的能力。

## 开发路线 {#route}

先[安装并确认串口驱动](DRIVERS.md)，再激活 SDK 产品密钥。SDK 授权不限制设备型号；新协议仍需按设备资料配置和适配，不能用取消授权型号限制代替协议解析。

**确认设备协议 → 查询与配置串口 → 解析为标准数据帧 → 传输或存储 → 自定义渲染与业务逻辑。**

快速方案与自定义方案共用数据结构和基础能力，不是两套互不相通的 SDK。现有产品入口直接输出产品帧；自定义设备可以使用基础 `Frame` 接入 WS、录制和通用矩阵渲染。

## 后端：串口、解析和通讯 {#backend}

[后端基础 API](BACKEND-GUIDE.md)保留一整篇文档，使用顶部下拉框切换 Node.js / Python，串口、通讯、存储章节不变：

- [串口查询与配置](BACKEND-GUIDE.md#serial)：端口列表、连接、读帧、关闭、诊断和结构化错误。
- 解析与点位：`createFramer()` / `decodeFrame()`、矩阵尺寸、线序和产品映射。新协议先确认帧格式，不要把手套压力数组当成完整串口包重新解码。
- [通讯与已有后端](BACKEND-GUIDE.md#communication)：`BackendSdkClient` 查询和控制已经运行的主项目后端。它与快速方案中的独立 `serveDevice()` 不是同一协议。
- [存储基础](BACKEND-GUIDE.md#storage)：基础数据快照及 Python 文件输出；带标签会话与文件导出见[数据存储](STORAGE.md)。

Node.js 快速服务可接收已有 `onFrame()` 设备源；自定义源需要提供兼容的帧和订阅生命周期。不要把任意对象直接发到 WS 后假定渲染器能理解。

Python 目前只有基础串口、模拟、帧解析和矩阵能力，没有产品级手套连接、WS 服务或快速录制 API；语言切换不会让两种语言自动具备相同扩展能力。

## 前端：接收数据与自定义显示 {#frontend}

- [前端通讯 API](FRONTEND-COMMUNICATION.md)：Web Serial 产品直连、通用串口和已有后端客户端。
- [前端渲染 API](RENDERING.md)：`createHeatmap()`、显示参数、颜色和画布生命周期。
- [快速方案](QUICK-START.md#view)：通过 `connectStream()` 接收 SDK WS 服务，用 `createProductView()` 绑定产品画面。

`createHeatmap()` 是单矩阵画布；`createProductView()` 是现有产品的二维分区组合视图。自定义 3D 模型、图表、手势识别和回放由应用实现。ADC 与归一化数值没有物理压力或力的单位，不能直接标成 kPa / N。

## 录制、标签与下载 {#recording}

现有设备源可以复用 Node.js 持久化录制：开始会话时指定标签，停止等待写入完成，按记录标识导出 CSV 或 JSONL。浏览器通过 SDK 服务控制录制并下载文件，文件保存在服务端，不依赖页面持续打开或渲染。

会话标签不等于自动识别结果。一次会话一个标签；要做区间标注、多设备同步、数据库、云端上传或录像回放，需要另行设计应用逻辑。API、格式和错误处理见[数据存储](STORAGE.md)。

## 兼容已有系统 {#compatibility}

原有的后端、前端、Python、串口和渲染文档 URL 都保留；已有代码无需为了阅读新路线重命名 API。`BackendSdkClient.startCollection()` 仍然是调用已有主项目的采集接口，不会被解释成独立 SDK 的 `startRecording()`。

需要 AI 辅助开发时，把[SDK Skill / AI 上下文](../AI-CONTEXT.md)交给 AI，并说明产品、运行环境、数据源和所需交付。完整基础字段与排错见[SDK 说明](../README.md)。

## 辅助指南 {#guides}

- [安装串口驱动](DRIVERS.md)：Windows / macOS 驱动下载、安装后确认端口与连接排查。
- [SDK 授权](LICENSE.md)：激活不限制设备型号的 SDK 产品密钥，管理有效期与电脑名额。
- [SDK Skill / AI 上下文](../AI-CONTEXT.md)：把当前 SDK 的能力、接口与边界提供给 AI。
- [AI 开发指南](../怎么用AI开发.md)：说明设备与目标，生成并验证接入代码。
- [完整 API 与排错](../README.md)：查阅字段、示例与常见问题。
