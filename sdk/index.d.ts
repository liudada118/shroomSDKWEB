/**
 * Shroom SDK 类型定义。
 * 串口产品取数、WS快速接入、产品展示与服务端标签录制，以及已有后端客户端。
 */

export { BackendSdkClient } from './backend/client.js';
export type { BackendClientOptions, BackendFrame, BackendContract, BackendRequestOptions } from './backend/client.js';

/** 串口/模拟设备错误；已有后端客户端的错误约定不变。 */
export type ErrorCode =
  | 'INVALID_CONFIG' | 'DEPENDENCY_MISSING' | 'PORT_NOT_FOUND' | 'PORT_AMBIGUOUS'
  | 'PERMISSION_DENIED' | 'PORT_BUSY' | 'CONNECTION_FAILED' | 'UNSUPPORTED_ENVIRONMENT'
  | 'USER_CANCELLED' | 'DISCONNECTED' | 'READ_FAILED' | 'WRITE_FAILED' | 'CLOSE_FAILED'
  | 'PARSE_FAILED' | 'CALLBACK_FAILED' | 'SERVER_CLOSED' | 'SERVER_ERROR' | 'SERVER_START_FAILED'
  | 'INVALID_REQUEST' | 'ORIGIN_DENIED' | 'REQUEST_FAILED' | 'REQUEST_TIMEOUT'
  | 'RECORDING_ACTIVE' | 'RECORDING_NOT_ACTIVE' | 'RECORDING_NOT_FOUND'
  | 'RECORDING_INTERRUPTED' | 'RECORDING_OVERFLOW' | 'RECORDING_WRITE_FAILED'
  | 'LICENSE_REQUIRED' | 'LICENSE_INVALID' | 'LICENSE_EXPIRED' | 'LICENSE_UNAVAILABLE'
  | 'LICENSE_REJECTED' | 'LICENSE_PRODUCT_MISMATCH' | 'LICENSE_SCOPE_DENIED' | 'LICENSE_FEATURE_DENIED' | 'LICENSE_DEVICE_REQUIRED';
export type ErrorStage = 'query' | 'configure' | 'connect' | 'read' | 'write' | 'parse' | 'close' | 'callback' | 'serve' | 'stream' | 'recording' | 'render' | 'license';
export interface ShroomErrorOptions {
  stage?: ErrorStage;
  suggestion?: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}
export interface SerialErrorInfo {
  name: string;
  code: ErrorCode;
  stage: ErrorStage;
  message: string;
  suggestion: string;
  details: Record<string, unknown>;
}
export class ShroomError extends Error {
  constructor(code: ErrorCode, message: string, options?: ShroomErrorOptions);
  code: ErrorCode;
  stage: ErrorStage;
  suggestion: string;
  details: Record<string, unknown>;
  cause?: unknown;
  toJSON(): SerialErrorInfo;
}
export const ERROR_CODES: Readonly<{ [Code in ErrorCode]: Code }>;
export function asShroomError(error: unknown, options?: ShroomErrorOptions & { code?: ErrorCode; message?: string }): ShroomError;
export const SDK_PRODUCT_TYPE: 'shroom-sdk';
export interface LicenseOptions {
  mode?: 'online' | 'offline';
  /** Defaults to https://shroom.jq-industries.com; only HTTPS or loopback HTTP is accepted. */
  serverUrl?: string;
  /** Stable SHA-256 identifier supplied by the host application; required for limited computer allowances. */
  deviceId?: string;
  /** Trusted issuer's RSA public PEM for offline codes. Never take this from an untrusted license. */
  publicKey?: string;
}
export type LicenseStatus = {
  valid: true; productType: 'shroom-sdk'; mode: 'online' | 'offline-local' | 'offline-device';
  expiresAt: number; leaseExpiresAt: number;
  /** Compatibility metadata: SDK licensing does not restrict sensor models, so this is empty. */
  products: string[];
  /** Always true for a valid SDK license; protocol support is independent of licensing. */
  allProducts: boolean;
  features: string[];
} | { valid: false; productType: 'shroom-sdk'; code: ErrorCode; message: string };
/** Activate before opening hardware; replacing or clearing a license closes existing licensed sessions. */
export function activateLicense(key: string, options?: LicenseOptions): Promise<LicenseStatus>;
export function getLicenseStatus(): LicenseStatus;
export function clearLicense(): void;
export type DeviceState = 'open' | 'closed' | 'error';
export interface SerialDiagnostics {
  source: DeviceInfo['source'];
  state: DeviceState;
  status: 'waiting-data' | 'waiting-frame' | 'streaming' | 'closed' | 'error';
  bytesReceived: number;
  frameCount: number;
  droppedCount: number;
  frameLength: number;
  lastError: SerialErrorInfo | null;
  hint: string;
}

