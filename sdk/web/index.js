/**
 * Shroom SDK · 浏览器入口
 *
 * 全部能力只有三件事：连接串口、拿到数据、画成图。
 *
 *   import { Shroom } from './sdk/web/index.js'
 *
 *   const device  = await Shroom.connect()                    // 必须在点击里调用
 *   const heatmap = Shroom.createHeatmap('#view')
 *   device.onFrame(frame => heatmap.render(frame))
 *
 * 没有硬件就把第一行换成 Shroom.mock()，其余代码一个字不用改。
 */
export { connectSerial, isSerialSupported } from './serial.js';
export { createHeatmap } from './heatmap.js';
export { createMockDevice } from '../core/mock.js';
export { createFramer, DEFAULT_DELIMITER } from '../core/framer.js';
export { decodeFrame, resolveShape } from '../core/frame.js';
export { jet, jetWhite, grey, COLORMAPS, getColormap } from '../core/colormap.js';

import { connectSerial, isSerialSupported } from './serial.js';
import { createHeatmap } from './heatmap.js';
import { createMockDevice } from '../core/mock.js';

export const Shroom = {
  /** 连接真实设备，必须在用户点击等手势里调用 */
  connect: connectSerial,
  /** 模拟设备，接口和 connect() 完全一致，用来没硬件时调界面 */
  mock: createMockDevice,
  /** 在 canvas 上创建热力图 */
  createHeatmap,
  /** 当前浏览器是否支持串口 */
  isSupported: isSerialSupported,
  version: '0.1.0',
};

export default Shroom;
