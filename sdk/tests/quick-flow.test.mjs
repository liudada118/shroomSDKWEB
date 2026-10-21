import test from 'node:test';
import { beforeEach } from 'node:test';
import { activateTestLicense } from './license-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Shroom as NodeShroom } from '../node/index.js';
import { Shroom as BrowserShroom } from '../web/index.js';
import { createFrameHub } from '../core/device.js';
import { decodeGlovePacket } from '../core/glove.js';
import { createServer } from 'node:http';
import WebSocket from 'ws';

beforeEach(() => activateTestLicense());

/** A manually clocked glove source makes network and recording assertions deterministic. */
function quickSource() {
  const hub = createFrameHub();
  return { info: { source: 'mock', product: 'handGloveFullPacket', side: 'left' },
    onFrame: hub.onFrame, onData: hub.onFrame, onError: hub.onError,
    emit(index) {
      const packet = Uint8Array.from({ length: 274 }, (_, i) => (i + index) & 255);
      hub.emit(decodeGlovePacket(packet, { side: 'left' }));
    },
  };
}

/** Wait for a fixed number of received frames without relying on wall-clock sleeps. */
function framesFrom(client, count) {
  return new Promise((resolve, reject) => {
    const frames = [];
    const timer = setTimeout(() => { unsubscribe(); reject(new Error('frame timeout')); }, 3000);
    const unsubscribe = client.onData((frame) => {
      frames.push(frame);
      if (frames.length === count) { clearTimeout(timer); unsubscribe(); resolve(frames); }
    });
  });
}

test('quick page groups capture start and stop together and keeps downloads separate', async () => {
  const html = await readFile(new URL('../web/quick-start.html', import.meta.url), 'utf8');
  const capture = html.match(/<section[^>]*aria-labelledby="capture-title"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  const downloads = html.match(/<section[^>]*aria-labelledby="downloads-title"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(capture);
  assert.ok(downloads);
  assert.match(capture, /id="start"/);
  assert.match(capture, /id="stop"/);
  assert.doesNotMatch(capture, /id="recordings"|id="reload"/);
  assert.match(downloads, /id="recordings"/);
  assert.doesNotMatch(downloads, /id="start"|id="stop"/);
  assert.match(html, /current\.downloadRecording\(record\.id, \{ format \}\)/);
  assert.doesNotMatch(html, /停止并下载/);
});

test('quick page highlights all seven steps with links only to available browser controls', async () => {
  const html = await readFile(new URL('../web/quick-start.html', import.meta.url), 'utf8');
  const flows = [...html.matchAll(/<section\b[^>]*class="sdk-quick-flow"[^>]*aria-label="快速接入完整链路"[^>]*>([\s\S]*?)<\/section>/g)];
  assert.equal(flows.length, 1, 'show the complete workflow once');
  const list = flows[0][1].match(/<ol\b[^>]*>([\s\S]*?)<\/ol>/)?.[1];
  assert.ok(list, 'use a semantic ordered list');
  const steps = [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1]);
  const labels = ['连接产品', 'Node.js 取数', '指定端口启动 WS', '前端连接', '实时渲染', '数据采集（开始 / 停止）', '按 ID 下载'];
  const targets = [null, null, null, 'connect-form', 'view-title', 'capture-title', 'downloads-title'];
  assert.equal(steps.length, labels.length);
  for (const [index, step] of steps.entries()) {
    const number = String(index + 1).padStart(2, '0');
    assert.ok(step.includes(`<span class="sdk-flow-number" aria-hidden="true">${number}</span>`));
    assert.equal(step.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), `${number}${labels[index]}`);
    if (targets[index]) {
      assert.ok(step.includes(`href="#${targets[index]}"`));
      assert.ok(html.includes(`id="${targets[index]}"`), 'workflow links must resolve to existing controls');
    } else {
      assert.doesNotMatch(step, /<a\b/, 'backend prerequisites are not browser controls');
    }
  }
});