/** 一帧数据。所有数据源（真实串口 / 模拟）产出的结构都是这个 */
export interface Frame {
  /** 原始 ADC 值，0~255，一个点一个字节 */
  raw: Uint8Array;
  /** 归一化到 0~1 的值，长度 = rows * cols */
  values: Float32Array;
  rows: number;
  cols: number;
  /** 归一化后的最小值 */
  min: number;
  /** 归一化后的最大值 */
  max: number;
  /** 归一化后的平均值 */
  avg: number;
  /** 超过阈值的点数 */
  area: number;
  /** 压力重心，x/y 都是 0~1 */
  center: { x: number; y: number };
  /** 毫秒时间戳 */
  timestamp: number;
}

/**
 * 点位排列（线序）名。串口里的字节是采集板的扫描顺序，不等于垫子上的位置，
 * 按产品选一个就能对上。'raw' 是不转换，原样铺。
 */
export type LayoutName =
  | 'raw'
  | 'mat32'
  | 'sit'
  | 'bed1'
  | 'carSeat'
  | 'carBack'
  | 'car10'
  | 'car10Back'
  | 'sit10'
  | 'yanfeng10'
  | 'yanfeng10Back'
  | 'volvo'
  | 'volvoBack'
  | 'volvoHead'
  | 'smallM'
  | 'rect'
  | 'short'
  | 'matCol'
  | 'sitCol'
  | 'xiyue'
  | 'carCol'
  | 'sit100'
  | 'endiSit'
  | 'sofa'
  | 'handSinglePoint'
  | 'wholeChair'
  | 'wholeChairBack'
  | 'wholeChairHead'
  | 'tempFullBed'
  | 'smallSample'
  | 'footInsole';

export interface DecodeOptions {
  /** 指定行数，不填按方阵推断；给了 layout 就以 layout 的行数为准 */
  rows?: number;
  /** 指定列数 */
  cols?: number;
  /** 只取前 N 个字节 */
  points?: number;
  /** 满量程，默认 255 */
  fullScale?: number;
  /** 有效点阈值（归一化后），默认 0.02 */
  threshold?: number;
  /** 点位排列，默认 'raw'。选了它就不用再传 rows / cols */
  layout?: LayoutName;
}

export interface FramerOptions {
  /** 帧分隔符，默认 [0xAA, 0x55, 0x03, 0x99] */
  delimiter?: number[];
  /** 小于这个长度的帧丢弃，默认 8 */
  minLength?: number;
  /** 大于这个长度的帧丢弃，默认 8192 */
  maxLength?: number;
  /**
   * 锁定帧长，默认 true。连着几帧长度一致就把它锁死，之后长度对不上的一律当脏帧丢掉。
   * 分隔符只有 4 个字节，数据里迟早会撞出一模一样的一串，切出来的短帧解码后会退化成
   * 1×N 一条横线，画面就在方阵和横线之间闪。关掉它就是老行为：长度只要在
   * minLength~maxLength 之间就收下。
   */
  lockLength?: boolean;
}

