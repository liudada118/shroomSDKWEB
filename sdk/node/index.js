/**
 * Shroom SDK · Node 入口
 *
 *   import { Shroom } from './sdk/node/index.js'
 *
 *   const device = await Shroom.connect({ path: 'COM3' })
 *   device.onFrame(frame => console.log(frame.max, frame.area))
 *
 * 没有硬件就用 Shroom.mock()，接口完全一致。
 */
export { connectSerial, listPorts } from './serial.js';
export { renderAscii } from './ascii.js';
export { createMockDevice } from '../core/mock.js';
export { createFramer, DEFAULT_DELIMITER } from '../core/framer.js';
export { decodeFrame, resolveShape } from '../core/frame.js';
export { jet, jetWhite, grey, COLORMAPS, getColormap } from '../core/colormap.js';

import { connectSerial, listPorts } from './serial.js';
import { renderAscii } from './ascii.js';
import { createMockDevice } from '../core/mock.js';

export const Shroom = {
  /** 连接真实设备 */
  connect: connectSerial,
  /** 列出可用串口 */
  listPorts,
  /** 模拟设备，接口和 connect() 一致 */
  mock: createMockDevice,
  /** 把一帧画成终端里的字符热力图 */
  renderAscii,
  version: '0.2.0-preview.1',
};

export default Shroom;
