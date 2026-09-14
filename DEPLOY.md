# 部署与发布

这份文档只讲一件事：**怎么把这个站连同 100MB 上下的上位机压缩包放到服务器上**。
页面本身怎么写、SDK 怎么用不在这里，看 [ARCHITECTURE.md](ARCHITECTURE.md) 和 [sdk/README.md](sdk/README.md)。

---

## 1. 构建与启动

```bash
npm ci
npm run build     # = 打 SDK zip + 预渲染文档 + vinext build
npm run start     # 默认 3000，用 PORT=3001 npm run start 改端口
```

`npm run build` 会顺带做两件容易被忘的事：

- `pack:sdk` 把 `sdk/` 打成 `public/shroom-sdk.zip`（含单文件 bundle，且保留 `start.sh` 的可执行位）
- `build:docs` 把 `sdk/*.md` 预渲染成 HTML 塞进产物 —— **文档站是构建期生成的**，
  运行时不读磁盘，所以服务器上没有 `sdk/` 目录也不影响 `/docs`

生产上不要手敲这两条，用 PM2 守住进程、只监听 `127.0.0.1`、外面套 Nginx，见下一节。

## 1.1 PM2 托管

源码更新到服务器上（`git pull` / `rsync`）之后，**只需要一条命令**：

```bash
./deploy.sh
```

它依次做：环境检查 → `npm ci` → `npm run build` → `pm2 startOrRestart` → 健康检查。
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

## 2. 上位机压缩包（重点）

发出去的是 **Shroom Monitor**（串口监视器），工程在
`C:/project/ShroomConstruction/shroom-monitor`，和这个站是两个独立仓库。
产物是**免安装 zip**，`ShroomMonitor-0.1.0-win-x64.zip`，**107,868,215 字节（103 MB）**。

> 之前挂的是公司桌面端 `Shroom Setup 1.1.34.exe`（335 MB，带 Python 运行时和授权校验）。
> 它已经不在发布链路里了 —— 那个包带回放、报表、3D 模型，和这个站声明的 SDK 边界对不上，
> 而且 NSIS 安装器会因为检测到已运行的 `Shroom.exe` 卡在「无法关闭」。
> 新包不出安装器，从根上没有这类安装期问题。

### 2.1 三条铁律

1. **不进 git。** `public/downloads/` 已在 `.gitignore` 里。一个平台一版就是 100MB，
   进了仓库以后删都删不掉（git 历史不会因为删文件变小）。
2. **不靠手填元数据。** 版本号 / 体积 / SHA-256 全部由 `scripts/sync-desktop-release.mjs`
   从包本身算出来写进 `app/desktop-release.json`。手填迟早和服务器上挂的文件对不上，
   用户一比对校验值会以为包被人换了 —— 那比不写校验值更糟。
3. **不让 Node 进程发 100MB。** 生产上用 Nginx 直接从磁盘发（见 2.4），
   `vinext start` 只发页面。

### 2.2 打包（在上位机仓库 `C:/project/ShroomConstruction/shroom-monitor`）

```bash
cd /c/project/ShroomConstruction/shroom-monitor
npm run build
# = 先把站点的 sdk/web/shroom.bundle.js 同步进 renderer/vendor/，再 electron-builder --win --x64
# 产出：dist/ShroomMonitor-<版本>-win-x64.zip
```

没有 Python、没有 node-gyp、不需要 Visual Studio：serialport 走的是 N-API prebuild，
`package.json` 里 `npmRebuild: false` 就是为了拦住 electron-builder 去重编原生模块。
打包机第一次跑要下 Electron 运行时，工程里的 `.npmrc` 已经指到 npmmirror 镜像。

### 2.3 同步进站点

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

### 2.4 服务器上怎么放

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

放 CDN 也行，把 `NEXT_PUBLIC_DESKTOP_DOWNLOAD_BASE` 指过去即可，页面代码一个字不用改。

---

## 3. 环境变量

站点跑起来不要求任何环境变量，下面两个是用来改指向的（`NEXT_PUBLIC_` 前缀，**构建期注入**，
改完要重新 `npm run build`）：

| 变量 | 默认值 | 什么时候要改 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_DESKTOP_DOWNLOAD_BASE` | `/downloads` | 包放 CDN 或独立域名时，填到目录为止（不带结尾斜杠） |
| `NEXT_PUBLIC_SDK_REGISTRY_URL` | `https://shroom.jq-industries.com/sdk-requests` | 本地联调时指到本机密钥系统 |

登记接口挂了**不会挡住下载** —— 那本来就不是审批流程，密钥系统出问题也不能让人拿不到 SDK。

---

## 4. 发一个新版上位机的完整流程

1. 在 `shroom-monitor` 里改好 `package.json` 的版本号
2. 写 `shroom-monitor/release-notes/<版本>.md`（每行 `- xxx`，页面上「本次更新」直接读它）
3. 按 2.2 打包
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

## 5. 已知问题（会有人来问）

| 现象 | 原因 | 怎么答 |
| :--- | :--- | :--- |
| 首次运行弹「Windows 已保护你的电脑」 | **没做代码签名** | 点「更多信息 → 仍要运行」。页面下载按钮旁边已经写了这句 |
| 杀毒软件把 `ShroomMonitor.exe` 报毒或直接删掉 | 未签名的 Electron 应用常见误报，和具体代码无关 | 把解压出来的整个目录加进信任列表再运行。校验值和页面上一致就说明包没被动过 |
| 解压后双击没反应 | 只把 `ShroomMonitor.exe` 单独拷出来了 | 必须**整个目录一起解压**，exe 旁边的 `resources/`、`*.dll` 都要在 |
| 装到哪里了 / 怎么卸载 | 免安装，没有安装步骤 | 解压到哪就在哪，删目录即卸载，不写注册表 |
| macOS / Linux 上位机在哪 | 还没打 | 页面上是灰的「即将发布」，不要给人发 Windows 包让他去 Wine |
| 下载到一半断了 | 100MB + 网络 | `curl -I` 看响应里有没有 `Accept-Ranges: bytes`。没有多半是这个 location 上开了 gzip 或套了别的代理，关掉即可续传 |
| 网页测试台连不上设备 | 浏览器限制，不是站点问题 | 必须 https 或 localhost，且必须 Chrome / Edge。见 sdk/README.md |
