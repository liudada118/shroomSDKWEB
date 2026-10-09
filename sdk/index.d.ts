/**
 * Shroom SDK 类型定义。
 * 整个 SDK 只有三件事：连接串口、拿到 Frame、画成图。
 */

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
  /** 被丢弃的脏帧数（模拟设备没有这个字段） */
  readonly droppedCount?: number;
  /** 串口收到的原始字节数。为 0 说明设备没在发数据（只有串口设备有） */
  readonly bytesReceived?: number;
  /** 成功切出的帧数。字节在涨而它不涨 = 波特率或分隔符不对（只有串口设备有） */
  readonly frameCount?: number;
  /** 锁定下来的帧长（字节），还没锁上是 0。不是完全平方数就得显式指定 rows / cols */
  readonly frameLength?: number;
  close(): Promise<void>;
}

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
  /** 帧率，默认 30 */
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
  connect(options?: WebConnectOptions): Promise<Device>;
  mock(options?: MockOptions): Device;
  createHeatmap(target: HTMLCanvasElement | string, options?: HeatmapOptions): Heatmap;
  isSupported(): boolean;
  version: string;
};

export default Shroom;
