import type {
  AsciiOptions,
  ColormapFn,
  ColormapName,
  DecodeOptions,
  Device,
  FramerOptions,
  MockOptions,
  NodeConnectOptions,
  PortInfo,
} from '../types.js';

export type {
  AsciiOptions,
  ColormapFn,
  ColormapName,
  DecodeOptions,
  Device,
  DeviceInfo,
  Frame,
  FramerOptions,
  MockOptions,
  NodeConnectOptions,
  PortInfo,
} from '../types.js';

export function connectSerial(options?: NodeConnectOptions): Promise<Device>;
export function listPorts(): Promise<PortInfo[]>;
export function renderAscii(frame: import('../types.js').Frame, options?: AsciiOptions): string;
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
  connect(options?: NodeConnectOptions): Promise<Device>;
  listPorts(): Promise<PortInfo[]>;
  mock(options?: MockOptions): Device;
  renderAscii(frame: import('../types.js').Frame, options?: AsciiOptions): string;
  version: string;
};

export default Shroom;
