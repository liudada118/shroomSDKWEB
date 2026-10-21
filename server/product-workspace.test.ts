import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkspaceStore, initialWorkspaceState, parseWorkspaceLocation, workspaceChapters, workspaceCommands,
  workspaceFilename, workspaceReady, workspaceStateForLocation, workspaceUrl, workspaceLocationTarget,
} from '../app/docs/product-workspace-model.ts';
import { createProductExample, getProductExampleFilename } from '../sdk/examples/product-examples.js';
import { workspaceReadingPreview } from '../app/docs/product-workspace-preview.ts';

test('shared chapter links open the requested guide while old default links keep the workbench visible', () => {
  assert.equal(workspaceLocationTarget('', '#product=glove&env=web&platform=windows&tab=start&section=guide-prepare&codeKind=complete'), null);
  assert.equal(workspaceLocationTarget('', '#product=glove&side=right&env=node&tab=start&section=guide-code'), 'guide-code');
  assert.equal(workspaceLocationTarget('', '#product=pad&tab=data&section=guide-code'), 'product-data');
  for (const id of ['guide-prepare', 'guide-run', 'extensions', 'workspace-config', 'workspace-code']) {
    assert.equal(workspaceLocationTarget('', `#${id}`), id);
  }
  assert.equal(workspaceLocationTarget('', '#%E0%A4%A'), null);
});

test('shared configuration preselects side without confirming real hardware', () => {
  const state = parseWorkspaceLocation('?product=glove&side=right&env=node&platform=macos', '#guide-code');
  assert.equal(state.side, 'right');
  assert.equal(state.section, 'guide-code');
  assert.equal(workspaceReady(state), false);
  assert.match(workspaceCommands(state), /确认左手或右手/);
  assert.equal(workspaceReady({ ...state, sideConfirmed: true }), true);
});

test('native chapter, reference and legacy links do not lose same-device confirmation', () => {
  const confirmed = { ...initialWorkspaceState, side: 'left' as const, sideConfirmed: true };
  const query = '?product=glove&side=left&env=web&platform=windows&tab=data';
  for (const hash of ['#guide-connect', '#record', '#extensions']) {
    const state = workspaceStateForLocation(confirmed, query, hash);
    assert.equal(state.sideConfirmed, true);
    assert.equal(state.tab, 'start', 'chapter/legacy navigation reveals the tutorial');
  }
  assert.equal(workspaceStateForLocation(confirmed, query, '#product-debug').tab, 'debug');
  assert.equal(workspaceStateForLocation(confirmed, '?product=glove&side=right', '#guide-code').sideConfirmed, false);
  assert.equal(workspaceStateForLocation(confirmed, '?product=pad', '#guide-code').sideConfirmed, false);
});

test('invalid and prototype URL values resolve to supported configurations', () => {
  const invalid = parseWorkspaceLocation('?product=lefthand&side=auto&env=python&platform=unknown&tab=bad&codeKind=wrong');
  assert.deepEqual(invalid, initialWorkspaceState);
  const old = parseWorkspaceLocation('', '#product=pad&env=node&platform=linux&tab=data&section=guide-verify');
  assert.equal(old.product, 'pad');
  assert.equal(old.env, 'node');
  assert.equal(old.tab, 'data');
  assert.equal(workspaceReady(old), true);
});

test('every product, side, runtime and platform shares the generator filename and matching commands', () => {
  for (const product of ['glove', 'pad'] as const) for (const side of ['left', 'right'] as const)
    for (const env of ['web', 'node'] as const) for (const platform of ['windows', 'macos', 'linux'] as const) {
      const state = { ...initialWorkspaceState, product, side, sideConfirmed: true, env, platform };
      const options = { product, ...(product === 'glove' ? { side } : {}), env, platform };
      const filename = getProductExampleFilename(options);
      assert.equal(workspaceFilename(state), filename);
      const source = createProductExample(options);
      assert.match(source, /中文|授权|驱动/);
      if (env === 'web') {
        assert.equal(workspaceCommands(state), 'node start.mjs --no-open');
        assert.match(source, /import \{ Shroom \} from '\.\/web\/index\.js'/);
      } else {
        assert.ok(workspaceCommands(state).includes(`node ${filename} `));
        assert.match(workspaceCommands(state), /npm install/);
        if (platform === 'windows') assert.match(workspaceCommands(state), /\$env:SHROOM_LICENSE_KEY/);
        else assert.doesNotMatch(workspaceCommands(state), /\$env:/);
      }
      if (product === 'pad') assert.doesNotMatch(source, /"side":"(?:left|right)"/);
    }
});

