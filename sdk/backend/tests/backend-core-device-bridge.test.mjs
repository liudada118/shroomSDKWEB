import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createMockDevice } from '../../core/mock.js';

const require = createRequire(import.meta.url);
const {
  AlgorithmChannel,
  MemoryCaptureStore,
  ReplayService,
  ShroomSensorSDK,
  attachCoreDevice,
  backendFrameToCoreFrame,
  coreFrameToBackendFrame,
  resolveCaptureData,
} = require('../index.js');

test('后端根入口在串口可选依赖不可用时仍可加载内存能力', () => {
  const backendEntry = fileURLToPath(new URL('../index.js', import.meta.url));
  const script = `
    const Module = require('node:module')
    const originalLoad = Module._load
    Module._load = function (request, parent, isMain) {
      if (request === 'serialport' || request === '@serialport/parser-delimiter') {
        const error = new Error('simulated missing optional dependency')
        error.code = 'MODULE_NOT_FOUND'
        throw error
      }
      return originalLoad.call(this, request, parent, isMain)
    }
    const { MemoryCaptureStore, AlgorithmChannel, listSerialPorts } = require(${JSON.stringify(backendEntry)})
    const store = new MemoryCaptureStore()
    const algorithms = new AlgorithmChannel()
    if (!store || !algorithms) process.exit(2)
    listSerialPorts()
      .then(() => process.exit(3))
      .catch((error) => {
        if (error.code !== 'SERIAL_DEPENDENCY_MISSING') {
          console.error(error)
          process.exit(4)
        }
      })
  `;
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('ShroomSensorSDK.close 关闭串口管理器与存储', async () => {
  let disconnected = 0;
  let storeClosed = 0;
  const store = new MemoryCaptureStore();
  store.close = () => { storeClosed += 1; };
  const serialManager = {
    async disconnectAll() {
      disconnected += 1;
      return 0;
    },
  };
  const sdk = new ShroomSensorSDK({ store, serialManager });

  await sdk.close();

  assert.equal(disconnected, 1);
  assert.equal(storeClosed, 1);
});

test('Core Frame 适配保留 TypedArray、矩阵与统计字段', () => {
  const coreFrame = {
    raw: Uint8Array.from([0, 128, 255, 64]),
    values: Float32Array.from([0, 0.5, 1, 0.25]),
    rows: 2,
    cols: 2,
    min: 0,
    max: 1,
    avg: 0.4375,
    area: 3,
    center: { x: 0.5, y: 0.5 },
    timestamp: 1234,
  };

  const backendFrame = coreFrameToBackendFrame(coreFrame, {
    sensorType: 'matrix',
    channel: 'sit',
  });
  assert.deepEqual(backendFrame.data, [0, 0.5, 1, 0.25]);
  assert.deepEqual(backendFrame.matrix, { width: 2, height: 2 });
  assert.deepEqual(resolveCaptureData({ values: coreFrame.values }, { dataField: 'values' }), [0, 0.5, 1, 0.25]);

  const restored = backendFrameToCoreFrame(backendFrame);
  assert.ok(restored.raw instanceof Uint8Array);
  assert.ok(restored.values instanceof Float32Array);
  assert.equal(restored.rows, 2);
  assert.equal(restored.cols, 2);
  assert.deepEqual(Array.from(restored.values), [0, 0.5, 1, 0.25]);
});

test('Mock Device 可接入采集、算法、回放并恢复成 Core Frame', async () => {
  const store = new MemoryCaptureStore();
  const algorithmChannel = new AlgorithmChannel();
  algorithmChannel.register('sum', (data) => data.reduce((total, value) => total + value, 0));

  const device = createMockDevice({ rows: 2, cols: 2, fps: 120 });
  const session = attachCoreDevice(device, {
    store,
    algorithmChannel,
    sensorType: 'matrix',
    channel: 'sit',
  });

  session.startCapture({
    name: 'core-device-test',
    frequencyMode: 'serial',
    batchSize: 1,
  });

  const frame = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('等待 Mock Frame 超时')), 1000);
    session.once('frame', (nextFrame) => {
      clearTimeout(timer);
      resolve(nextFrame);
    });
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(typeof frame.algorithmResults.sum, 'number');
  const capture = session.stopCapture();
  assert.ok(capture.stats.storedFrames >= 1);

  const storedRow = store.queryFrames({ captureName: 'core-device-test' })[0];
  const storedStats = JSON.parse(storedRow.stats_json);
  const storedExtra = JSON.parse(storedRow.extra_json);
  assert.equal(storedStats.mean, frame.stats.avg);
  assert.equal(storedStats.point, frame.stats.area);
  assert.equal(Object.hasOwn(storedExtra.extra.coreFrameV1, 'values'), false);
  assert.equal(Object.hasOwn(storedExtra.extra.coreFrameV1, 'raw'), false);

  const replay = new ReplayService({ store, algorithmChannel });
  const replayFrames = replay.getFrames({ captureName: 'core-device-test' });
  assert.ok(replayFrames.length >= 1);
  const coreReplayFrame = backendFrameToCoreFrame(replayFrames[0]);
  assert.ok(coreReplayFrame.values instanceof Float32Array);
  assert.equal(coreReplayFrame.rows, 2);
  assert.equal(coreReplayFrame.cols, 2);
  assert.ok(coreReplayFrame.raw.length > 0);

  await session.close();
});
