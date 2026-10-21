import { ShroomError } from './errors.js';

/** Versioned wire contract shared by the standalone server and browser client. */
export const STREAM_SCHEMA = 'shroom.frame.v1';
export const MAX_STREAM_POINTS = 16384;
const streamFingerKeys = ['thumb', 'index', 'middle', 'ring', 'little'];

/** Reject corrupt network data before constructing typed arrays or rendering. */
function streamInvalid(field) {
  throw new ShroomError('PARSE_FAILED', `数据帧字段无效：${field}`, {
    stage: 'parse', details: { field },
    suggestion: '确认服务端与浏览器使用相同版本的 Shroom SDK 数据协议。',
  });
}

/** Require an object; never spread untrusted input into the returned frame. */
function streamObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) streamInvalid(field);
  return value;
}

/** Validate numeric metadata without coercing strings, NaN or infinity. */
function streamNumber(value, field, min = 0, max = Number.MAX_VALUE, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max
    || (integer && !Number.isSafeInteger(value))) streamInvalid(field);
  return value;
}

/** Copy bounded numeric arrays and reject byte wrapping and Float32 overflow. */
function streamArray(value, field, { max = MAX_STREAM_POINTS, byte = false, index = false } = {}) {
  if ((!Array.isArray(value) && !ArrayBuffer.isView(value)) || !Number.isSafeInteger(value.length)
    || value.length > max) streamInvalid(field);
  return Array.from(value, (entry) => {
    streamNumber(entry, field, 0, byte || index ? 255 : Number.MAX_VALUE, byte || index);
    if (!byte && !index && !Number.isFinite(Math.fround(entry))) streamInvalid(field);
    return entry;
  });
}

/** Return either ordinary JSON arrays or fresh typed-array snapshots. */
function streamOutput(values, typed, Kind) {
  return typed ? Kind.from(values) : values;
}

/** Preserve real ragged rows: the palm has 72 points, not 75 padded points. */
function streamRegion(value, field, typed, expectedRows) {
  streamObject(value, field);
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 64) streamInvalid(`${field}.name`);
  const rows = streamNumber(value.rows, `${field}.rows`, 1, 5, true);
  const cols = streamNumber(value.cols, `${field}.cols`, 1, 15, true);
  const rowLengths = streamArray(value.rowLengths, `${field}.rowLengths`, { max: 5, index: true });
  if (rows !== expectedRows.length || rowLengths.length !== rows
    || rowLengths.some((length, i) => length !== expectedRows[i])
    || cols !== Math.max(...expectedRows)) streamInvalid(`${field}.rowLengths`);
  const size = rowLengths.reduce((sum, length) => sum + length, 0);
  const raw = streamArray(value.raw, `${field}.raw`, { max: 75, byte: true });
  const values = streamArray(value.values, `${field}.values`, { max: 75 });
  const indices = streamArray(value.sourceIndices, `${field}.sourceIndices`, { max: 75, index: true });
  if ([raw, values, indices].some((array) => array.length !== size)) streamInvalid(`${field}.length`);
  if (!Array.isArray(value.matrix) || value.matrix.length !== rows) streamInvalid(`${field}.matrix`);
  const matrix = value.matrix.map((row, i) => {
    const result = streamArray(row, `${field}.matrix[${i}]`, { max: 15, byte: true });
    if (result.length !== rowLengths[i]) streamInvalid(`${field}.matrix[${i}]`);
    return result;
  });
  return {
    name: value.name, rows, cols, rowLengths, matrix,
    raw: streamOutput(raw, typed, Uint8Array),
    values: streamOutput(values, typed, Float32Array),
    sourceIndices: streamOutput(indices, typed, Uint16Array),
  };
}

/** Validate and copy the shared matrix and the two supported product extensions. */
function streamReadFrame(input, typed) {
  streamObject(input, 'frame');
  const rows = streamNumber(input.rows, 'rows', 0, MAX_STREAM_POINTS, true);
  const cols = streamNumber(input.cols, 'cols', 0, MAX_STREAM_POINTS, true);
  const size = rows * cols;
  if (size > MAX_STREAM_POINTS || ((rows === 0) !== (cols === 0))) streamInvalid('rows/cols');
  const raw = streamArray(input.raw, 'raw', { byte: true });
  const values = streamArray(input.values, 'values');
  if (values.length !== size) streamInvalid('values.length');
  streamObject(input.center, 'center');
  const output = {
    raw: streamOutput(raw, typed, Uint8Array),
    values: streamOutput(values, typed, Float32Array), rows, cols,
    min: streamNumber(input.min, 'min'), max: streamNumber(input.max, 'max'),
    avg: streamNumber(input.avg, 'avg'), area: streamNumber(input.area, 'area', 0, size, true),
    center: { x: streamNumber(input.center.x, 'center.x', 0, 1), y: streamNumber(input.center.y, 'center.y', 0, 1) },
    timestamp: streamNumber(input.timestamp, 'timestamp'),
  };
  if (output.min > output.max) streamInvalid('min/max');
  if (input.product === undefined) return output;
  if (!['hand', 'handGloveFullPacket'].includes(input.product)) streamInvalid('product');
  const pressure = streamArray(input.pressure, 'pressure', { byte: true });
  const matrix = streamArray(input.pressureMatrix, 'pressureMatrix', { byte: true });
  if (pressure.length !== raw.length || pressure.some((value, i) => value !== raw[i])
    || matrix.length !== size) streamInvalid('pressure/pressureMatrix');
  output.product = input.product;
  output.pressure = typed ? output.raw : [...raw];
  output.pressureMatrix = streamOutput(matrix, typed, Uint8Array);
  if (input.product === 'hand') {
    if (rows !== 32 || cols !== 32 || raw.length !== 1024) streamInvalid('hand.shape');
    return output;
  }
  if (rows !== 13 || cols !== 15 || raw.length !== 256) streamInvalid('glove.shape');
  if (!['left', 'right'].includes(input.side)) streamInvalid('side');
  output.side = input.side;
  output.sequence = streamNumber(input.sequence, 'sequence', 0, 255, true);
  output.packetType = streamNumber(input.packetType, 'packetType', 0, 255, true);
  streamObject(input.imu, 'imu');
  const imu = streamArray(input.imu.raw, 'imu.raw', { max: 16, byte: true });
  if (imu.length !== 16) streamInvalid('imu.raw.length');
  output.imu = { raw: streamOutput(imu, typed, Uint8Array) };
  streamObject(input.fingers, 'fingers');
  output.fingers = {};
  for (const key of streamFingerKeys) {
    const field = `fingers.${key}`;
    const finger = streamRegion(input.fingers[key], field, typed, [3, 3, 3, 3]);
    finger.pulp = streamRegion(input.fingers[key].pulp, `${field}.pulp`, typed, [1]);
    output.fingers[key] = finger;
  }
  output.palm = streamRegion(input.palm, 'palm', typed, [12, 15, 15, 15, 15]);
  return output;
}

/** Encode one independent JSON snapshot; JSON.stringify never sees typed arrays. */
export function encodeStreamFrame(frame) {
  return streamReadFrame(frame, false);
}

/** Restore typed arrays after WS/JSON transport without applying a second mapping. */
export function decodeStreamFrame(frame) {
  return streamReadFrame(frame, true);
}
