/** 正式构建的非浏览器检查：启动生产服务，验证SSR入口与交付ZIP后清理自有进程。 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:net';

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
      const run = html.indexOf('id="workspace-run"');
      const code = html.indexOf('id="workspace-code"');
      const guide = html.indexOf('id="guide-prepare"');
      assert.ok(configuration > 0 && configuration < run && run < code && code < guide, '配置、运行和完整示例先于详细教程');
      const beforeGuide = html.slice(0, guide);
      const guideDetails = beforeGuide.slice(beforeGuide.lastIndexOf('<details'));
      assert.match(guideDetails.slice(0, guideDetails.indexOf('>') + 1), /\sopen(?:\s|=|>)/, '完整接入说明默认展开');
      const mainDownload = html.indexOf('下载完整示例');
      assert.ok(mainDownload > configuration && mainDownload < run, '完整示例为工作台主要操作');
      assert.doesNotMatch(html.slice(configuration, mainDownload), /type="checkbox"/, '主操作之前无需手动勾选教程清单');
      const preview = html.slice(code, html.indexOf('id="guide-prepare"'));
      assert.match(preview, /完整示例/);
      assert.match(preview, /&lt;!doctype html&gt;/i, '默认直接展示完整 HTML 源码');
      assert.match(preview, /activateLicense/);
      assert.match(preview, /connectProduct/);
      assert.match(preview, /代码阅读预览/);
      const productTable = [...html.matchAll(/<table\b[\s\S]*?<\/table>/g)]
        .map(([table]) => table).find(table => table.includes('<caption>产品返回字段</caption>'));
      assert.ok(productTable, '手套产品字段表可用');
      assert.doesNotMatch(productTable, /195|pressureMatrix|values/, '手套标准字段不混入旧展示矩阵');
      assert.match(productTable, /fingers\.\*\.raw/);
      assert.match(productTable, /palm\.matrix/);
      for (const chapter of ['guide-prepare', 'guide-config', 'guide-run', 'guide-connect', 'guide-verify', 'guide-code']) {
        assert.ok(html.includes(`id="${chapter}"`), chapter);
      }
      for (const legacy of ['extensions', 'device', 'demo', 'view', 'record', 'download', 'troubleshooting']) assert.ok(html.includes(`id="${legacy}"`), legacy);
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
} finally {
  if (server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
}
