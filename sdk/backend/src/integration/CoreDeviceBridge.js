const { EventEmitter } = require('events');
const { CaptureController } = require('../capture/CaptureController');
const { MemoryCaptureStore } = require('../storage/MemoryCaptureStore');

function toNumericArray(value) {
  if (Array.isArray(value)) return value.map((item) => Number(item) || 0);
  if (ArrayBuffer.isView(value)) return Array.from(value, (item) => Number(item) || 0);
  return [];
}

function finiteOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * 把轻量 Web / Node / Mock 入口的 Frame 转成后端链路使用的可序列化 Frame。
 * 原始 TypedArray 会被转换为普通数组，避免 SQLite / JSON 采集时丢失数据。
 */
function coreFrameToBackendFrame(frame, options = {}) {
  if (!frame || typeof frame !== 'object') throw new TypeError('frame is required');

  const raw = toNumericArray(frame.raw);
  const values = toNumericArray(frame.values ?? frame.data ?? frame.pressureData);
  const rows = Math.max(1, finiteOr(frame.rows, 1));
  const cols = Math.max(1, finiteOr(frame.cols, values.length || 1));
  const timestamp = finiteOr(frame.timestamp, Date.now());
  const valueScale = options.valueScale || frame.valueScale || 'normalized-0-1';
  const center = {
    x: finiteOr(frame.center?.x),
    y: finiteOr(frame.center?.y),
  };
  const total = values.reduce((sum, value) => sum + finiteOr(value), 0);
  const avg = finiteOr(frame.avg, values.length ? total / values.length : 0);
  const area = finiteOr(frame.area);
  const stats = {
    min: finiteOr(frame.min),
    max: finiteOr(frame.max),
    avg,
    mean: avg,
    total,
    area,
    point: area,
    center,
  };

  return {
    schemaVersion: 1,
    sensorType: options.sensorType || frame.sensorType || 'core-frame',
    channel: options.channel || frame.channel || 'sit',
    valueScale,
    timestamp,
    rawLength: raw.length,
    rawValues: raw,
    data: values,
    pressureData: values,
    matrixData: values,
    matrix: { width: cols, height: rows },
    stats,
    algorithmResults: frame.algorithmResults || {},
    extra: {
      ...(frame.extra || {}),
      valueScale,
      coreFrameV1: {
        schemaVersion: 1,
        valueScale,
        rows,
        cols,
        ...stats,
        timestamp,
      },
    },
  };
}

/** 把存储 / 回放帧恢复成可以直接交给现有 Heatmap 的核心 Frame。 */
function backendFrameToCoreFrame(frame) {
  if (!frame || typeof frame !== 'object') throw new TypeError('frame is required');

  const snapshot = frame.extra?.coreFrameV1 || frame.extra?.extra?.coreFrameV1 || {};
  const values = toNumericArray(snapshot.values ?? frame.data ?? frame.pressureData);
  const raw = toNumericArray(snapshot.raw ?? frame.rawValues);
  if (!raw.length && typeof frame.rawFrameHex === 'string') {
    const normalized = frame.rawFrameHex.replace(/[^0-9a-f]/gi, '');
    for (let index = 0; index + 1 < normalized.length; index += 2) {
      raw.push(Number.parseInt(normalized.slice(index, index + 2), 16));
    }
  }
  const matrix = frame.matrix || frame.extra?.matrix || {};
  const stats = frame.stats || {};
  const rows = Math.max(1, finiteOr(snapshot.rows ?? matrix.height, 1));
  const cols = Math.max(1, finiteOr(snapshot.cols ?? matrix.width, values.length || 1));

  return {
    raw: Uint8Array.from(raw),
    values: Float32Array.from(values),
    rows,
    cols,
    min: finiteOr(snapshot.min ?? stats.min),
    max: finiteOr(snapshot.max ?? stats.max),
    avg: finiteOr(snapshot.avg ?? stats.avg ?? stats.mean),
    area: finiteOr(snapshot.area ?? stats.area ?? stats.point),
    center: {
      x: finiteOr(snapshot.center?.x ?? stats.center?.x),
      y: finiteOr(snapshot.center?.y ?? stats.center?.y),
    },
    timestamp: finiteOr(snapshot.timestamp ?? frame.timestamp, Date.now()),
  };
}

