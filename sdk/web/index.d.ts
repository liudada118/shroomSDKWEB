import type {
  ColormapFn,
  ColormapName,
  DecodeOptions,
  Device,
  FramerOptions,
  Heatmap,
  HeatmapOptions,
  MockOptions,
  WebConnectOptions,
} from '../types.js';

export type {
  ColormapFn,
  ColormapName,
  DecodeOptions,
  Device,
  DeviceInfo,
  Frame,
  FramerOptions,
  Heatmap,
  HeatmapOptions,
  MockOptions,
  WebConnectOptions,
} from '../types.js';

export function connectSerial(options?: WebConnectOptions): Promise<Device>;
export function isSerialSupported(): boolean;
export function createHeatmap(target: HTMLCanvasElement | string, options?: HeatmapOptions): Heatmap;
export function createMockDevice(options?: MockOptions): Device;
export function decodeFrame(payload: Uint8Array, options?: DecodeOptions): import('../types.js').Frame;
export function resolveShape(points: number, options?: DecodeOptions): { rows: number; cols: number };
export function createFramer(options?: FramerOptions): {
  push(chunk: Uint8Array): Uint8Array[];
  reset(): void;
  readonly droppedCount: number;
  readonly frameLength: number;
};
export const DEFAULT_DELIMITER: number[];
export const jet: ColormapFn;
export const jetWhite: ColormapFn;
export const grey: ColormapFn;
export const COLORMAPS: Record<ColormapName, ColormapFn>;
export function getColormap(name?: ColormapName | ColormapFn): ColormapFn;

export const Shroom: {
  connect(options?: WebConnectOptions): Promise<Device>;
  mock(options?: MockOptions): Device;
  createHeatmap(target: HTMLCanvasElement | string, options?: HeatmapOptions): Heatmap;
  isSupported(): boolean;
  version: string;
};

export default Shroom;