export interface DeviceInfo {
  source: 'web-serial' | 'node-serial' | 'mock';
  rows?: number | null;
  cols?: number | null;
  baudRate?: number;
  path?: string;
  fps?: number;
}

export interface Device {
  info: DeviceInfo;
  /** 订阅每一帧，返回取消订阅的函数 */
  onFrame(handler: (frame: Frame) => void): () => void;
  /** 运行时错误订阅；连接前的错误由 connect() 拒绝。返回取消订阅函数。 */
  onError(handler: (error: ShroomError) => void): () => void;
  readonly state: DeviceState;
  /** 诊断快照，不是实时采样率；lastError 保留最近一次错误。 */
  getDiagnostics(): SerialDiagnostics;
  /** 被丢弃的脏帧数；模拟设备为 0 */
  readonly droppedCount: number;
  /** 串口原始字节数；模拟设备为已生成的 payload 字节数 */
  readonly bytesReceived: number;
  /** 串口成功切出的帧数；模拟设备为成功生成的帧数 */
  readonly frameCount: number;
  /** 锁定下来的帧长（字节），还没锁上是 0。不是完全平方数就得显式指定 rows / cols */
  readonly frameLength: number;
  close(): Promise<void>;
}

/** 已核实并封装串口协议的产品；与旧 listProducts() 的展示线序清单不同。 */
export type DeviceProductId = 'handGloveFullPacket' | 'hand';
export interface DeviceProductInfo {
  product: DeviceProductId;
  label: string;
  family: 'glove' | 'mat';
  baudRate: number;
  payloadLength: number;
  sensorPoints: number;
  rows: number;
  cols: number;
}
export interface ProductFrame extends Frame {
  product: DeviceProductId;
  /** 原始扫描顺序 ADC；不是物理压力单位。与 raw 指向同一份帧内快照。 */
  pressure: Uint8Array;
  /** 按产品映射后的 ADC，长度 rows*cols；values 是对应的 0~1 相对值。 */
  pressureMatrix: Uint8Array;
}
/** 用户点位表定义的区域；手掌首行仅12点，不能假定raw.length=rows*cols。 */
export interface GloveRegion {
  name: string;
  rows: number;
  /** 点位表声明的列宽；每行实际点数见rowLengths。 */
  cols: number;
  rowLengths: number[];
  /** 按行展开的原始256点扫描索引，从0开始。 */
  sourceIndices: Uint16Array;
  /** 区域ADC值，0~255，不包含额外补零。 */
  raw: Uint8Array;
  /** 使用同父帧fullScale归一化的区域值。 */
  values: Float32Array;
  /** ADC按点位表逐行排列；手掌行长为12、15、15、15、15。 */
  matrix: number[][];
}
export interface GloveFingerRegion extends GloveRegion {
  /** 单独的指腹传感点，不混入手指12个主体点。 */
  pulp: GloveRegion;
}
export interface GloveFingers {
  thumb: GloveFingerRegion;
  index: GloveFingerRegion;
  middle: GloveFingerRegion;
  ring: GloveFingerRegion;
  little: GloveFingerRegion;
}
export interface GloveFrame extends ProductFrame {
  product: 'handGloveFullPacket';
  side: 'left' | 'right';
  /** 设备单字节帧号，可回绕；不是毫秒时间戳。 */
  sequence: number;
  /** 原始包类型，不用于猜测左右手。 */
  packetType: number;
  /** 按用户最新左右手点位表提取，不是切分旧pressureMatrix。 */
  fingers: GloveFingers;
  palm: GloveRegion;
  /** 只保留 16 字节 IMU，不承诺四元数分量、轴序或单位。 */
  imu: { raw: Uint8Array };
}
export interface HandPadFrame extends ProductFrame { product: 'hand'; }

