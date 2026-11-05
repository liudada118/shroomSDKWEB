/** 官网只消费独立 SDK 的固定 Git 提交；SDK 的构建与发布规则由 SDK 仓库维护。 */
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, copyFile, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

export const WEBSITE_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SDK_REPOSITORY = 'https://github.com/liudada118/shroomSDK.git';
const exec = promisify(execFile);
const samePath = (a, b) => process.platform === 'win32'
  ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b);

export async function inspectSdkSource(root = WEBSITE_ROOT) {
  const sdkRoot = join(root, 'sdk');
  let pkg;
  try {
    pkg = JSON.parse(await readFile(join(sdkRoot, 'package.json'), 'utf8'));
    await access(join(sdkRoot, 'scripts', 'sdk-check.mjs'));
  } catch {
    throw new Error('独立 SDK 尚未初始化。请在官网目录执行 git submodule update --init --recursive。');
  }
  if (pkg.name !== 'shroom-sdk') throw new Error('sdk/ 不是当前五步 SDK，请同步官网锁定的子模块提交。');
  const git = async args => (await exec('git', ['-C', root, ...args], { windowsHide: true })).stdout.trim();
  const sdkTop = (await exec('git', ['-C', sdkRoot, 'rev-parse', '--show-toplevel'], { windowsHide: true })).stdout.trim();
  if (!samePath(sdkTop, sdkRoot)) throw new Error('sdk/ 必须是独立 Git 子模块，不能继续使用官网内的源码副本。');
  const url = await git(['config', '-f', '.gitmodules', '--get', 'submodule.sdk.url']);
  if (url !== SDK_REPOSITORY) throw new Error('SDK 子模块地址与独立源码仓库不一致。');
  const recorded = /^160000 ([a-f0-9]{40,64}) 0\tsdk$/m.exec(await git(['ls-files', '--stage', '--', 'sdk']))?.[1];
  const commit = (await exec('git', ['-C', sdkRoot, 'rev-parse', 'HEAD'], { windowsHide: true })).stdout.trim();
  if (!recorded || recorded !== commit) throw new Error('SDK 提交与官网记录不同。升级后请检查差异并执行 git add sdk，锁定该版本。');
  const status = (await exec('git', ['-C', sdkRoot, 'status', '--porcelain=v1', '--untracked-files=normal'], { windowsHide: true })).stdout.trim();
  if (status) throw new Error('SDK 含未提交修改，不能作为固定提交的官网来源。请先在 SDK 仓库提交并验证，再更新官网引用。');
  return { root: sdkRoot, version: pkg.version, commit };
}

export function runSdkScript(sdkRoot, script, args = []) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: sdkRoot, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? done() : reject(new Error(`SDK ${script} 失败（${signal ?? code}），官网构建停止。`)));
  });
}

/** 按包内容保存稳定下载地址；旧包随官网源码保留，客户锁文件不会跟着当前版本失效。 */
export async function persistNpmAsset({ root = WEBSITE_ROOT, version, sourceCommit, bytes }) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
    || !/^[a-f0-9]{40,64}$/.test(sourceCommit) || !Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw new Error('npm 资产缺少合法版本、源码提交或文件内容。');
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const fileName = `shroom-sdk-${version}.tgz`;
  const url = `/sdk-packages/${version}/${sha256}/${fileName}`;
  const segments = ['public', 'sdk-packages', version, sha256];
  let directory = resolve(root);
  for (const segment of segments) {
    directory = join(directory, segment);
    await mkdir(directory, { recursive: true });
    const entry = await lstat(directory);
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('npm 资产目录不能是符号链接。');
  }
  const target = join(directory, fileName);
  try { await writeFile(target, bytes, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const entry = await lstat(target);
    if (!entry.isFile() || entry.isSymbolicLink() || !(await readFile(target)).equals(bytes)) {
      throw new Error('已发布 npm 地址存在不同内容，拒绝覆盖：' + url);
    }
  }
  const metadata = { version, url, fileName, sha256, sourceCommit };
  await mkdir(join(root, 'app'), { recursive: true });
  await writeFile(join(root, 'app', 'sdk-package.generated.json'), JSON.stringify(metadata, null, 2) + '\n');
  return metadata;
}

export async function syncSdkAssets({ root = WEBSITE_ROOT, bundleOnly = false } = {}) {
  const sdk = await inspectSdkSource(root);
  await runSdkScript(sdk.root, 'scripts/sdk-check.mjs');
  await runSdkScript(sdk.root, 'scripts/build-sdk-bundle.mjs');
  if (!bundleOnly) {
    await runSdkScript(sdk.root, 'examples/generate-product-examples.mjs');
    await runSdkScript(sdk.root, 'scripts/pack-sdk.mjs');
    await runSdkScript(sdk.root, 'scripts/sdk-release-artifacts.mjs', ['verify-latest']);
    await runSdkScript(sdk.root, 'scripts/pack-npm.mjs');
  }
  const after = await inspectSdkSource(root);
  if (after.commit !== sdk.commit) throw new Error('构建期间 SDK 提交发生变化，请重新构建官网。');
  const assets = [['examples/web/index.html', 'lab.html'], ['examples/web/shroom.bundle.js', 'shroom.bundle.js'], ['examples/web/quick-start.html', 'quick-start.html']];
  if (!bundleOnly) for (const file of ['shroom-sdk.zip', 'shroom-sdk-node.zip', 'shroom-sdk-python.zip']) assets.push([`dist/${file}`, file]);
  await mkdir(join(root, 'public'), { recursive: true });
  for (const [source, destination] of assets) await copyFile(join(sdk.root, source), join(root, 'public', destination));
  if (!bundleOnly) {
    const bytes = await readFile(join(sdk.root, 'dist', `shroom-sdk-${sdk.version}.tgz`));
    const { verifyNpmArchive } = await import(pathToFileURL(join(sdk.root, 'scripts/npm-archive.mjs')).href);
    verifyNpmArchive(bytes, sdk.version);
    const npm = await persistNpmAsset({ root, version: sdk.version, sourceCommit: sdk.commit, bytes });
    console.log(`官网 npm 安装地址：${npm.url}`);
  }
  console.log(`官网已同步 SDK ${sdk.version}（${sdk.commit.slice(0, 12)}）的 ${assets.length} 个资源。`);
}
