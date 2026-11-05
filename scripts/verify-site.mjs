/** 官网集成门禁：SDK 本身的语言测试和 Release 在独立仓库执行。 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { WEBSITE_ROOT, inspectSdkSource, runSdkScript, syncSdkAssets } from './sdk-source.mjs';

try {
  await inspectSdkSource();
  await syncSdkAssets();
  const run = (script, args = []) => runSdkScript(WEBSITE_ROOT, script, args);
  await run('scripts/pack-integration-skill.mjs');
  await run('scripts/build-docs.mjs');
  const tests = (await readdir(join(WEBSITE_ROOT, 'server'))).filter(name => name.endsWith('.test.ts')).sort().map(name => `server/${name}`);
  await run('--experimental-strip-types', ['--test', ...tests]);
  await run('--test', ['scripts/tests/sdk-source.test.mjs']);
  await run('node_modules/typescript/bin/tsc', ['--noEmit', '--incremental', 'false']);
  await run('node_modules/vinext/dist/cli.js', ['build']);
  await run('scripts/check-product-workspace.mjs');
  console.log('官网集成检查通过：固定 SDK 来源、文档、类型、生产页面和下载。');
} catch (error) { console.error(error.message); process.exitCode = 1; }