/** 服务端持久化的一次标签录制；一个会话对应一个不可变标签。 */
export interface RecordingSession {
  id: string;
  label: string;
  startedAt: number;
  endedAt: number | null;
  frameCount: number;
  status: 'recording' | 'stopped' | 'error';
  product?: string;
  source?: string;
  side?: 'left' | 'right';
  error?: { code: string; message: string };
}
export type RecordingFormat = 'csv' | 'jsonl';
/** 只要求订阅能力，串口设备与自定义数据源可以复用同一快速链路。 */
export interface FrameSource<T extends Frame = Frame> {
  info?: { source?: string; product?: string; side?: string };
  onFrame?(handler: (frame: T) => void): () => void;
  onData?(handler: (frame: T) => void): () => void;
  onError?(handler: (error: Error) => void): () => void;
}
export interface StreamOptions<T extends Frame = Frame> {
  /** 同机只填端口；跨机还需主机与服务端的来源授权。 */
  port?: number;
  host?: string;
  url?: string;
  timeoutMs?: number;
  onData?: (frame: T) => void;
  onError?: (error: Error) => void;
  WebSocketImpl?: typeof WebSocket;
}
export interface StreamDevice<T extends Frame = Frame> extends FrameSource<T> {
  info: { source?: string; product?: string; side?: string };
  readonly state: DeviceState;
  onFrame(handler: (frame: T) => void): () => void;
  onData(handler: (frame: T) => void): () => void;
  onError(handler: (error: Error) => void): () => void;
  onRecording(handler: (recording: RecordingSession | null) => void): () => void;
  startRecording(options: { label: string }): Promise<RecordingSession>;
  stopRecording(): Promise<RecordingSession | null>;
  getRecordingStatus(): Promise<RecordingSession | null>;
  listRecordings(): Promise<RecordingSession[]>;
  /** recordingId 必填，使用服务端返回的采集记录 id，不是产品 ID、标签或端口。 */
  getRecordingUrl(recordingId: string, options?: { format?: RecordingFormat }): string;
  /** 在用户点击中按指定采集记录 ID 下载；不默认下载最近记录，不把文件堆入 JS 内存。 */
  downloadRecording(recordingId: string, options?: { format?: RecordingFormat }): string;
  /** 断开浏览器，不自动停止后端录制；重连后查询真实状态。 */
  close(): Promise<void>;
  readonly recording: RecordingSession | null;
  readonly url: string;
}
export interface ProductViewOptions<T extends Frame = Frame> extends HeatmapOptions {
  source?: FrameSource<T>;
  product?: DeviceProductId;
}
export interface ProductView {
  render(frame: Frame): void;
  resize(): void;
  destroy(): void;
  readonly element: HTMLElement;
  readonly product: DeviceProductId | null;
}
/** 接收产品帧的普通 JSON 快照；TypedArray 字段在传输中编码为普通数组。 */
export type StreamFrame = Record<string, unknown>;
export const STREAM_SCHEMA: 'shroom.frame.v1';
export function encodeStreamFrame(frame: Frame): StreamFrame;
export function decodeStreamFrame(frame: unknown): Frame | GloveFrame | HandPadFrame;
export function connectStream<T extends Frame = Frame>(options?: StreamOptions<T>): Promise<StreamDevice<T>>;
/** source 存在时自动订阅；手套为二维分区视图，不包含三维模型。 */
export function createProductView<T extends Frame = Frame>(target: HTMLElement | string, options?: ProductViewOptions<T>): ProductView;
export interface ProductDevice<T extends ProductFrame = ProductFrame> extends Omit<Device, 'info' | 'onFrame'> {
  info: DeviceInfo & { product: T['product']; label: string; side?: 'left' | 'right' };
  onFrame(handler: (frame: T) => void): () => void;
  /** onFrame 的产品入口别名。 */
  onData(handler: (frame: T) => void): () => void;
}
export interface ProductCallbacks<T extends ProductFrame> {
  /** 连接前注册，首帧可能早于 await 返回；同步调用，不等待 Promise。 */
  onData?: (frame: T) => void;
  onError?: (error: ShroomError) => void;
}
export interface WebGloveOptions extends ProductCallbacks<GloveFrame> {
  side: 'left' | 'right';
  port?: unknown;
  filters?: WebConnectOptions['filters'];
}
export interface WebHandPadOptions extends ProductCallbacks<HandPadFrame> {
  port?: unknown;
  filters?: WebConnectOptions['filters'];
}
export interface NodeGloveOptions extends ProductCallbacks<GloveFrame> {
  side: 'left' | 'right';
  /** 未指定时仅一个端口可自动选择；多端口抛 PORT_AMBIGUOUS。 */
  path?: string;
}
export interface NodeHandPadOptions extends ProductCallbacks<HandPadFrame> {
  path?: string;
}
export type WebProductOptions =
  | (WebGloveOptions & { product: 'handGloveFullPacket' })
  | (WebHandPadOptions & { product: 'hand' });
