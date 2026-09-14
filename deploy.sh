#!/usr/bin/env bash
#
# 一键构建 + 部署 + 启动。在 Linux 服务器上跑。
#
# 源码怎么上来（git pull / rsync）不归它管，它负责「源码已经是最新的」之后的那几步：
# 装依赖 → 构建 → 起 / 重启 PM2 → 健康检查。详见 DEPLOY.md 1.1。
#
# 退出码非 0 就是没部署成功，出错时不会去动已经在跑的进程。

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

APP_NAME='shroom-sdk'
# 和 ecosystem.config.cjs 保持同一套默认值
PORT="${PORT:-3001}"
HOST="${HOST:-127.0.0.1}"

SKIP_INSTALL=0
SKIP_BUILD=0
SKIP_HEALTH=0

if [ -t 1 ]; then
  C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_OFF=$'\033[0m'
else
  C_OK=''; C_WARN=''; C_ERR=''; C_OFF=''
fi

step() { printf '\n%s==>%s %s\n' "$C_OK" "$C_OFF" "$1"; }
warn() { printf '%s[warn]%s %s\n' "$C_WARN" "$C_OFF" "$1" >&2; }
die()  { printf '%s[error]%s %s\n' "$C_ERR" "$C_OFF" "$1" >&2; exit 1; }

usage() {
  cat <<'EOF'
用法：./deploy.sh [选项]

  （无选项）        完整流程：npm ci → npm run build → 重启 PM2 → 健康检查
  --skip-install    依赖没动过时跳过 npm ci，快很多
  --skip-build      只重启进程，不重新构建
  --skip-health     不做健康检查
  -h, --help        看这段

环境变量：
  PORT                             监听端口，默认 3001（要和 Nginx 的 proxy_pass 对上）
  HOST                             监听地址，默认 127.0.0.1
  SHROOM_ALLOW_PUBLIC_DOWNLOADS=1  允许 public/downloads/ 非空时继续构建（见下面的说明）
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-install) SKIP_INSTALL=1 ;;
    --skip-build)   SKIP_BUILD=1 ;;
    --skip-health)  SKIP_HEALTH=1 ;;
    -h|--help)      usage; exit 0 ;;
    *)              usage >&2; die "未知参数：$1" ;;
  esac
  shift
done

# ---------------------------------------------------------------- 环境检查

step '检查环境'

# 后面有 rm -rf，先确认这里真的是本项目的根目录再往下走
[ -f "$ROOT/package.json" ] || die "$ROOT 下没有 package.json，deploy.sh 必须待在项目根目录"
grep -q '"vinext"' "$ROOT/package.json" \
  || die "package.json 里找不到 vinext，$ROOT 不像是 shroomSDKWEB 的根目录"
[ -f "$ROOT/ecosystem.config.cjs" ] || die '缺少 ecosystem.config.cjs'

command -v node >/dev/null 2>&1 || die '找不到 node'
command -v npm  >/dev/null 2>&1 || die '找不到 npm'
command -v pm2  >/dev/null 2>&1 || die '找不到 pm2，先装一个：npm i -g pm2'

NODE_VERSION="$(node -p 'process.versions.node')"
node -e '
  const need = [22, 13, 0];
  const got = process.versions.node.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (got[i] > need[i]) process.exit(0);
    if (got[i] < need[i]) process.exit(1);
  }
' || die "Node 版本是 $NODE_VERSION，package.json 的 engines 要求 >= 22.13.0"

# pm2 --version 在守护进程还没起来时会先打几行 spawn 日志，只取最后一行的版本号
printf '    node %s · pm2 %s\n' "$NODE_VERSION" "$(pm2 --version 2>/dev/null | tail -n 1)"

HEALTH_CURL=1
if ! command -v curl >/dev/null 2>&1; then
  HEALTH_CURL=0
  [ "$SKIP_HEALTH" -eq 1 ] || warn '没有 curl，健康检查会被跳过'
fi

