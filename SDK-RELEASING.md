# 官网与 SDK 的同步

官网位于 [shroomSDKWEB](https://github.com/liudada118/shroomSDKWEB)，SDK 源码、测试和版本发布位于独立的 [shroomSDK](https://github.com/liudada118/shroomSDK)。官网的 `sdk/` 是固定提交的 Git 子模块。

**修改 SDK、升版或发布包，请进入 SDK 仓库，按 [SDK 发布指南](sdk/SDK-RELEASING.md) 操作。** 本页只说明官网如何取得、升级和回退 SDK。

## 初始化

首次取得官网源码：

```bash
git clone --recurse-submodules https://github.com/liudada118/shroomSDKWEB.git
cd shroomSDKWEB
npm ci
npm run verify
```

已有官网目录在拉取更新后执行：

```bash
git submodule update --init --recursive
npm run sdk:check
```

这会取得官网记录的 SDK 提交；不要使用 `--remote` 自动追踪 SDK 的 `main`。官网会检查 SDK 的独立仓库、远程地址、锁定提交和干净工作区；未提交源码、缺失或错位都会停止构建。资源生成后再次校验来源。

## 升级官网使用的 SDK

先在 SDK 仓库完成修改、检查并推送源码。需要正式版本时，再按 SDK 发布流程生成标签和 Release。官网更新引用时，选择已经推送的明确标签或审核过的提交：

```bash
git -C sdk fetch origin --tags
# 将 <已发布标签或审核过的提交> 替换为实际值。
git -C sdk checkout --detach <已发布标签或审核过的提交>
git add sdk
npm run verify
git diff --cached --submodule=log -- sdk
```

检查通过后，将 SDK 指针及本次官网变更一起提交到官网仓库。SDK 的新提交必须先存在于远端，否则官网 CI 和服务器无法初始化该子模块。官网构建不会自行提交、推送或创建 SDK Release。

日常修改 SDK 时，建议在单独的 SDK 检出目录使用开发分支；官网的子模块通常处于 detached HEAD，仅用于固定依赖。若在子模块内开发，应先创建自己的分支，避免误把未提交改动当成已经发布的版本。

## 官网命令与产物

| 命令 | 用途 |
| --- | --- |
| `npm run sdk:init` | 初始化官网记录的子模块提交 |
| `npm run sdk:check` | 检查来源、提交、版本与锁文件 |
| `npm run pack:sdk` | 委托 SDK 构建并镜像三份 ZIP 与网页资源 |
| `npm run build:docs` | 从锁定 SDK 的 Markdown 生成在线文档 |
| `npm run verify` | 官网集成检查：来源、文档、测试、类型、构建、SSR 和下载 |
| `npm run build` | 生成官网部署产物 |
| `npm run sdk:verify` | 转调独立 SDK 的完整门禁；需先准备 SDK 维护环境 |

官网普通构建只需官网自己的 npm 依赖。它读取 SDK 源码并执行不依赖硬件的打包工具，不需要 Python 或 SDK 的原生串口/SQLite 依赖。SDK 门禁的环境要求由 SDK 发布指南维护。

SDK 先生成 `sdk/dist/shroom-sdk.zip`、`sdk/dist/shroom-sdk-node.zip`、`sdk/dist/shroom-sdk-python.zip`，官网再镜像到 `public/`，保留现有三个下载 URL。网页版本和下载文件名取自 `sdk/package.json`；文档及代码示例也来自同一个 SDK 提交。

SDK 版本制品位于其仓库的 `dist/releases/<版本>/`，包含三份带版本号的 ZIP、来源清单、校验值及发布说明。历史版本从 SDK 的 GitHub Release 获取；没有已发布附件时，官网不会构造一个不可用的 Release 下载链接。网站构建和 GitHub Release 都不会自动部署线上官网。

## 回退

按升级的同一流程，将子模块 checkout 到此前使用的已推送提交，再 `git add sdk`、运行 `npm run verify` 并提交官网指针变更。回退 SDK 包前，检查对应更新说明与采集数据格式的兼容性。

原 `shroomSDK` 仓库的 `shroom-backend-sdk@0.2.0` 与当前五步 `shroom-sdk@0.1.0` 是不同包。此次按直接替换方式迁入，旧版保留在 Git 历史及 `legacy-backend-sdk-0.2.0` 标签；旧 API、UI 和数据库的边界见 [迁移说明](sdk/MIGRATION.md)。