export type NodeProductOptions =
  | (NodeGloveOptions & { product: 'handGloveFullPacket' })
  | (NodeHandPadOptions & { product: 'hand' });
export function listDeviceProducts(): DeviceProductInfo[];
export function connectGlove(options: WebGloveOptions): Promise<ProductDevice<GloveFrame>>;
export function connectHandPad(options?: WebHandPadOptions): Promise<ProductDevice<HandPadFrame>>;
export function connectProduct(options: WebGloveOptions & { product: 'handGloveFullPacket' }): Promise<ProductDevice<GloveFrame>>;
export function connectProduct(options: WebHandPadOptions & { product: 'hand' }): Promise<ProductDevice<HandPadFrame>>;
export function connectProduct(options: WebProductOptions): Promise<ProductDevice<GloveFrame | HandPadFrame>>;

export type ColormapName = 'shroom' | 'jet' | 'jetWhite' | 'grey';
export type ColormapFn = (t: number) => [number, number, number];

export interface HeatmapOptions {
  /** 画法：'dots' 透视点阵（默认）、'heat' 热力圆斑、'grid' 方格 */
  mode?: 'dots' | 'heat' | 'grid';
  /** 配色，默认 'jet'。'shroom' 是公司桌面端那一套 */
  colormap?: ColormapName | ColormapFn;
  /** 是否平滑，默认 true。只对 'heat' / 'grid' 有效 */
  smooth?: boolean;
  /** 画之前先铺一层底色，如 '#666'。默认透明。热力圆斑带透明度，垫了底色才像桌面端 */
  background?: string | null;
  /** 显示增益，默认 1 */
  gain?: number;
  /** 点 / 圆斑的大小倍数，默认 1 */
  dotSize?: number;
  /** 点阵起伏高度倍数，默认 1；给 0 就是平的俯视点阵。只对 'dots' 有效 */
  relief?: number;
  /** 俯视角（度），5~89，默认 70。越大越像正俯视、方阵看着越方。只对 'dots' 有效 */
  tilt?: number;
  /**
   * 数据第一行画在近处（画面下方），默认 true。
   * 按下面却是上面鼓起来，说明传感器的行序和这里反了，设成 false 即可。只对 'dots' 有效
   */
  flipY?: boolean;
}

export interface Heatmap {
  /** 记下这一帧，在下一个屏幕刷新周期画出来。调得比屏幕快也不会多画 */
  render(frame: Frame): void;
  resize(): void;
  setOptions(options: HeatmapOptions): void;
  clear(): void;
  readonly canvas: HTMLCanvasElement;
}

export interface WebConnectOptions extends DecodeOptions, FramerOptions {
  /** 波特率，默认 1000000 */
  baudRate?: number;
  /** 设备筛选，如 [{ usbVendorId: 0x1a86 }] */
  filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
  /** 已经拿到的 SerialPort，传了就不再弹选择框 */
  port?: unknown;
}

export interface NodeConnectOptions extends DecodeOptions, FramerOptions {
  /** 端口号，如 'COM3' / '/dev/ttyUSB0'；不填自动挑第一个 */
  path?: string;
  /** 波特率，默认 1000000 */
  baudRate?: number;
}

