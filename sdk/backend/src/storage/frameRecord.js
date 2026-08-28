function safeJson(value, fallback = {}) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function buildStoredFrameRow({ captureId, sensorType, channel = 'sit', rawFrame, frame } = {}) {
  if (!captureId) throw new Error('captureId is required');
  const selected = frame?.captureData ?? frame?.pressureData ?? frame?.data;
  const data = Array.isArray(selected) || ArrayBuffer.isView(selected)
    ? Array.from(selected)
    : [];

  return {
    capture_id: captureId,
    sensor_type: sensorType || frame?.sensorType || '',
    channel: channel || frame?.channel || 'sit',
    timestamp: frame?.timestamp || Date.now(),
    raw_frame_hex: rawFrame ? Buffer.from(rawFrame).toString('hex') : null,
    data_json: safeJson(data, []),
    stats_json: safeJson(frame?.stats, {}),
    extra_json: safeJson({
      rotate: frame?.rotate || [],
      matrix: frame?.matrix || {},
      extra: frame?.extra || {},
      mapping: frame?.mapping || null,
      imu: frame?.imu || null,
      algorithmResults: frame?.algorithmResults || {},
    }),
  };
}

module.exports = {
  buildStoredFrameRow,
  safeJson,
};
