export type * from '../index.js';
export {
  ShroomError, ERROR_CODES, asShroomError, listDeviceProducts,
  activateLicense, getLicenseStatus, clearLicense, SDK_PRODUCT_TYPE,
  createMockDevice, createFramer, DEFAULT_DELIMITER, decodeFrame, resolveShape,
  shroom, jet, jetWhite, grey, COLORMAPS, getColormap,
  LAYOUTS, getLayout, listLayouts, PRODUCTS, getProduct, listProducts,
  encodeStreamFrame, decodeStreamFrame, STREAM_SCHEMA,
} from '../index.js';
export { BackendSdkClient } from './backend.js';
import type { NodeConnectOptions, Device, MockOptions, Frame, AsciiOptions, PortInfo, ShroomError, ERROR_CODES, asShroomError } from '../index.js';
import type { NodeProductOptions, NodeGloveOptions, NodeHandPadOptions, ProductDevice, GloveFrame, HandPadFrame, listDeviceProducts } from '../index.js';
import type { FrameSource, RecordingSession, encodeStreamFrame, decodeStreamFrame, STREAM_SCHEMA } from '../index.js';
import type { activateLicense, getLicenseStatus, clearLicense } from '../index.js';

export interface DeviceServerOptions {
  /** 默认19999；0让系统分配空闲端口，适用于测试。 */
  port?: number;
  /** 默认127.0.0.1；跨机访问须显式提供允许的Origin列表。 */
  host?: string;
  recordingsDir?: string;
  allowedOrigins?: string[];
  maxBufferedBytes?: number;
  maxQueueFrames?: number;
}
export interface DeviceServer {
  readonly port: number;
  readonly host: string;
  readonly url: string;
  readonly httpUrl: string;
  startRecording(options: { label: string }): Promise<RecordingSession>;
  stopRecording(): Promise<RecordingSession | null>;
  getRecordingStatus(): RecordingSession | null;
  listRecordings(): Promise<RecordingSession[]>;
  /** 停止服务并等待录制写完，不关闭调用者拥有的设备。 */
  close(): Promise<void>;
}
export function serveDevice<T extends Frame>(device: FrameSource<T>, options?: DeviceServerOptions): Promise<DeviceServer>;

export function connectSerial(options?: NodeConnectOptions): Promise<Device>;
export function connectGlove(options: NodeGloveOptions): Promise<ProductDevice<GloveFrame>>;
export function connectHandPad(options?: NodeHandPadOptions): Promise<ProductDevice<HandPadFrame>>;
export function connectProduct(options: NodeGloveOptions & { product: 'handGloveFullPacket' }): Promise<ProductDevice<GloveFrame>>;
export function connectProduct(options: NodeHandPadOptions & { product: 'hand' }): Promise<ProductDevice<HandPadFrame>>;
export function connectProduct(options: NodeProductOptions): Promise<ProductDevice<GloveFrame | HandPadFrame>>;
export const Shroom: {
  activateLicense: typeof activateLicense;
  getLicenseStatus: typeof getLicenseStatus;
  clearLicense: typeof clearLicense;
  ShroomError: typeof ShroomError;
  ERROR_CODES: typeof ERROR_CODES;
  asShroomError: typeof asShroomError;
  connectProduct: typeof connectProduct;
  connectGlove: typeof connectGlove;
  connectHandPad: typeof connectHandPad;
  listDeviceProducts: typeof listDeviceProducts;
  serveDevice: typeof serveDevice;
  encodeStreamFrame: typeof encodeStreamFrame;
  decodeStreamFrame: typeof decodeStreamFrame;
  STREAM_SCHEMA: typeof STREAM_SCHEMA;
  connect(options?: NodeConnectOptions): Promise<Device>;
  mock(options?: MockOptions): Device;
  listPorts(): Promise<PortInfo[]>;
  renderAscii(frame: Frame, options?: AsciiOptions): string;
  version: string;
};
export default Shroom;
