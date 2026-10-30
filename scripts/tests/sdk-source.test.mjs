import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { inspectSdkSource, SDK_REPOSITORY } from '../sdk-source.mjs';

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