# Vite 会把 public/ 整个拷进 dist/client/。上位机压缩包一个 100MB 出头，打进产物就变成
# Node 进程在发大文件 —— 和 DEPLOY.md 2.1 铁律 3 冲突（线上该由 Nginx 从磁盘直接发）。
DOWNLOADS="$ROOT/public/downloads"
if [ -d "$DOWNLOADS" ] && [ -n "$(ls -A "$DOWNLOADS" 2>/dev/null)" ]; then
  if [ "${SHROOM_ALLOW_PUBLIC_DOWNLOADS:-0}" != '1' ]; then
    warn 'public/downloads/ 不是空的：'
    ls -lh "$DOWNLOADS" >&2
    die 'Vite 会把 public/ 整个拷进 dist/client/，这些包会被打进产物并由 Node 进程发出去。
        线上应该让 Nginx alias 到 /srv/shroom/downloads/（DEPLOY.md 2.4）。
        清空这个目录后重跑；确实要打进产物就 SHROOM_ALLOW_PUBLIC_DOWNLOADS=1 ./deploy.sh'
  fi
  warn 'public/downloads/ 非空，但已设 SHROOM_ALLOW_PUBLIC_DOWNLOADS=1，继续（产物会变大）'
fi

# ---------------------------------------------------------------- 依赖

if [ "$SKIP_INSTALL" -eq 1 ]; then
  step '跳过依赖安装（--skip-install）'
  [ -d "$ROOT/node_modules/vinext" ] \
    || die 'node_modules/vinext 不存在，第一次部署不能用 --skip-install'
else
  step '安装依赖（npm ci）'
  # --include=dev 不能省：vinext 在 devDependencies 里，装漏了连 build 和 start 都没有。
  # 显式写出来是为了防住 shell 里已经 export 了 NODE_ENV=production 的情况。
  npm ci --include=dev
fi

# ---------------------------------------------------------------- 构建

DIST="$ROOT/dist"
DIST_PREV="$ROOT/dist.prev"

if [ "$SKIP_BUILD" -eq 1 ]; then
  step '跳过构建（--skip-build）'
  [ -d "$DIST/client" ] || die 'dist/ 里没有产物，第一次部署不能用 --skip-build'
else
  step '构建（pack:sdk → build:docs → vinext build）'
  # vinext build 开头会清空 dist/。构建中途失败的话，正在跑的进程连静态资源都读不到了，
  # 所以先留一份，失败就原样放回去，让线上继续跑旧版本。
  BACKED_UP=0
  if [ -d "$DIST" ]; then
    rm -rf "$DIST_PREV"
    cp -a "$DIST" "$DIST_PREV"
    BACKED_UP=1
  fi

  if npm run build; then
    if [ "$BACKED_UP" -eq 1 ]; then rm -rf "$DIST_PREV"; fi
  else
    if [ "$BACKED_UP" -eq 1 ]; then
      warn '构建失败，把上一次的 dist/ 放回去，线上继续跑旧版本'
      rm -rf "$DIST"
      mv "$DIST_PREV" "$DIST"
    fi
    die '构建失败，PM2 进程没动过'
  fi
fi

# ---------------------------------------------------------------- 起进程

step "启动 / 重启 PM2 进程 $APP_NAME"
# startOrRestart：没起过就 start，起过就 restart。--update-env 让它重新读配置里的 env。
# 注意 vinext 的生产服务器没有 SIGTERM 处理，重启期间会有 1~2 秒 502，属正常现象。
PORT="$PORT" HOST="$HOST" pm2 startOrRestart "$ROOT/ecosystem.config.cjs" --update-env
# 存一份进程列表，这样 pm2 resurrect / 开机自启能恢复出同样的配置
pm2 save >/dev/null

# ---------------------------------------------------------------- 健康检查

if [ "$SKIP_HEALTH" -eq 1 ] || [ "$HEALTH_CURL" -eq 0 ]; then
  step '跳过健康检查'
else
  step "健康检查 http://$HOST:$PORT/"
  code=''
  ok=0
  for _ in $(seq 1 30); do
    code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 5 "http://$HOST:$PORT/" 2>/dev/null || true)"
    if [ "$code" = '200' ]; then ok=1; break; fi
    sleep 1
  done
  if [ "$ok" -ne 1 ]; then
    warn "30 秒内没等到 200（最后一次：${code:-无响应}），最近 40 行日志："
    pm2 logs "$APP_NAME" --lines 40 --nostream || true
    die "服务没起来。改完之后可以用 ./deploy.sh --skip-install --skip-build 只重试启动"
  fi
  printf '    200 OK\n'
fi

# ---------------------------------------------------------------- 收尾

step '完成'
pm2 describe "$APP_NAME" >/dev/null 2>&1 && pm2 list || true

cat <<EOF

  本机       http://$HOST:$PORT/  （外网由 Nginx 反代，见 DEPLOY.md 2.4）
  看日志     pm2 logs $APP_NAME
  开机自启   pm2 startup   # 只有第一次部署要跑，按它打印的那行 sudo 命令执行一次
EOF
