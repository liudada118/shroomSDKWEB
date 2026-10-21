import { ShroomError } from './errors.js';

// Bound allocations before a corrupt configuration can create a huge frame/buffer.
export const MAX_MATRIX_POINTS = 1048576;

function serialConfigObject(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new ShroomError('INVALID_CONFIG', '配置必须是一个对象', { stage: 'configure' });
  }
  return options;
}

function serialConfigInvalid(field, expected) {
  throw new ShroomError('INVALID_CONFIG', `${field} ${expected}`, {
    stage: 'configure', details: { field }, suggestion: `修正 ${field}：${expected}。`,
  });
}

function serialConfigNumber(options, field, { min = 0, max = Infinity, integer = false, exclusive = false } = {}) {
  const value = options[field];
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isSafeInteger(value))
    || (exclusive ? value <= min : value < min) || value > max) {
    serialConfigInvalid(field, `必须是${integer ? '整数' : '有限数值'}，范围${exclusive ? '大于' : '不小于'} ${min}${max < Infinity ? ` 且不大于 ${max}` : ''}`);
  }
}

export function validateFramerOptions(options = {}) {
  serialConfigObject(options);
  serialConfigNumber(options, 'minLength', { integer: true, max: MAX_MATRIX_POINTS });
  serialConfigNumber(options, 'maxLength', { min: 1, integer: true, max: MAX_MATRIX_POINTS });
  if ((options.minLength ?? 8) > (options.maxLength ?? 8192)) serialConfigInvalid('minLength', '不能大于 maxLength');
  if (options.lockLength !== undefined && typeof options.lockLength !== 'boolean') serialConfigInvalid('lockLength', '必须是布尔值');
  if (options.delimiter !== undefined) {
    const value = options.delimiter;
    if ((!Array.isArray(value) && !(ArrayBuffer.isView(value) && typeof value[Symbol.iterator] === 'function'))
      || value.length < 1 || value.length > 64
      || !Array.from(value).every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
      serialConfigInvalid('delimiter', '必须包含 1 至 64 个 0 到 255 的字节');
    }
  }
  return { ...options, ...(options.delimiter === undefined ? {} : { delimiter: Array.from(options.delimiter) }) };
}

export function validateDecodeOptions(options = {}) {
  serialConfigObject(options);
  for (const field of ['rows', 'cols']) serialConfigNumber(options, field, { min: 1, integer: true, max: MAX_MATRIX_POINTS });
  if ((options.rows === undefined) !== (options.cols === undefined)) serialConfigInvalid('rows / cols', '必须同时指定');
  if (options.rows !== undefined && options.rows * options.cols > MAX_MATRIX_POINTS) serialConfigInvalid('rows / cols', `矩阵总点数不能超过 ${MAX_MATRIX_POINTS}`);
  serialConfigNumber(options, 'points', { integer: true, max: MAX_MATRIX_POINTS });
  serialConfigNumber(options, 'fullScale', { min: 0, exclusive: true });
  serialConfigNumber(options, 'threshold');
  if (options.layout !== undefined && typeof options.layout !== 'string') serialConfigInvalid('layout', '必须是排列名称字符串');
  // Preserve the documented fallback for unknown JS layout names; do not infer products.
  return { ...options };
}

export function validateSerialOptions(options = {}) {
  const result = validateFramerOptions(validateDecodeOptions(options));
  serialConfigNumber(result, 'baudRate', { min: 1, integer: true });
  if (result.path !== undefined && (typeof result.path !== 'string' || !result.path.trim())) serialConfigInvalid('path', '必须是非空端口路径');
  return result;
}

export function validateMockOptions(options = {}) {
  const result = validateDecodeOptions(options);
  // JS timers use a signed 32-bit millisecond delay; smaller FPS would wrap to 1 ms.
  serialConfigNumber(result, 'fps', { min: 1000 / 2147483647, max: 1000 });
  return result;
}