export interface MockOptions extends DecodeOptions {
  rows?: number;
  cols?: number;
  /** 帧率，默认 30；范围 1000/2147483647 至 1000，避免计时器溢出 */
  fps?: number;
}

export interface AsciiOptions {
  /** 输出多少列，默认 32 */
  width?: number;
  colormap?: ColormapName | ColormapFn;
  gain?: number;
}

export interface PortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

// ---- core ----
export function decodeFrame(payload: Uint8Array, options?: DecodeOptions): Frame;
export function resolveShape(points: number, options?: DecodeOptions): { rows: number; cols: number };
export function createFramer(options?: FramerOptions): {
  push(chunk: Uint8Array): Uint8Array[];
  reset(): void;
  readonly droppedCount: number;
  /** 锁定下来的帧长（字节），还没锁上是 0 */
  readonly frameLength: number;
};
export const DEFAULT_DELIMITER: number[];
export function createMockDevice(options?: MockOptions): Device;

export interface LayoutInfo {
  name: LayoutName;
  /** 中文名，给下拉框用 */
  label: string;
  rows: number;
  cols: number;
}

/**
 * 取排列表。perm[显示位置] = 这个位置在扫描顺序里的下标，-1 表示这里没有传感器。
 * 'raw' 或名字不认识时返回 null，也就是不转换。
 */
export function getLayout(name?: LayoutName): {
  rows: number;
  cols: number;
  perm: Int32Array;
} | null;

/** 列出所有排列。这是按线序列的，界面下拉框请用 listProducts() */
export function listLayouts(): LayoutInfo[];

/** 产品名，和公司桌面端「请选择传感器」菜单里的 value 一致 */
export type ProductName =
  | 'hand'
  | 'smallSample'
  | 'footVideo'
  | 'jqbed'
  | 'smallBedNoAlg'
  | 'tempFullBed'
  | 'petCare'
  | 'petCareMini'
  | 'fast256'
  | 'fast1024'
  | 'handSinglePoint'
  | 'normal'
  | 'humanBody';

export interface ProductInfo {
  name: ProductName;
  /** 产品名，和桌面端菜单一字不差 */
  label: string;
  /** 这款产品该用哪条线序；'raw' 表示不用换，按扫描顺序原样铺 */
  layout: LayoutName | 'raw';
  rows: number;
  cols: number;
}

/** 按产品名取一项，名字不认识返回 null */
export function getProduct(name?: ProductName): ProductInfo | null;

/** 列出所有产品，界面下拉框用这个。顺序是桌面端菜单的顺序 */
export function listProducts(): ProductInfo[];

export const jet: ColormapFn;
export const jetWhite: ColormapFn;
export const grey: ColormapFn;
export const COLORMAPS: Record<ColormapName, ColormapFn>;
export function getColormap(name?: ColormapName | ColormapFn): ColormapFn;

// ---- web ----
export function connectSerial(options?: WebConnectOptions): Promise<Device>;
export function isSerialSupported(): boolean;
export function createHeatmap(target: HTMLCanvasElement | string, options?: HeatmapOptions): Heatmap;

// ---- node（从 shroom-sdk/node 导入）----
export function listPorts(): Promise<PortInfo[]>;
export function renderAscii(frame: Frame, options?: AsciiOptions): string;

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
  connectStream: typeof connectStream;
  createProductView: typeof createProductView;
  encodeStreamFrame: typeof encodeStreamFrame;
  decodeStreamFrame: typeof decodeStreamFrame;
  STREAM_SCHEMA: typeof STREAM_SCHEMA;
  connect(options?: WebConnectOptions): Promise<Device>;
  mock(options?: MockOptions): Device;
  createHeatmap(target: HTMLCanvasElement | string, options?: HeatmapOptions): Heatmap;
  isSupported(): boolean;
  version: string;
};

export default Shroom;