test('public APIs complete glove → WS → browser → labelled persistent recording → HTTP download', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'shroom-quick-flow-'));
  const source = quickSource();
  const server = await NodeShroom.serveDevice(source, { port: 0, recordingsDir: directory });
  const errors = [];
  const first = await BrowserShroom.connectStream({ url: server.url, onError: (error) => errors.push(error) });
  const second = await BrowserShroom.connectStream({ url: server.url, onError: (error) => errors.push(error) });
  t.after(async () => { await first.close(); await second.close(); await server.close(); await rm(directory, { recursive: true, force: true }); });
  assert.equal(first.info.product, 'handGloveFullPacket');
  const started = await first.startRecording({ label: '握拳,中文标签' });
  await assert.rejects(second.startRecording({ label: '不能并发覆盖' }), { code: 'RECORDING_ACTIVE' });
  const received = framesFrom(first, 3);
  for (let i = 0; i < 3; i++) source.emit(i);
  const frames = await received;
  assert.ok(frames[0].fingers.index.pulp.raw instanceof Uint8Array);
  assert.ok(frames[0].palm.sourceIndices instanceof Uint16Array);
  assert.deepEqual(frames[0].palm.rowLengths, [12, 15, 15, 15, 15]);
  await first.close();
  assert.equal((await second.getRecordingStatus()).status, 'recording');
  const remaining = framesFrom(second, 1);
  source.emit(9);
  await remaining;
  const stopped = await second.stopRecording();
  assert.equal(stopped.id, started.id);
  assert.equal(stopped.status, 'stopped');
  assert.equal(stopped.frameCount, 4);
  assert.equal(stopped.source, 'mock');
  const list = await second.listRecordings();
  assert.equal(list[0].label, started.label);
  const response = await fetch(second.getRecordingUrl(stopped.id, { format: 'jsonl' }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /attachment/);
  const rows = (await response.text()).trim().split('\n').map(JSON.parse);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((row) => row.source === 'mock'));
  assert.ok(rows.every((row, i) => row.label === started.label && row.index === i && row.sessionId === started.id));
  assert.equal(rows[0].frame.fingers.index.pulp.raw.length, 1);
  const csv = await fetch(second.getRecordingUrl(stopped.id)).then((result) => result.text());
  assert.match(csv, /"握拳,中文标签"/);
  assert.match(csv, /pressureMatrix/);
  assert.equal(csv.trim().split('\r\n').length, 5);
  assert.equal(errors.length, 0);
});

test('a real ws constructor handshake timeout rejects without an unhandled closing error', async (t) => {
  const server = createServer();
  const sockets = new Set();
  server.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.on('upgrade', () => {}); // Keep the WS handshake pending until the client times out.
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise((resolve) => server.close(resolve)); });
  await assert.rejects(BrowserShroom.connectStream({ url: `ws://127.0.0.1:${server.address().port}`,
    WebSocketImpl: WebSocket, timeoutMs: 25, onError() {} }), { code: 'CONNECTION_FAILED' });
  await new Promise((resolve) => setTimeout(resolve, 30));
});

test('recording status broadcasts count persisted frames before stop', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'shroom-progress-'));
  const source = quickSource();
  const server = await NodeShroom.serveDevice(source, { port: 0, recordingsDir: directory });
  const client = await BrowserShroom.connectStream({ url: server.url, onError() {} });
  t.after(async () => { await client.close(); await server.close(); await rm(directory, { recursive: true, force: true }); });
  await client.startRecording({ label: '实时进度' });
  const progress = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error('progress timeout')); }, 2500);
    const unsubscribe = client.onRecording((recording) => {
      if (recording?.status === 'recording' && recording.frameCount === 2) { clearTimeout(timer); unsubscribe(); resolve(recording); }
    });
  });
  source.emit(1); source.emit(2);
  assert.equal((await progress).frameCount, 2);
  assert.equal((await client.stopRecording()).frameCount, 2);
});
