export interface Frame {
  raw: Uint8Array;
  values: Float32Array;
  rows: number;
  cols: number;
  min: number;
  max: number;
  avg: number;
  area: number;
  center: { x: number; y: number };
  timestamp: number;
}

export interface DecodeOptions {
  rows?: number;
  cols?: number;
  points?: number;
  fullScale?: number;
  threshold?: number;
}

export interface FramerOptions {
  delimiter?: number[];
  minLength?: number;
  maxLength?: number;
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
  onFrame(handler: (frame: Frame) => void): () => void;
  readonly droppedCount?: number;
  readonly bytesReceived?: number;
  readonly frameCount?: number;
  readonly frameLength?: number;
  close(): Promise<void>;
}

export type ColormapName = 'jet' | 'jetWhite' | 'grey';
export type ColormapFn = (t: number) => [number, number, number];

export interface HeatmapOptions {
  mode?: 'dots' | 'heat' | 'grid';
  colormap?: ColormapName | ColormapFn;
  smooth?: boolean;
  gain?: number;
  dotSize?: number;
  relief?: number;
  tilt?: number;
  flipY?: boolean;
}

export interface Heatmap {
  render(frame: Frame): void;
  resize(): void;
  setOptions(options: HeatmapOptions): void;
  clear(): void;
  readonly canvas: HTMLCanvasElement;
}

export interface WebConnectOptions extends DecodeOptions, FramerOptions {
  baudRate?: number;
  filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
  port?: unknown;
}

export interface NodeConnectOptions extends DecodeOptions, FramerOptions {
  path?: string;
  baudRate?: number;
}

export interface MockOptions extends DecodeOptions {
  rows?: number;
  cols?: number;
  fps?: number;
}

export interface AsciiOptions {
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
