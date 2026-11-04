import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkspaceStore, initialWorkspaceState, parseWorkspaceLocation, workspaceChapters,
  workspaceReady, workspaceStateForLocation, workspaceUrl, workspaceLocationTarget,
} from '../app/docs/product-workspace-model.ts';
import { workspaceFlow } from '../app/docs/product-workspace-preview.ts';

test('old prototype default opens the call flow and preparation deep links remain available', () => {
  assert.equal(workspaceLocationTarget('', '#product=glove&env=web&platform=windows&tab=start&section=guide-prepare&codeKind=complete'), null);
  assert.equal(workspaceLocationTarget('', '#product=glove&side=right&env=node&tab=start&section=guide-code'), 'guide-code');
  for (const id of ['guide-prepare', 'guide-run', 'flow-read', 'flow-download', 'workspace-config']) {
    assert.equal(workspaceLocationTarget('', `#${id}`), id);
  }
  assert.equal(workspaceLocationTarget('', '#%E0%A4%A'), null);
});

test('shared configuration preselects side without confirming real hardware', () => {
  const state = parseWorkspaceLocation('?product=glove&side=right&env=node&platform=macos', '#guide-code');
  assert.equal(state.side, 'right');
  assert.equal(state.section, 'guide-code');
  assert.equal(workspaceReady(state), false);
  assert.equal(workspaceReady({ ...state, sideConfirmed: true }), true);
  assert.match(workspaceFlow(state)[0].blocks[0].code, /按实物确认/);
});

test('legacy API links point to the corresponding flow step rather than a removed full example', () => {
  const aliases = { device: 'flow-read', demo: 'flow-ws', view: 'flow-ws', record: 'flow-start',
    'record-start': 'flow-start', 'record-stop': 'flow-stop', download: 'flow-download',
    extensions: 'product-start', 'workspace-example-code': 'flow-read', 'quick-call': 'flow-read' };
  for (const [old, target] of Object.entries(aliases)) {
    assert.equal(workspaceLocationTarget('', `#${old}`), target);
    assert.equal(parseWorkspaceLocation('?tab=guide', `#${old}`).tab, 'start');
  }
  assert.equal(parseWorkspaceLocation('', '#troubleshooting').tab, 'debug');
  assert.equal(workspaceLocationTarget('', '#workspace-run'), 'guide-run');
  assert.equal(parseWorkspaceLocation('', '#workspace-run').tab, 'guide');
});

test('navigation preserves confirmation for the same device and requires confirmation after changing product or side', () => {
  const confirmed = { ...initialWorkspaceState, side: 'left' as const, sideConfirmed: true };
  for (const [hash, tab] of [['#guide-connect', 'guide'], ['#record', 'start'], ['#product-debug', 'debug']] as const) {
    const state = workspaceStateForLocation(confirmed, '?product=glove&side=left', hash);
    assert.equal(state.sideConfirmed, true); assert.equal(state.tab, tab);
  }
  assert.equal(workspaceStateForLocation(confirmed, '?product=glove&side=right', '#flow-read').sideConfirmed, false);
  assert.equal(workspaceStateForLocation(confirmed, '?product=pad', '#flow-read').sideConfirmed, false);
});

test('invalid and prototype URL values resolve to supported configurations', () => {
  assert.deepEqual(parseWorkspaceLocation('?product=lefthand&side=auto&env=python&platform=unknown&tab=bad&codeKind=wrong'), initialWorkspaceState);
  const old = parseWorkspaceLocation('', '#product=pad&env=node&platform=linux&tab=data&section=guide-verify');
  assert.equal(old.product, 'pad'); assert.equal(old.env, 'node'); assert.equal(old.tab, 'data');
  assert.equal(workspaceReady(old), true);
});

