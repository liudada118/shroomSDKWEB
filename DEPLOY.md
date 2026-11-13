# 部署与发布

这份文档说明本站的构建、PM2 / Nginx 部署，以及三平台 Shroom 上位机下载链接的更新流程。
当前上位机安装包已在独立下载站提供，**无需把上位机安装包上传到本站服务器或放入 `public/`**。JavaScript SDK 默认从 npm 注册表安装；本站保留精简 TGZ 备用下载和历史安装地址。
页面本身怎么写、SDK 怎么用不在这里，看 [ARCHITECTURE.md](ARCHITECTURE.md) 和 [sdk/README.md](sdk/README.md)。

本站是 [shroomSDKWEB](https://github.com/liudada118/shroomSDKWEB)，`sdk/` 由独立 [shroomSDK](https://github.com/liudada118/shroomSDK) 仓库提供，官网记录固定提交。SDK 升版和 Release 在 SDK 仓库执行，官网如何升级所引用的版本见 [SDK 同步指南](SDK-RELEASING.md)。

---

## 1. 构建与启动

SDK 授权需先发布共用后台 `E:/key` 的产品隔离更新并执行其 `drizzle/0023_license_product_types.sql` 迁移，再发布新 SDK。后台必须保留既有发行密钥和电脑名额签名配置；本次只新增迁移文件，没有操作生产数据库或重启服务。后台旧版本缺少权威 `productType` 时，新 SDK 会拒绝授权。详细字段与客户端行为见 [SDK 授权](sdk/docs/LICENSE.md)。

取消 SDK 设备型号限制不新增数据库迁移；若上述 0023 尚未执行，仍需先完成产品隔离迁移。先更新后台使 SDK 统一覆盖全部型号，再发布同步的 Node/Web/Python SDK。串口驱动仅提供外部下载链接，安装在实际连接 USB 设备的采集电脑上，见[驱动安装](sdk/docs/DRIVERS.md)。

```bash
git clone --recurse-submodules https://github.com/liudada118/shroomSDKWEB.git
cd shroomSDKWEB
npm ci
npm run build     # = 镜像固定 SDK 的包与网页资源 + 预渲染文档 + vinext build
npm run start     # 默认 3000，用 PORT=3001 npm run start 改端口
```

已有检出目录在 `git pull` 后执行 `git submodule update --init --recursive`，再运行构建。不要加 `--remote`，否则会脱离官网锁定的 SDK 提交。缺少子模块或提交错位时，构建会停止并提示修复方式。官网正常构建只需安装官网依赖，无需安装 SDK 的原生串口/SQLite 模块或 Python 测试环境。

`npm run build` 会顺带做两件容易被忘的事：

- `pack:sdk` 调用 SDK 自己的构建/打包工具，将三份 ZIP 与 SDK 网页资源镜像到 `public/`，并生成备用下载的 npm TGZ；原 ZIP URL 保持兼容。SDK 打包规则不在官网复制维护
- `build:docs` 把 `sdk/*.md` 预渲染成 HTML 塞进产物 —— **文档站是构建期生成的**，
  运行时不读磁盘，所以服务器上没有 `sdk/` 目录也不影响 `/docs`

生产上不要手敲这两条，用 PM2 守住进程、只监听 `127.0.0.1`、外面套 Nginx，见下一节。

页面主安装命令为 `npm install shroom-sdk`。正式部署前，先在 SDK 仓库完成 npm 发布，确认注册表 `latest` 与官网引用的 SDK 版本一致，并在独立客户目录验证注册表安装；网站构建不会代为发布 npm 包。

备用 npm TGZ 位于 `public/sdk-packages/<版本>/<SHA256>/shroom-sdk-<版本>.tgz`，当前入口记录在 `app/sdk-package.generated.json`。它们随官网仓库和构建产物部署，不能按“仅保留最新版”清理历史 TGZ，否则使用旧 HTTP 安装地址的客户锁文件无法重装。这里存放精简 SDK，不使用被部署脚本限制的上位机 `public/downloads/` 目录。上线前运行 `npm run verify`；该检查验证页面服务端输出的包名安装命令，并从临时生产服务通过 HTTP 实际安装备用 TGZ。页面上的安装和下载不申请密钥，密钥通过独立表单提交申请；提交成功也不代表已签发授权。

## 1.1 PM2 托管

通过 Git 更新官网源码到服务器上后，**只需要一条命令**：

```bash
./deploy.sh
```

它依次做：环境检查 → 初始化官网锁定的 SDK 子模块 → `npm ci` → `npm run build` → `pm2 startOrRestart` → 健康检查。源码部署需保留官网 Git 元数据及子模块配置；单独 rsync 一份不含 Git 信息的源码目录无法通过 SDK 来源检查。若只部署已构建的 `dist/`，运行服务不需要 SDK 源码。
任何一步失败都会退出且**不会去动正在跑的进程**，构建失败时还会把上一版 `dist/` 放回去
（`vinext build` 开头会清空 `dist/`，失败了线上连静态资源都读不到）。

常用变体：

```bash
./deploy.sh --skip-install      # 依赖没动过，省掉 npm ci
./deploy.sh --skip-build        # 只重启进程
PORT=3002 ./deploy.sh           # 换端口（记得同步改 Nginx 的 proxy_pass）
./deploy.sh --help
```

第一次部署额外跑一次开机自启：

```bash
pm2 startup      # 按它打印的那行 sudo 命令执行一次
pm2 save         # deploy.sh 每次也会自动存
```

### 1.1.1 为什么 `ecosystem.config.cjs` 是这么写的

配置在根目录的 [ecosystem.config.cjs](ecosystem.config.cjs)，进程名 `shroom-sdk`。几个不明显的决定：

| 决定 | 原因 |
| :--- | :--- |
| 文件名是 `.cjs` 不是 `.js` | `package.json` 里 `"type": "module"`，而 PM2 用 `require()` 读配置，叫 `.js` 会当成 ESM 加载然后报错 |
| 直接跑 `node_modules/vinext/dist/cli.js`，不套 `npm start` | 中间多一层 npm + sh，PM2 的信号、重启和内存统计就都打在 npm 上，真正的 Node 进程可能变成孤儿 |
| 显式 `--hostname 127.0.0.1` | `vinext start` 不传这个参数时默认绑 **`0.0.0.0`**，3001 会直接暴露在公网上，绕过 Nginx 的 TLS 和 `/downloads/` 规则 |
| `exec_mode: 'fork'` + 单实例 | vinext 的生产服务器把预渲染 / ISR 缓存放在**进程内存**里，多实例各存各的，`revalidate` 只在命中的那个进程生效，页面会在版本之间来回跳 |
| `cwd: __dirname` | `vinext start` 用 `process.cwd()` 定位 `dist/` 和 `.env`，写死绝对路径换个部署目录就废了 |
| `interpreter: process.execPath` | 服务器上用 nvm 时，systemd 里的 PATH 往往指向系统自带的旧 Node，而本项目要求 `>= 22.13.0` |
| `VINEXT_TRUST_PROXY=1` | Nginx 传了 `X-Real-IP` / `X-Forwarded-Proto`，但 vinext 默认**不信任**任何代理头，不开的话服务端看到的协议永远是 http、客户端 IP 永远是 `127.0.0.1` |

日志走 PM2 默认位置（`~/.pm2/logs/shroom-sdk-{out,error}.log`），没写死 `/var/log/pm2` ——
那个目录不存在或没权限时 PM2 会直接起不来。要轮转就装 `pm2 install pm2-logrotate`。

```bash
pm2 logs shroom-sdk          # 跟日志
pm2 list                     # 看状态
pm2 restart shroom-sdk       # 只重启，不重新构建
```

### 1.1.2 四个会踩的坑

1. **不能 `npm ci --omit=dev`。** `vinext` 在 `devDependencies` 里，省掉之后 `build` 和 `start`
   一起没有。`deploy.sh` 里写死了 `--include=dev`，防的是 shell 里已经 export 了
   `NODE_ENV=production` 的情况。
2. **重启有 1~2 秒 502。** vinext 的生产服务器没有 `SIGTERM` 处理，收到信号立即退出，在途请求直接断。
   调大 PM2 的 `kill_timeout` 没用（那是留给有 handler 的进程的）。真要零停机得起两个实例
   + Nginx `upstream`，目前这个站的体量不值得。
3. **`NEXT_PUBLIC_*` 写进 PM2 的 `env` 里无效**，它们是构建期注入的（见第 3 节），改完要重新构建。
4. **构建前 `public/downloads/` 必须是空的。** Vite 会把 `public/` 整个拷进 `dist/client/`，
   100MB 的上位机包会被打进产物并由 Node 进程发出去，正好撞上 2.1 的铁律 3。
   `deploy.sh` 检测到非空会直接拦下来。

---

## 2. 当前三平台上位机下载（2026-10-13）

首页的事实源为 `app/downloads.ts`，三个平台分别配置 URL、版本、格式、架构与体积，点击下载后沿用本站登记流程。

| 平台 | 版本 / 格式 | 架构 / 适用环境 | 下载地址 |
| :--- | :--- | :--- | :--- |
| Windows | 1.1.36 / EXE | Windows；文件名未标明 CPU 架构 | [Windows 安装包](https://shroom.jq-industries.com/shroom1/Shroom%20Setup%201.1.36.exe) |
| macOS | 1.1.37 / DMG | Apple Silicon ARM64，不适用于 Intel Mac | [macOS 安装包](https://shroom.jq-industries.com/shroom1/Shroom-1.1.37-arm64.dmg) |
| Linux | 1.1.38 / DEB | 支持 DEB 的 amd64 / x86_64 系统，不适用于 ARM64 | [Linux 安装包](https://shroom.jq-industries.com/shroom1/Shroom-1.1.38-amd64.deb) |

HTTP 与 HTTPS 在 2026-10-13 的 HEAD 检查中均返回 200，Content-Length、ETag 与 Last-Modified 相同，本站使用 HTTPS。已核实的体积分别为 Windows 384,672,158 字节、macOS 437,163,541 字节、Linux 256,686,224 字节。页面以十进制 MB 四舍五入展示约 385 / 437 / 257 MB；这些只是该次检查的元数据，不是校验哈希或发布日期。

本站不构建、不安装、也不验证这些安装包的运行功能、签名或授权。不要复用旧 Monitor 的“免安装、不需要授权”说明。跨域下载由下载站响应头决定，本站无需通过 Node 转发大文件。

### 2.1 更新一个平台的安装包

1. 在 Shroom 上位机的独立发布流程中生成并测试对应平台包，上传到下载站，保留旧文件供在途下载。
2. 用 `curl -I "<HTTPS 地址>"` 确认可访问，并核对文件名、版本、架构和 Content-Length；HEAD 成功不等于软件功能验证通过。
3. 更新 `app/downloads.ts` 中对应平台的 `url`、`version`、`size`，必要时更新格式、兼容环境与安装提示。各平台版本不必相同。
4. 运行 `npm run test:knowledge`、`npx tsc --noEmit` 和 `npm run build`；打开首页分别切换三平台，检查卡片与登记弹窗目标一致。
5. 按第 1 节部署本站；安装包不进入 Git，不拷贝到本站 `public/`。

### 2.2 历史 Monitor 免安装 ZIP 流程（当前首页不使用）

> 以下保留旧流程作维护参考。`app/desktop-release.json` 与 `scripts/sync-desktop-release.mjs` 不再驱动首页，也不会更新当前的三平台链接。旧文件的版本、SHA-256、日期、功能或授权状态不适用于上面的 Shroom 安装包。

发出去的是 **Shroom Monitor**（串口监视器），工程在
`C:/project/ShroomConstruction/shroom-monitor`，和这个站是两个独立仓库。
产物是**免安装 zip**，`ShroomMonitor-0.1.0-win-x64.zip`，**107,868,215 字节（103 MB）**。

> 历史上本站曾从公司桌面端 1.1.34 切换到 Monitor ZIP；如今首页使用第 2 节列出的公司 Shroom 三平台安装包。下面的 Monitor 能力、体积及安装方式只描述旧包。

#### 历史包存储原则

1. **不进 git。** `public/downloads/` 已在 `.gitignore` 里。一个平台一版就是 100MB，
   进了仓库以后删都删不掉（git 历史不会因为删文件变小）。
2. **不靠手填元数据。** 版本号 / 体积 / SHA-256 全部由 `scripts/sync-desktop-release.mjs`
   从包本身算出来写进 `app/desktop-release.json`。手填迟早和服务器上挂的文件对不上，
   用户一比对校验值会以为包被人换了 —— 那比不写校验值更糟。
3. **不让 Node 进程发 100MB。** 生产上用 Nginx 直接从磁盘发（见下方历史 ZIP 的 Nginx 配置），
   `vinext start` 只发页面。

#### 历史 Monitor 打包（独立仓库 `C:/project/ShroomConstruction/shroom-monitor`）

```bash
cd /c/project/ShroomConstruction/shroom-monitor
npm run build
# = 先把站点的 sdk/examples/web/shroom.bundle.js 同步进 renderer/vendor/，再 electron-builder --win --x64
# 产出：dist/ShroomMonitor-<版本>-win-x64.zip
```

没有 Python、没有 node-gyp、不需要 Visual Studio：serialport 走的是 N-API prebuild，
`package.json` 里 `npmRebuild: false` 就是为了拦住 electron-builder 去重编原生模块。
打包机第一次跑要下 Electron 运行时，工程里的 `.npmrc` 已经指到 npmmirror 镜像。

#### 历史 Monitor 元数据同步

```bash
cd /c/project/ShroomConstruction/shroomSDKWEB
node scripts/sync-desktop-release.mjs "C:/project/ShroomConstruction/shroom-monitor/dist/ShroomMonitor-0.1.0-win-x64.zip"
```

它做三件事：算 SHA-256（100MB 要等几秒）、把包拷进 `public/downloads/`、
把版本信息写进 `app/desktop-release.json`。发布用的文件名是
`ShroomMonitor-<版本>-win-x64<原扩展名>`，扩展名跟着输入文件走。
更新日志从 `C:/project/ShroomConstruction/shroom-monitor/release-notes/<版本>.md` 里读，
没有就不显示那一块。

发布日期取包的 **mtime** 而不是当前时间 —— 重跑一次脚本不该让发布日期跳到今天。

#### 历史 ZIP 的 Nginx 文件服务

包**单独传到服务器磁盘**（scp / rsync），不跟着代码走：

```bash
rsync -avP "public/downloads/ShroomMonitor-0.1.0-win-x64.zip" \
  server:/srv/shroom/downloads/
```

Nginx 里 alias 过去，同时把站点反代到 Node：

```nginx
server {
    listen 443 ssl http2;
    server_name sdk.jq-industries.com;

    ssl_certificate     /etc/nginx/certs/jq-industries.com.pem;
    ssl_certificate_key /etc/nginx/certs/jq-industries.com.key;

    # 100MB 的压缩包：Nginx 直接从磁盘发，别经过 Node
    location /downloads/ {
        alias /srv/shroom/downloads/;
        autoindex off;
        add_header Content-Disposition "attachment";
        # 大文件走 sendfile，别缓冲到内存里
        sendfile on;
        tcp_nopush on;
        # 断点续传由 Nginx 静态文件处理自带（会自己回 Accept-Ranges: bytes），
        # 不用手动加；但**别在这个 location 上开 gzip**，一开就没有 Range 了
        gzip off;
        # 装完一版就不动了，可以放心长缓存（文件名带版本号）
        expires 30d;
        access_log /var/log/nginx/shroom-downloads.log;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

该 `/downloads/` 配置仅用于保留的历史 ZIP 链接；当前三平台安装包使用独立下载站，不依赖这个 location。

---

## 3. 环境变量

站点跑起来不要求任何环境变量，下面变量用来改登记接口（`NEXT_PUBLIC_` 前缀，**构建期注入**，
改完要重新 `npm run build`）：

| 变量 | 默认值 | 什么时候要改 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SDK_REGISTRY_URL` | `https://shroom.jq-industries.com/sdk-requests` | 本地联调时指到本机密钥系统 |

`NEXT_PUBLIC_DESKTOP_DOWNLOAD_BASE` 已不再被首页使用；当前下载地址在 `app/downloads.ts` 中更新。

登记接口挂了**不会挡住下载** —— 那本来就不是审批流程，密钥系统出问题也不能让人拿不到 SDK。

AI 知识问答另需几个服务端私密变量（运行时读取，改完重启即可，不用重新构建），见文末「智谱知识问答配置」。

---

## 4. 历史 Monitor 发版流程（不用于当前三平台下载）

当前 Shroom 安装包请使用 2.1 的流程。以下步骤只维护旧 Monitor ZIP 及其元数据，不会改变首页下载卡片。

1. 在 `shroom-monitor` 里改好 `package.json` 的版本号
2. 写 `shroom-monitor/release-notes/<版本>.md`（每行 `- xxx`，页面上「本次更新」直接读它）
3. 按第 2 节的历史 Monitor 打包说明操作
4. **拿真设备验一遍**：把 zip 解压到一个干净目录，双击 `ShroomMonitor.exe`，
   连上串口确认字节和帧都在涨。asar / 原生模块的问题只在打包后的包里暴露，
   开发模式跑得好不代表包是好的
5. `node scripts/sync-desktop-release.mjs "<新包路径>"`
6. `git diff app/desktop-release.json` 确认版本 / 体积 / SHA-256 / 日期都变了
7. rsync 新包上服务器（**旧版本先别删**，可能有人正下到一半）
8. 在服务器上 `./deploy.sh`（构建 + 重启 + 健康检查，见 1.1）
9. 打开页面点一次下载，**核一遍校验值**：
   ```powershell
   certutil -hashfile "ShroomMonitor-0.1.0-win-x64.zip" SHA256
   ```
10. 确认无误后再清理服务器上两个版本之前的旧包

---

## 5. 当前下载常见问题

| 现象 | 原因 | 怎么答 |
| :--- | :--- | :--- |
| Intel Mac 无法使用 DMG | 当前包是 ARM64 | 需要单独的 Intel 版本，不能把此包标为兼容 Intel |
| Linux ARM64 或不支持 DEB 的系统无法安装 | 当前包是 amd64 DEB | 需要对应架构/格式的安装包，本次未提供 |
| Windows 安装包怎么用 | 当前是 EXE，不是旧 Monitor ZIP | 运行安装程序，按安装向导操作 |
| 安全软件或系统拦截安装 | 当前包的签名/安全状态未验证 | 向上位机发布方核实，不承诺一定是误报，不引导用户关闭防护 |
| 下载中断或失败 | 下载站或网络问题 | 检查对应 HTTPS 地址及下载站响应；本站 Node 不代理安装包 |
| 网页测试台连不上设备 | 浏览器限制，不是站点问题 | 必须 https 或 localhost，且必须 Chrome / Edge。见 sdk/README.md |

## 智谱知识问答配置（2026-10-09，2026-11-05 更新）

问答页为 `/knowledge`，同站服务端接口为 `POST /api/knowledge`。密钥只放在各自机器上、不进 Git，**别人拉代码部署时要在自己的服务器上再配一遍**，否则问答页只会显示「知识库问答正在配置中」（503），网站其他部分不受影响。

从 `.env.example` 复制变量名：本地写在 `.env.local`；服务器写在项目根目录（`package.json` 所在目录）的 `.env.production.local`，并 `chmod 600`。两个文件都被 `.gitignore` 的 `.env*` 忽略。

```dotenv
ZAI_API_KEY=你的智谱_API_Key
ZHIPU_KNOWLEDGE_ID=你的知识库_ID
ZHIPU_MODEL=glm-4.5-air
ZHIPU_FALLBACK_MODEL=glm-4-flash-250414
```

- 模型（2026-11-05 实测，每问约 1.1 万输入 token）：`glm-4.5-air` 首字约 2 秒，按量扣费约 1 分钱/问；glm-4.7 系列（含付费的 flashx）这么长的提示词首字要 20 秒左右，不适合。不想付费就把 `ZHIPU_MODEL` 换成免费的 `glm-4-flash-250414`。备用模型在主模型过载、限流或 8 秒内没开始响应时接手一次。
- `vinext start` 启动时按 `.env.production.local` > `.env.local` > `.env.production` > `.env` 读取，真实进程环境变量优先于这些文件。改完 `pm2 restart shroom-sdk` 即可，不用重新构建（构建产物不含这些值）。
- 不要写进 `ecosystem.config.cjs`（它在 Git 里），也别在跑 `deploy.sh` / `pm2` 的 shell 里 `export`：PM2 第一次创建进程时会把当时 shell 的环境存下来（`pm2 save` 还会写进 dump），之后每次重启都盖过文件里的值，要 `pm2 delete shroom-sdk` 后重新部署才清得掉。
- `deploy.sh` 的健康检查只请求首页，AI 没配好也会显示成功。部署后另测一次：`curl -sN -X POST http://127.0.0.1:3001/api/knowledge -H 'Content-Type: application/json' -d '{"question":"怎么计算压力重心？","history":[]}'`，应陆续输出 `event: delta`，而不是 503 的 JSON。
- 付费模型和知识库存储都从同一个智谱账户余额扣费。余额归零后付费模型报 1113，知识库也会被暂停服务，欠费超过 7 天还可能删掉超出 1 GB 的数据，记得在控制台设余额提醒。

不要添加 `NEXT_PUBLIC_` 前缀，不要把真实密钥提交到 Git、浏览器代码或 SDK 包。

知识库需上传并处理当前 `sdk/README.md`、`sdk/docs/AI-CONTEXT.md`、`sdk/python/README.md` 等资料。本地构建不会自动上传到智谱；旧分支的 Backend 文档与当前基础 SDK 能力不同，应更新知识库版本。

接口为流式 SSE，响应头带 `X-Accel-Buffering: no`，按上面的 Nginx 配置不用另加设置就能逐字推送；前面如果还有 CDN 或别的代理，要对 `/api/knowledge` 关闭缓冲和压缩。公网部署前配置网关限流、智谱用量预算和必要的访问控制，避免公开接口被滥用。本次恢复没有部署上线，也没有调用真实智谱凭据。

SDK 构建现生成 `public/shroom-sdk-python.zip`、`public/shroom-sdk-node.zip` 与兼容旧链接的 `public/shroom-sdk.zip`，发布时应包含三个文件。
