/** 串口和模拟设备共用的只读诊断快照。 */
export function serialDiagnostics({
  source,
  state,
  bytesReceived,
  frameCount,
  droppedCount,
  frameLength,
  lastError = null,
}) {
  let status;
  let hint;
  if (state === 'closed') {
    status = 'closed';
    hint = '连接已关闭。';
  } else if (state === 'error') {
    status = 'error';
    hint = lastError?.suggestion || '连接发生错误；请查看 lastError，检查设备连接和串口配置。';
  } else if (frameCount > 0) {
    status = 'streaming';
    hint = droppedCount > 0
      ? `已成功解析 ${frameCount} 帧，已丢弃 ${droppedCount} 帧；请检查波特率、分隔符和帧长配置。`
      : `已成功解析 ${frameCount} 帧；此累计计数不表示设备仍在持续发送数据。`;
  } else if (bytesReceived > 0) {
    status = 'waiting-frame';
    hint = '已收到字节，尚未解析出完整帧；请检查波特率、分隔符和帧长配置。';
    if (droppedCount > 0) hint += ` 已丢弃 ${droppedCount} 帧。`;
  } else {
    status = 'waiting-data';
    hint = '尚未收到字节；请检查设备供电、端口、接线，以及设备是否正在发送数据。';
  }
  const errorInfo = lastError == null ? null : typeof lastError.toJSON === 'function'
    ? lastError.toJSON()
    : {
      name: lastError.name,
      code: lastError.code,
      stage: lastError.stage,
      message: lastError.message,
      suggestion: lastError.suggestion,
      details: { ...lastError.details },
    };
  return { source, state, bytesReceived, frameCount, droppedCount, frameLength, lastError: errorInfo, status, hint };
}
