/** 验证生产页面的 npm 包名命令与备用 HTTP 安装包，最后清理自有服务进程。 */
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:net';
import { verifyNpmArchive } from '../sdk/scripts/npm-archive.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const runFile = promisify(execFile);
const npmPackage = JSON.parse(await readFile(join(root, 'app/sdk-package.generated.json'), 'utf8'));

async function npmCli() {
  const binary = dirname(process.execPath);
  for (const candidate of [process.env.npm_execpath,
    join(binary, 'node_modules/npm/bin/npm-cli.js'),
    resolve(binary, '../lib/node_modules/npm/bin/npm-cli.js')].filter(Boolean)) {
    try { await access(candidate); return candidate; } catch { /* 继续检查当前 Node 的 npm 安装位置。 */ }
  }
  throw new Error('找不到 npm CLI；请使用 npm run verify 执行官网安装检查。');
}

/** 真实 HTTP 安装验证下载地址可被 npm 消费；硬件与原生依赖由独立 SDK 门禁验证。 */
async function checkHttpInstall(url) {
  const base = await realpath(tmpdir());
  const directory = await mkdtemp(join(base, 'shroom-site-npm-install-'));
  try {
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name: 'shroom-site-consumer', private: true, type: 'module' }));
    const env = { ...process.env, npm_config_cache: join(directory, '.npm-cache'),
      npm_config_fetch_retries: '1', npm_config_fetch_timeout: '30000', npm_config_update_notifier: 'false' };
    const execute = async args => {
      try { return await runFile(process.execPath, args, { cwd: directory, env, timeout: 120000, maxBuffer: 2 * 1024 * 1024, windowsHide: true }); }
      catch (error) { throw new Error('官网 HTTP npm 安装检查失败：' + [error.stdout, error.stderr, error.message].filter(Boolean).join('\n'), { cause: error }); }
    };
    await execute([await npmCli(), 'install', '--save-exact', '--omit=optional', '--no-audit', '--no-fund', '--loglevel=error', url]);
    const lock = JSON.parse(await readFile(join(directory, 'package-lock.json'), 'utf8'));
    const installed = lock.packages['node_modules/shroom-sdk'];
    assert.equal(installed.version, npmPackage.version);
    assert.equal(installed.resolved, url, '客户锁文件必须保留官网稳定 URL');
    assert.ok(installed.integrity, '客户锁文件必须记录包完整性');
    await writeFile(join(directory, 'smoke.mjs'), `import assert from 'node:assert/strict';
import * as flow from 'shroom-sdk/quick-flow';
import { Shroom } from 'shroom-sdk/node';
assert.deepEqual(Object.keys(flow).sort(), ['createWS', 'downloadRecording', 'readProduct', 'startRecording', 'stopRecording']);
assert.equal(Shroom.version, ${JSON.stringify(npmPackage.version)});
console.log('官网 HTTP 安装及五函数包导入通过');\n`);
    const result = await execute(['smoke.mjs']);
    console.log(result.stdout.trim());
  } finally {
    const target = resolve(directory);
    assert.equal(dirname(target), base);
    assert.ok(basename(target).startsWith('shroom-site-npm-install-'));
    await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
const origin = `http://localhost:${port}`;
let output = '';
const server = spawn(process.execPath, ['node_modules/vinext/dist/cli.js', 'start', '--port', String(port)], {
  cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
server.stdout.on('data', chunk => { output += chunk; });
server.stderr.on('data', chunk => { output += chunk; });
try {
  let online = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`生产服务启动失败：${output}`);
    try {
      const response = await fetch(`${origin}/docs/quick-start`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { online = true; break; }
    } catch { /* 服务构建模块尚在加载，稍后重试。 */ }
    await delay(100);
  }
  assert.ok(online, `生产服务未就绪：${output}`);
  for (const path of ['/docs/quick-start', '/docs', '/docs/backend?language=python', '/']) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.ok(!html.includes('Product workspace requires ProductWorkspaceProvider'), path);
    if (path === '/' || path === '/docs/quick-start') {
      assert.match(html, /复制安装命令/);
      assert.match(html, /申请(?:\s*SDK\s*)?密钥/);
      assert.match(html, /aria-label="SDK 安装命令"[^>]*value="npm install shroom-sdk"/, '安装入口直接展示 npm 包名命令');
    }
    if (path === '/docs/quick-start') {
      assert.match(html, /<h1[^>]*>触觉手套<\/h1>/);
      const productSelect = html.match(/<select\b[^>]*\bid="workspace-navigation-product"[^>]*>/)?.[0];
      assert.ok(productSelect, '产品切换保留原生下拉和键盘交互');
      assert.match(html, /<label[^>]*for="workspace-navigation-product"[^>]*>切换产品<\/label>/);
      const selectClass = productSelect.match(/class="([^"]+)"/)?.[1].split(' ')[0];
      assert.ok(selectClass, '下拉控件引用组件样式');
      const styleUrls = [...new Set([...html.matchAll(/<link\b[^>]*>/g)]
        .filter(([tag]) => /\brel="stylesheet"/.test(tag))
        .map(([tag]) => tag.match(/\bhref="([^"]+)"/)?.[1]).filter(Boolean))];
      const styleSheets = await Promise.all(styleUrls.map(async href => {
        const response = await fetch(new URL(href, origin));
        assert.equal(response.status, 200, `样式 ${href}`);
        return response.text();
      }));
      assert.ok(styleSheets.some(css => css.includes(`.${selectClass}`)), '生产页面实际加载产品选择器样式');
      const configuration = html.indexOf('id="workspace-config"');
      const flowPanel = html.indexOf('<section id="product-start"');
      const preparationPanel = html.indexOf('<section id="product-guide"');
      assert.ok(configuration > 0 && flowPanel > configuration && preparationPanel > flowPanel);
      const flow = html.slice(flowPanel, preparationPanel);
      const steps = ['flow-read', 'flow-ws', 'flow-start', 'flow-stop', 'flow-download'];
      let previous = -1;
      for (const id of steps) {
        const position = flow.indexOf(`id="${id}"`);
        assert.ok(position > previous, `${id} follows the preceding step`);
        previous = position;
      }
      assert.equal((flow.match(/复制代码/g) ?? []).length, 6, 'five steps use six focused code blocks');
      for (const call of ['readProduct({', 'createWS(device,', 'startRecording(stream,', 'stopRecording(stream)', 'downloadRecording(stream,']) {
        assert.ok(flow.includes(call), `actual SDK API: ${call}`);
      }
      assert.doesNotMatch(flow, /let recording|downloadRecording\(recording\.id,/, 'SDK 管理本次下载 ID，无需跨按钮维护变量');
      assert.match(flow, /onData/);
      assert.match(flow, /shroom-sdk\/quick-flow/);
      assert.doesNotMatch(flow, /\.\/quick-flow\.js/);
      assert.match(flow, /data\.fingers/);
      assert.match(flow, /Node\.js/);
      assert.match(flow, /浏览器 JavaScript/);
      assert.match(flow, /SDK 授权/);
      assert.match(flow, /按钮/);
      assert.doesNotMatch(html, /&lt;!doctype|下载完整示例|复制完整示例|示例内容|glove-left-example/);
      const panelTag = html.slice(preparationPanel, html.indexOf('>', preparationPanel) + 1);
      assert.match(panelTag, /\shidden(?:\s|=|>)/, 'preparation is a separate task');
      assert.match(html.slice(preparationPanel), /Shroom\.activateLicense/);
      assert.doesNotMatch(html.slice(preparationPanel), /\.\/node\/license-env\.js/);
      assert.match(html.slice(preparationPanel), /npm install/);
      const productTable = [...html.matchAll(/<table\b[\s\S]*?<\/table>/g)]
        .map(([table]) => table).find(table => table.includes('<caption>产品返回字段</caption>'));
      assert.ok(productTable, '手套产品字段表可用');
      assert.doesNotMatch(productTable, /195|pressureMatrix|values/, '手套标准字段不混入旧展示矩阵');
      assert.match(productTable, /fingers\.\*\.raw/);
      assert.match(productTable, /palm\.matrix/);
      for (const chapter of ['guide-prepare', 'guide-config', 'guide-run', 'guide-connect', 'guide-verify', 'guide-code']) {
        assert.ok(html.includes(`id="${chapter}"`), chapter);
      }
      assert.ok(html.includes('CH341SER.EXE') && html.includes('CH34xVCPDriver.zip'));
      assert.ok(html.includes('disabled=""'), '未确认手侧的首屏生成操作被禁用');
      assert.doesNotMatch(html, /outputs\/layout-discussion|product-workspace-examples\.js/);
    }
    console.log(`SSR 200: ${path}`);
  }
  for (const file of ['shroom-sdk-node.zip', 'shroom-sdk-python.zip', 'shroom-sdk.zip']) {
    const response = await fetch(`${origin}/${file}`);
    assert.equal(response.status, 200, file);
    const archive = Buffer.from(await response.arrayBuffer());
    assert.ok(archive.length > 10000 && archive.readUInt32LE(0) === 0x04034b50, file);
    console.log(`下载 200: ${file}`);
  }
  const installUrl = new URL(npmPackage.url, origin).href;
  const response = await fetch(installUrl);
  assert.equal(response.status, 200, npmPackage.url);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(createHash('sha256').update(bytes).digest('hex'), npmPackage.sha256);
  verifyNpmArchive(bytes, npmPackage.version);
  console.log(`npm 下载 200：${npmPackage.fileName}`);
  await checkHttpInstall(installUrl);
} finally {
  if (server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
}