test('URL updates retain unrelated parameters, never serialize confirmation and use ordinary hashes', () => {
  const current = new URL('https://sdk.example/docs/quick-start?source=help#guide-prepare');
  const state = { ...initialWorkspaceState, side: 'left' as const, sideConfirmed: true };
  const next = new URL(workspaceUrl(state, current, 'guide-code'), current);
  assert.equal(next.searchParams.get('source'), 'help');
  assert.equal(next.searchParams.get('side'), 'left');
  assert.equal(next.searchParams.has('sideConfirmed'), false);
  assert.equal(next.hash, '#guide-code');
  assert.equal(new URL(workspaceUrl({ ...state, tab: 'downloads' }, next), current).hash, '#product-downloads');
  assert.equal(workspaceChapters.length, 6);
});

test('workspace stores have stable server snapshots, isolated subscribers and cleanup', () => {
  const first = createWorkspaceStore(), second = createWorkspaceStore();
  let notifications = 0;
  const unsubscribe = first.subscribe(() => { notifications += 1; });
  first.replace({ ...initialWorkspaceState, product: 'pad' });
  assert.equal(notifications, 1);
  assert.equal(first.getSnapshot().product, 'pad');
  assert.equal(first.getServerSnapshot(), initialWorkspaceState);
  assert.equal(second.getSnapshot(), initialWorkspaceState);
  unsubscribe();
  first.replace(initialWorkspaceState);
  assert.equal(notifications, 1);
});

test('default view exposes the complete runnable lifecycle before hardware confirmation', () => {
  assert.equal(initialWorkspaceState.codeKind, 'complete');
  assert.equal(parseWorkspaceLocation('').codeKind, 'complete');
  assert.equal(parseWorkspaceLocation('?codeKind=snippet').codeKind, 'snippet', 'an explicit short-source choice remains available');
  const before = structuredClone(initialWorkspaceState);
  const preview = workspaceReadingPreview(initialWorkspaceState);
  assert.match(preview, /尚未确认实物手侧/);
  assert.match(preview, /activateLicense/);
  assert.match(preview, /connectProduct\(/);
  assert.match(preview, /onError/);
  assert.match(preview, /\.close\(/);
  assert.match(preview, /^<!-- .*尚未确认实物手侧.*-->\n<!doctype html>/i);
  assert.deepEqual(initialWorkspaceState, before, 'reading an example never confirms a side');
  assert.equal(workspaceReady(initialWorkspaceState), false);
});

test('confirmed preview and copyable source agree while complete downloads retain full lifecycle', () => {
  for (const side of ['left', 'right'] as const) for (const env of ['web', 'node'] as const) {
    const state = { ...initialWorkspaceState, side, sideConfirmed: true, env };
    const options = { product: 'glove' as const, side, env, platform: state.platform };
    assert.equal(workspaceReadingPreview(state), createProductExample({ ...options, kind: 'complete' }));
    assert.equal(workspaceReadingPreview({ ...state, codeKind: 'snippet' }), createProductExample({ ...options, kind: 'snippet' }));
    const unconfirmed = { ...state, sideConfirmed: false };
    assert.match(workspaceReadingPreview(unconfirmed), /尚未确认实物手侧/);
    assert.ok(workspaceReadingPreview(unconfirmed).endsWith(createProductExample({ ...options, kind: 'complete' })));
    assert.equal(workspaceReady(unconfirmed), false);
  }
});
