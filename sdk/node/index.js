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
export { connectSerial, listPorts, connectProduct, connectGlove, connectHandPad } from './serial.js';
export { listDeviceProducts } from '../core/product.js';
export { renderAscii } from './ascii.js';
export { serveDevice } from './quick-server.js';
export { encodeStreamFrame, decodeStreamFrame, STREAM_SCHEMA } from '../core/stream-codec.js';
export { createMockDevice } from '../core/mock.js';
export { createFramer, DEFAULT_DELIMITER } from '../core/framer.js';
export { decodeFrame, resolveShape } from '../core/frame.js';
export { shroom, jet, jetWhite, grey, COLORMAPS, getColormap } from '../core/colormap.js';
export { LAYOUTS, getLayout, listLayouts, PRODUCTS, getProduct, listProducts } from '../core/layout.js';
export { BackendSdkClient } from './backend.js';
export { ShroomError, ERROR_CODES, asShroomError } from '../core/errors.js';
export { activateLicense, getLicenseStatus, clearLicense, SDK_PRODUCT_TYPE } from '../core/license.js';

import { connectSerial, listPorts, connectProduct, connectGlove, connectHandPad } from './serial.js';
import { listDeviceProducts } from '../core/product.js';
import { renderAscii } from './ascii.js';
import { serveDevice } from './quick-server.js';
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
  /** 选产品即可收取已解析数据 */
  connectProduct,
  connectGlove,
  connectHandPad,
  listDeviceProducts,
  /** 将已有设备广播为 WS 数据源，并提供持久化标签录制与下载。 */
  serveDevice,
  encodeStreamFrame,
  decodeStreamFrame,
  STREAM_SCHEMA,
  /** 连接真实设备 */
  connect: connectSerial,
  /** 列出可用串口 */
  listPorts,
  /** 模拟设备，接口和 connect() 一致 */
  mock: createMockDevice,
  /** 把一帧画成终端里的字符热力图 */
  renderAscii,
  version: '0.1.0',
};

export default Shroom;
