/**
 * PM2 进程配置 —— 只用于生产，开发还是走 `npm run dev`。
 *
 *   pm2 startOrRestart ecosystem.config.cjs --update-env
 *
 * 平时不用手敲，`./deploy.sh` 会调它。为什么是这些选项见 DEPLOY.md 1.1。
 *
 * 文件名必须是 .cjs：package.json 里 "type": "module"，而 PM2 用 require() 读配置，
 * 叫 .js 会被当成 ESM 加载然后报错。
 */

// 默认 3001，和 DEPLOY.md 2.4 里 Nginx 的 proxy_pass 对齐。
// 临时换端口：PORT=3002 pm2 startOrRestart ecosystem.config.cjs --update-env
const PORT = process.env.PORT || '3001';

// 只监听回环。vinext start 不传 --hostname 时默认绑 0.0.0.0 ——
// 那样 3001 会直接暴露在公网上，绕过 Nginx 的 TLS 和 /downloads/ 规则，所以必须显式传。
const HOST = process.env.HOST || '127.0.0.1';

module.exports = {
  apps: [
    {
      name: 'shroom-sdk',

      // vinext start 用 process.cwd() 定位 dist/ 和 .env，必须是项目根目录。
      // 用 __dirname 而不是写死绝对路径，服务器上放在哪个目录都能跑。
      cwd: __dirname,

      // 直接跑 vinext 的 CLI，不套 `npm start`：中间多一层 npm + sh，PM2 的信号、
      // 重启和内存统计就都打在 npm 上，真正的 Node 进程可能被留下变成孤儿。
      script: 'node_modules/vinext/dist/cli.js',
      args: ['start', '--hostname', HOST, '--port', PORT],

      // 跟着启动 pm2 的那个 Node 走。服务器上用 nvm 时，systemd 里的 PATH 往往指向
      // 系统自带的旧 Node，而这个项目要求 >= 22.13.0（见 package.json 的 engines）。
      interpreter: process.execPath,

      // 必须 fork + 单实例：vinext 的生产服务器把预渲染 / ISR 缓存放在进程内存里，
      // 多实例各存各的，revalidate 只在命中的那个进程生效，页面会在版本之间来回跳。
      exec_mode: 'fork',
      instances: 1,

      autorestart: true,
      max_restarts: 10,
      // 起来不到 30 秒就挂的视为启动失败，不再无限重启刷日志
      min_uptime: '30s',
      restart_delay: 2000,
      max_memory_restart: '512M',

      // 监听文件变化重启是开发行为，生产上会被构建产物写入触发误重启
      watch: false,

      env: {
        NODE_ENV: 'production',
        // Nginx 传了 X-Real-IP / X-Forwarded-Proto，但 vinext 默认不信任任何代理头。
        // 不开这个的话，服务端看到的协议永远是 http、客户端 IP 永远是 127.0.0.1。
        VINEXT_TRUST_PROXY: '1',
      },

      // 日志走 PM2 默认位置（~/.pm2/logs/shroom-sdk-{out,error}.log）。
      // 不写死 /var/log/pm2 —— 那个目录不存在或没权限时 PM2 会直接起不来。
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
