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
export { connectSerial, isSerialSupported, connectProduct, connectGlove, connectHandPad } from './serial.js';
export { listDeviceProducts } from '../core/product.js';
export { createHeatmap } from './heatmap.js';
export { connectStream } from './stream.js';
export { createProductView } from './product-view.js';
export { encodeStreamFrame, decodeStreamFrame, STREAM_SCHEMA } from '../core/stream-codec.js';
export { createMockDevice } from '../core/mock.js';
export { createFramer, DEFAULT_DELIMITER } from '../core/framer.js';
export { decodeFrame, resolveShape } from '../core/frame.js';
export { shroom, jet, jetWhite, grey, COLORMAPS, getColormap } from '../core/colormap.js';
export { LAYOUTS, getLayout, listLayouts, PRODUCTS, getProduct, listProducts } from '../core/layout.js';
export { BackendSdkClient } from '../backend/client.js';
export { ShroomError, ERROR_CODES, asShroomError } from '../core/errors.js';
export { activateLicense, getLicenseStatus, clearLicense, SDK_PRODUCT_TYPE } from '../core/license.js';

import { connectSerial, isSerialSupported, connectProduct, connectGlove, connectHandPad } from './serial.js';
import { listDeviceProducts } from '../core/product.js';
import { createHeatmap } from './heatmap.js';
import { connectStream } from './stream.js';
import { createProductView } from './product-view.js';
import { encodeStreamFrame, decodeStreamFrame, STREAM_SCHEMA } from '../core/stream-codec.js';
import { createMockDevice } from '../core/mock.js';
import { ShroomError, ERROR_CODES, asShroomError } from '../core/errors.js';
import { activateLicense, getLicenseStatus, clearLicense } from '../core/license.js';

export const Shroom = {
  activateLicense,
  getLicenseStatus,
  clearLicense,
  ShroomError,
  ERROR_CODES,
  asShroomError,
  /** 用户点击后选择产品端口，直接收取已解析数据 */
  connectProduct,
  connectGlove,
  connectHandPad,
  listDeviceProducts,
  /** 连接独立产品数据服务；录制保存在服务端。 */
  connectStream,
  /** 自动订阅并渲染手套分区或手部检测垫。 */
  createProductView,
  encodeStreamFrame,
  decodeStreamFrame,
  STREAM_SCHEMA,
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