class CoreDeviceSession extends EventEmitter {
  constructor(device, options = {}) {
    super();
    if (!device || typeof device.onFrame !== 'function') {
      throw new TypeError('device.onFrame is required');
    }

    this.device = device;
    this.sensorType = options.sensorType || 'core-frame';
    this.channel = options.channel || 'sit';
    this.channels = {
      [this.channel]: device.info?.path || device.info?.source || 'attached-device',
    };
    this.store = options.store || options.sdk?.getStore?.() || new MemoryCaptureStore();
    this.algorithmChannel = options.algorithmChannel || options.sdk?.algorithmChannel || null;
    this.closeDevice = options.closeDevice !== false;
    this.capture = null;
    this.latestFrame = null;
    this.closed = false;
    this.offFrame = device.onFrame((frame) => this.handleFrame(frame));
  }

  emitError(payload) {
    if (this.listenerCount('error') > 0) this.emit('error', payload);
    else this.emit('sessionError', payload);
  }

  handleFrame(coreFrame) {
    try {
      let frame = coreFrameToBackendFrame(coreFrame, {
        sensorType: this.sensorType,
        channel: this.channel,
      });
      if (this.algorithmChannel) {
        frame = this.algorithmChannel.process(frame, {
          source: 'attached-device',
          sensorType: this.sensorType,
          channel: this.channel,
        });
      }
      this.latestFrame = frame;
      try {
        this.emit('frame', frame);
      } catch (error) {
        this.emitError({ error, phase: 'frame', channel: this.channel });
      }
      if (this.capture?.active) {
        this.capture.enqueueFrame({
          channel: this.channel,
          rawFrame: coreFrame.raw,
          frame,
        });
      }
    } catch (error) {
      this.emitError({ error, phase: 'adapt', channel: this.channel });
    }
  }

  startCapture({ name, hz, frequencyHz, frequencyMode, metadata = {}, ...options } = {}) {
    if (this.capture?.active) throw new Error('capture is already active');
    this.capture = new CaptureController({
      store: this.store,
      sensorType: this.sensorType,
      channels: this.channels,
      name,
      metadata: {
        ...metadata,
        source: this.device.info?.source || 'attached-device',
        frameSchemaVersion: 1,
      },
      options: {
        ...options,
        hz,
        frequencyHz,
        frequencyMode,
        dataField: options.dataField || 'data',
      },
      onError: (payload) => {
        this.emit('captureError', payload);
        this.emitError(payload);
      },
      onFlush: (payload) => this.emit('captureFlush', payload),
    });
    const state = this.capture.getState();
    this.emit('captureStart', state);
    return state;
  }

  stopCapture() {
    if (!this.capture) return null;
    const state = this.capture.stop();
    this.emit('captureStop', state);
    return state;
  }

  getState() {
    return {
      sensorType: this.sensorType,
      channel: this.channel,
      closed: this.closed,
      deviceInfo: this.device.info || null,
      latestFrame: this.latestFrame,
      capture: this.capture?.getState?.() || null,
    };
  }

  async close() {
    if (this.closed) return;
    if (this.capture?.active) this.stopCapture();
    this.offFrame?.();
    if (this.closeDevice && typeof this.device.close === 'function') {
      await this.device.close();
    }
    this.closed = true;
    this.emit('close');
  }
}

function attachCoreDevice(device, options = {}) {
  return new CoreDeviceSession(device, options);
}

module.exports = {
  CoreDeviceSession,
  attachCoreDevice,
  backendFrameToCoreFrame,
  coreFrameToBackendFrame,
  toNumericArray,
};
