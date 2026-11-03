import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { inspectSdkSource, persistNpmAsset, SDK_REPOSITORY } from '../sdk-source.mjs';

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function fixture(t, independent = true) {
  const base = resolve(tmpdir());
  const root = await mkdtemp(join(base, 'shroom-site-sdk-source-'));
  t.after(async () => {
    assert.ok(resolve(root).startsWith(base + sep));
    await rm(root, { recursive: true, force: true });
  });
  git(root, 'init', '-q');
  const sdk = join(root, 'sdk');
  await mkdir(join(sdk, 'scripts'), { recursive: true });
  await writeFile(join(sdk, 'package.json'), JSON.stringify({ name: 'shroom-sdk', version: '0.1.0' }));
  await writeFile(join(sdk, 'scripts/sdk-check.mjs'), '');
  if (independent) {
    git(sdk, 'init', '-q');
    git(sdk, 'config', 'user.email', 'fixture@example.invalid');
    git(sdk, 'config', 'user.name', 'SDK fixture');
    git(sdk, 'add', '.');
    git(sdk, 'commit', '-qm', 'SDK fixture');
    const commit = git(sdk, 'rev-parse', 'HEAD');
    git(root, 'update-index', '--add', '--cacheinfo', `160000,${commit},sdk`);
  }
  await writeFile(join(root, '.gitmodules'), `[submodule "sdk"]\n\tpath = sdk\n\turl = ${SDK_REPOSITORY}\n`);
  return { root, sdk };
}

test('website accepts the independent SDK commit pinned in its index', async t => {
  const { root, sdk } = await fixture(t);
  assert.deepEqual(await inspectSdkSource(root), { root: sdk, version: '0.1.0', commit: git(sdk, 'rev-parse', 'HEAD') });
});

test('missing checkout gives an actionable initialization command', async t => {
  const { root } = await fixture(t);
  await assert.rejects(inspectSdkSource(join(root, 'uninitialized')), /git submodule update --init --recursive/);
});

test('a copied SDK directory cannot masquerade as a separate repository', async t => {
  const { root } = await fixture(t, false);
  await assert.rejects(inspectSdkSource(root), /必须是独立 Git 子模块/);
});

test('a changed SDK checkout must be explicitly pinned before the website builds', async t => {
  const { root, sdk } = await fixture(t);
  await writeFile(join(sdk, 'next.txt'), 'next');
  git(sdk, 'add', 'next.txt');
  git(sdk, 'commit', '-qm', 'next SDK');
  await assert.rejects(inspectSdkSource(root), /git add sdk/);
  git(root, 'update-index', '--cacheinfo', `160000,${git(sdk, 'rev-parse', 'HEAD')},sdk`);
  assert.equal((await inspectSdkSource(root)).commit, git(sdk, 'rev-parse', 'HEAD'));
});

test('uncommitted tracked or new SDK files cannot be published as a pinned commit', async t => {
  const { root, sdk } = await fixture(t);
  const script = join(sdk, 'scripts/sdk-check.mjs');
  await writeFile(script, '// changed');
  await assert.rejects(inspectSdkSource(root), /SDK 含未提交修改/);
  await writeFile(script, '');
  await inspectSdkSource(root);
  await writeFile(join(sdk, 'extra.js'), '// not committed');
  await assert.rejects(inspectSdkSource(root), /SDK 含未提交修改/);
});

test('npm asset addresses are content-specific and historical files survive a new package', async t => {
  const { root, sdk } = await fixture(t);
  const sourceCommit = git(sdk, 'rev-parse', 'HEAD');
  const first = await persistNpmAsset({ root, version: '0.1.0', sourceCommit, bytes: Buffer.from('first package') });
  assert.match(first.url, /^\/sdk-packages\/0\.1\.0\/[a-f0-9]{64}\/shroom-sdk-0\.1\.0\.tgz$/);
  assert.equal((await readFile(join(root, 'public', first.url))).toString(), 'first package');
  assert.deepEqual(await persistNpmAsset({ root, version: '0.1.0', sourceCommit, bytes: Buffer.from('first package') }), first);
  const second = await persistNpmAsset({ root, version: '0.1.0', sourceCommit, bytes: Buffer.from('second package') });
  assert.notEqual(second.url, first.url);
  assert.equal((await readFile(join(root, 'public', first.url))).toString(), 'first package');
  assert.deepEqual(JSON.parse(await readFile(join(root, 'app/sdk-package.generated.json'), 'utf8')), second);
});

test('a conflicting file at an existing npm address cannot be silently replaced', async t => {
  const { root, sdk } = await fixture(t);
  const config = { root, version: '0.1.0', sourceCommit: git(sdk, 'rev-parse', 'HEAD'), bytes: Buffer.from('package') };
  const asset = await persistNpmAsset(config);
  await writeFile(join(root, 'public', asset.url), 'unexpected change');
  await assert.rejects(persistNpmAsset(config), /拒绝覆盖/);
  assert.equal((await readFile(join(root, 'public', asset.url))).toString(), 'unexpected change');
});

test('invalid npm version or source identity is rejected before writing an asset', async t => {
  const { root, sdk } = await fixture(t);
  const config = { root, version: '0.1.0', sourceCommit: git(sdk, 'rev-parse', 'HEAD'), bytes: Buffer.from('package') };
  await assert.rejects(persistNpmAsset({ ...config, version: '../outside' }), /合法版本/);
  await assert.rejects(persistNpmAsset({ ...config, sourceCommit: 'unknown' }), /源码提交/);
});
