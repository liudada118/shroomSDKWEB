# 部署与发布

这份文档只讲一件事：**怎么把这个站连同 350MB 的上位机安装包放到服务器上**。
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

建议用 PM2 之类的守住进程，监听 `127.0.0.1`，外面套 Nginx。

---

## 2. 上位机安装包（重点）

安装包 **351,369,484 字节（335 MB）**，走哪条路发很关键。

### 2.1 三条铁律

1. **不进 git。** `public/downloads/` 已在 `.gitignore` 里。一个平台一版就是 350MB，
   进了仓库以后删都删不掉（git 历史不会因为删文件变小）。
2. **不靠手填元数据。** 版本号 / 体积 / SHA-256 全部由 `scripts/sync-desktop-release.mjs`
   从安装包本身算出来写进 `app/desktop-release.json`。手填迟早和服务器上挂的文件对不上，
   用户一比对校验值会以为包被人换了 —— 那比不写校验值更糟。
3. **不让 Node 进程发 350MB。** 生产上用 Nginx 直接从磁盘发（见 2.4），
   `vinext start` 只发页面。

### 2.2 打包（在上位机仓库 `C:/project/shroom1.0`）

```bash
cd /c/project/shroom1.0
# 这台机器上 Python 环境要显式指过去，否则 build-python-runtime.js 找不到 numpy
PYTHON_FOR_BUILD="C:/project/shroom1.0/python/venv311/Scripts/python.exe" \
PYTHONIOENCODING=utf-8 PYTHONUTF8=1 \
npm run build
# 产出：dist/Shroom Setup <版本>.exe
```

> ⚠️ `npm run build` 的第一步 `clean-pack-output` 会 **`fs.rmSync` 掉 `out/` 和 `dist/`**。
> 上一版的安装包如果还要留着，**先拷走再打**。
>
> `PYTHONIOENCODING=utf-8` 是必须的：不加会在 `python/build_exe.py` 打印 `€` 时
> 抛 `UnicodeEncodeError: 'gbk' codec ...` 直接中断，而这时 `dist/` 已经被清空了。

### 2.3 同步进站点

```bash
cd /c/project/ShroomConstruction/shroomSDKWEB
node scripts/sync-desktop-release.mjs "C:/project/shroom1.0/dist/Shroom Setup 1.1.34.exe"
```

它做三件事：算 SHA-256（350MB 要等十几秒）、把包拷进 `public/downloads/` 并
改名成没有空格的 `Shroom-Setup-<版本>-win-x64.exe`、把版本信息写进 `app/desktop-release.json`。
更新日志从 `C:/project/shroom1.0/release-notes/windows/<版本>.md` 里读，没有就不显示那一块。

发布日期取安装包的 **mtime** 而不是当前时间 —— 重跑一次脚本不该让发布日期跳到今天。

### 2.4 服务器上怎么放

安装包**单独传到服务器磁盘**（scp / rsync），不跟着代码走：

```bash
rsync -avP "public/downloads/Shroom-Setup-1.1.34-win-x64.exe" \
  server:/srv/shroom/downloads/
```

Nginx 里 alias 过去，同时把站点反代到 Node：

```nginx
server {
    listen 443 ssl http2;
    server_name sdk.jq-industries.com;

    ssl_certificate     /etc/nginx/certs/jq-industries.com.pem;
    ssl_certificate_key /etc/nginx/certs/jq-industries.com.key;

    # 350MB 的安装包：Nginx 直接从磁盘发，别经过 Node
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
| `NEXT_PUBLIC_DESKTOP_DOWNLOAD_BASE` | `/downloads` | 安装包放 CDN 或独立域名时，填到目录为止（不带结尾斜杠） |
| `NEXT_PUBLIC_SDK_REGISTRY_URL` | `https://shroom.jq-industries.com/sdk-requests` | 本地联调时指到本机密钥系统 |

登记接口挂了**不会挡住下载** —— 那本来就不是审批流程，密钥系统出问题也不能让人拿不到 SDK。

---

## 4. 发一个新版上位机的完整流程

1. 在 `shroom1.0` 里改好版本号，`git tag`
2. 写 `release-notes/windows/<版本>.md`（每行 `- xxx`，页面上「本次更新」直接读它）
3. 备份上一版 `dist/*.exe`，然后按 2.2 打包
4. `node scripts/sync-desktop-release.mjs "<新包路径>"`
5. `git diff app/desktop-release.json` 确认版本 / 体积 / SHA-256 / 日期都变了
6. rsync 新包上服务器（**旧版本先别删**，可能有人正下到一半）
7. `npm run build && pm2 restart shroom-sdk`
8. 打开页面点一次下载，**核一遍校验值**：
   ```powershell
   certutil -hashfile "Shroom-Setup-1.1.34-win-x64.exe" SHA256
   ```
9. 确认无误后再清理服务器上两个版本之前的旧包

---

## 5. 已知问题（会有人来问）

| 现象 | 原因 | 怎么答 |
| :--- | :--- | :--- |
| 装的时候弹「Windows 已保护你的电脑」 | 安装包**没做代码签名** | 点「更多信息 → 仍要运行」。页面下载按钮旁边已经写了这句 |
| 装完打开提示没有授权 | 上位机需要授权才能采集 | 走密钥系统发授权，和 SDK 下载是两回事 |
| macOS / Linux 上位机在哪 | 还没打 | 页面上是灰的「即将发布」，不要给人发 Windows 包让他去 Wine |
| 下载到一半断了 | 350MB + 网络 | `curl -I` 看响应里有没有 `Accept-Ranges: bytes`。没有多半是这个 location 上开了 gzip 或套了别的代理，关掉即可续传 |
| 网页测试台连不上设备 | 浏览器限制，不是站点问题 | 必须 https 或 localhost，且必须 Chrome / Edge。见 sdk/README.md |