test('every selected product exposes one connected five-step Node and browser flow', () => {
  for (const product of ['glove', 'pad', 'body', 'insole'] as const) for (const side of ['left', 'right'] as const)
    for (const platform of ['windows', 'macos', 'linux'] as const) {
      const steps = workspaceFlow({ ...initialWorkspaceState, product, side, sideConfirmed: true, platform });
      assert.deepEqual(steps.map(step => step.id), ['flow-read', 'flow-ws', 'flow-start', 'flow-stop', 'flow-download']);
      const read = steps[0].blocks[0].code;
      assert.match(read, /const device = await readProduct\(/);
      assert.match(read, /from 'shroom-sdk\/quick-flow'/);
      assert.ok(read.includes(`product: '${product}'`));
      assert.match(read, platform === 'windows' ? /COM3/ : platform === 'macos' ? /dev\/cu\.usbserial/ : /dev\/ttyUSB0/);
      assert.deepEqual(steps[1].blocks.map(block => block.runtime), ['node', 'web']);
      assert.match(steps[1].blocks[0].code, /createWS\(device/);
      assert.match(steps[1].blocks[1].code, /const stream = await readProduct/);
      assert.match(steps[2].blocks[0].code, /startRecording\(stream,/);
      assert.match(steps[3].blocks[0].code, /const recording = await stopRecording\(stream\)/);
      assert.match(steps[4].blocks[0].code, /downloadRecording\(stream,/);
      assert.doesNotMatch(steps[4].blocks[0].code, /recording(?:\.id)?/, '下载无需访问停止按钮中的局部记录变量');
      assert.doesNotMatch(steps[1].blocks[1].code, /let recording/, '连接步骤无需维护跨按钮记录变量');
      assert.doesNotMatch(steps.flatMap(step => step.blocks.map(block => block.code)).join('\n'), /<!doctype|connectProduct|downloadUrl/);
    }
});

test('insole links preserve protocol while requiring foot confirmation before copying', () => {
  const state = parseWorkspaceLocation('?product=insole&side=right&protocol=8bit');
  assert.equal(state.product, 'insole'); assert.equal(state.protocol, '8bit');
  assert.equal(workspaceReady(state), false);
  assert.match(workspaceFlow(state)[0].blocks[0].code, /请先按实物确认左脚或右脚/);
  const confirmed = { ...state, sideConfirmed: true };
  assert.equal(workspaceReady(confirmed), true);
  const changed = workspaceStateForLocation(confirmed, '?product=insole&side=right&protocol=12bit', '#flow-read');
  assert.equal(changed.sideConfirmed, true, '协议变化不表示换了实物脚侧');
  assert.equal(changed.protocol, '12bit');
  assert.equal(workspaceStateForLocation(confirmed, '?product=insole&side=left&protocol=8bit', '#flow-read').sideConfirmed, false);
  const read = workspaceFlow(confirmed)[0].blocks[0].code;
  assert.match(read, /side: 'right'/); assert.match(read, /protocol: '8bit'/);
  assert.match(read, /data\.sensors, data\.pressure, data\.imu/);
  assert.doesNotMatch(read, /data\.fingers|data\.palm|左手|右手/);
  const current = new URL('https://sdk.example/docs/quick-start?source=help');
  const url = new URL(workspaceUrl(confirmed, current), current);
  assert.equal(url.searchParams.get('protocol'), '8bit'); assert.equal(url.searchParams.get('side'), 'right');
  assert.equal(url.searchParams.get('source'), 'help');
  assert.equal(parseWorkspaceLocation('?product=insole&protocol=auto').protocol, '12bit');
});

test('body calls have regions without inheriting side or insole protocol from shared links', () => {
  const state = parseWorkspaceLocation('?product=body&side=left&protocol=8bit');
  assert.equal(workspaceReady(state), true);
  assert.equal(state.protocol, '12bit');
  const read = workspaceFlow(state)[0].blocks[0].code;
  assert.match(read, /data\.regions, data\.raw/);
  assert.doesNotMatch(read, /side:|protocol:|data\.fingers|data\.palm|createProductView/);
  const current = new URL('https://sdk.example/docs/quick-start?side=left&protocol=8bit');
  const url = new URL(workspaceUrl(state, current), current);
  assert.equal(url.searchParams.has('side'), false); assert.equal(url.searchParams.has('protocol'), false);
});

test('URL updates retain unrelated parameters and never serialize confirmation', () => {
  const current = new URL('https://sdk.example/docs/quick-start?source=help#guide-prepare');
  const state = { ...initialWorkspaceState, side: 'left' as const, sideConfirmed: true };
  const next = new URL(workspaceUrl(state, current, 'flow-stop'), current);
  assert.equal(next.searchParams.get('source'), 'help'); assert.equal(next.searchParams.get('side'), 'left');
  assert.equal(next.searchParams.has('sideConfirmed'), false); assert.equal(next.hash, '#flow-stop');
  assert.equal(new URL(workspaceUrl({ ...state, tab: 'downloads' }, next), current).hash, '#product-downloads');
  assert.equal(workspaceChapters.length, 6);
});

test('workspace stores isolate subscribers and have stable SSR snapshots', () => {
  const first = createWorkspaceStore(), second = createWorkspaceStore();
  let notifications = 0;
  const unsubscribe = first.subscribe(() => { notifications += 1; });
  first.replace({ ...initialWorkspaceState, product: 'pad' });
  assert.equal(notifications, 1); assert.equal(first.getSnapshot().product, 'pad');
  assert.equal(first.getServerSnapshot(), initialWorkspaceState); assert.equal(second.getSnapshot(), initialWorkspaceState);
  unsubscribe(); first.replace(initialWorkspaceState); assert.equal(notifications, 1);
});
