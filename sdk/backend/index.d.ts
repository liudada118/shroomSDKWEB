export type NumericInput = number[] | Uint8Array | Float32Array | ArrayLike<number>;
export type BinaryInput = string | Uint8Array | ArrayBuffer | ArrayBufferView | number[];
export type UnknownRecord = Record<string, unknown>;
export type EventListener = (...args: any[]) => void;

declare class BackendEventEmitter {
  on(eventName: string | symbol, listener: EventListener): this;
  once(eventName: string | symbol, listener: EventListener): this;
  off(eventName: string | symbol, listener: EventListener): this;
  emit(eventName: string | symbol, ...args: any[]): boolean;
  listenerCount(eventName: string | symbol): number;
  removeAllListeners(eventName?: string | symbol): this;
}

export interface CoreFrame {
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

export interface BackendFrame {
  schemaVersion?: number;
  sensorType: string;
  channel: string;
  timestamp: number;
  valueScale?: string;
  rawLength?: number;
  rawValues?: number[];
  rawFrameHex?: string;
  data: number[];
  pressureData?: number[];
  matrixData?: number[];
  matrix?: { width: number; height: number } | null;
  stats?: {
    min?: number;
    max?: number;
    avg?: number;
    mean?: number;
    total?: number;
    area?: number;
    point?: number;
    center?: { x: number; y: number };
    [key: string]: unknown;
  };
  algorithmResults?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CaptureState {
  id: number;
  name: string;
  sensorType: string;
  hz: number | null;
  active: boolean;
  status: 'recording' | 'stopped' | 'error';
  pendingFrames: number;
  stats: {
    receivedFrames: number;
    queuedFrames: number;
    storedFrames: number;
    skippedFrames: number;
    flushCount: number;
  };
  [key: string]: unknown;
}

export interface CaptureOptions {
  name?: string;
  frequencyMode?: 'serial' | 'custom';
  frequencyHz?: number;
  hz?: number;
  dataField?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  minFreeBytes?: number;
  metadata?: Record<string, unknown>;
  frameSelector?: (frame: BackendFrame) => NumericInput;
}

export interface CaptureQuery {
  captureId?: number;
  captureName?: string;
  sensorType?: string;
  channel?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  offset?: number;
}

export interface CaptureStoreLike {
  createCapture(input: Record<string, unknown>): Record<string, unknown>;
  finishCapture(captureId: number): void;
  insertFrame(input: Record<string, unknown>): unknown;
  insertFrames?(inputs: Array<Record<string, unknown>>): unknown;
  listCaptures(filter?: Record<string, unknown>): Array<Record<string, unknown>>;
  countCaptures(filter?: Record<string, unknown>): number;
  getCapture(query?: CaptureQuery): Record<string, unknown> | null;
  queryFrames(query?: CaptureQuery): Array<Record<string, unknown>>;
  countFrames(query?: CaptureQuery): number;
  deleteCapture(query?: CaptureQuery): Record<string, unknown>;
  getFreeBytes?(): number | null;
  close(): void;
}

export class MemoryCaptureStore implements CaptureStoreLike {
  createCapture(input: Record<string, unknown>): Record<string, unknown>;
  finishCapture(captureId: number): void;
  insertFrame(input: Record<string, unknown>): unknown;
  insertFrames(inputs?: Array<Record<string, unknown>>): unknown;
  listCaptures(filter?: Record<string, unknown>): Array<Record<string, unknown>>;
  countCaptures(filter?: Record<string, unknown>): number;
  getCapture(query?: CaptureQuery): Record<string, unknown> | null;
  queryFrames(query?: CaptureQuery): Array<Record<string, unknown>>;
  countFrames(query?: CaptureQuery): number;
  deleteCapture(query?: CaptureQuery): Record<string, unknown>;
  close(): void;
}

export class CaptureStore implements CaptureStoreLike {
  constructor(options?: { dbDir?: string; dbPath?: string });
  readonly dbPath: string;
  createCapture(input: Record<string, unknown>): Record<string, unknown>;
  finishCapture(captureId: number): void;
  insertFrame(input: Record<string, unknown>): unknown;
  insertFrames(inputs?: Array<Record<string, unknown>>): unknown;
  listCaptures(filter?: Record<string, unknown>): Array<Record<string, unknown>>;
  countCaptures(filter?: Record<string, unknown>): number;
  getCapture(query?: CaptureQuery): Record<string, unknown> | null;
  queryFrames(query?: CaptureQuery): Array<Record<string, unknown>>;
  countFrames(query?: CaptureQuery): number;
  deleteCapture(query?: CaptureQuery): Record<string, unknown>;
  getFreeBytes(): number | null;
  close(): void;
}

export class CaptureController {
  constructor(options: {
    store: CaptureStoreLike;
    sensorType?: string;
    channels?: Record<string, string>;
    name?: string;
    metadata?: Record<string, unknown>;
    options?: CaptureOptions;
    onError?: (payload: Record<string, unknown>) => void;
    onFlush?: (payload: Record<string, unknown>) => void;
  });
  readonly id: number;
  readonly active: boolean;
  enqueueFrame(input: { channel?: string; rawFrame?: NumericInput; frame: BackendFrame }): boolean;
  flush(): number;
  stop(): CaptureState;
  getState(): CaptureState;
}

export type AlgorithmHandler = (
  data: number[],
  context: { frame: BackendFrame; results: Record<string, unknown>; name: string; [key: string]: unknown },
) => unknown;

export class AlgorithmChannel extends BackendEventEmitter {
  constructor(options?: { algorithms?: Record<string, AlgorithmHandler>; errorMode?: 'continue' | 'throw' });
  register(name: string, handler: AlgorithmHandler, options?: {
    enabled?: boolean;
    select?: (frame: BackendFrame, context: Record<string, unknown>) => NumericInput;
    when?: (frame: BackendFrame, context: Record<string, unknown>) => boolean;
  }): this;
  unregister(name: string): boolean;
  enable(name: string, enabled?: boolean): boolean;
  list(): Array<{ name: string; enabled: boolean }>;
  process(frame: BackendFrame, context?: Record<string, unknown>): BackendFrame;
}

export interface ReplayState {
  index: number;
  length: number;
  playing: boolean;
  ended: boolean;
  speed: number;
  loop: boolean;
  frame: BackendFrame | null;
}

export class ReplayPlayer extends BackendEventEmitter {
  constructor(options?: {
    timeline?: { length: number; time: number[]; frames: BackendFrame[] };
    speed?: number;
    loop?: boolean;
    setTimeoutFn?: (handler: () => void, delay?: number) => unknown;
    clearTimeoutFn?: (handle: unknown) => void;
  });
  play(): ReplayState;
  pause(): ReplayState;
  stop(): ReplayState;
  seek(index: number, options?: { emitFrame?: boolean }): ReplayState;
  step(count?: number): ReplayState;
  setSpeed(speed: number): ReplayState;
  setLoop(loop: boolean): ReplayState;
  getState(): ReplayState;
}

export class ReplayService {
  constructor(options: { store: CaptureStoreLike; algorithmChannel?: AlgorithmChannel });
  listCaptures(filter?: Record<string, unknown>): Array<Record<string, unknown>>;
  getFrames(options?: CaptureQuery & { applyAlgorithms?: boolean }): BackendFrame[];
  buildTimeline(options?: CaptureQuery & { applyAlgorithms?: boolean }): {
    length: number;
    time: number[];
    seconds?: string[];
    frames: BackendFrame[];
  };
  createPlayer(options?: CaptureQuery & { speed?: number; loop?: boolean; applyAlgorithms?: boolean }): ReplayPlayer;
}

export interface CsvExportResult { files: string[]; rows: number; dir: string }

export class CsvExporter {
  constructor(options: { store: CaptureStoreLike; exportDir?: string });
  exportCapture(options?: CaptureQuery & { language?: 'zh' | 'en'; locale?: string; outputPath?: string; exportDir?: string }): Promise<CsvExportResult>;
}

export interface CoreDevice {
  info?: Record<string, unknown>;
  onFrame(handler: (frame: CoreFrame) => void): () => void;
  close?(): Promise<void>;
}

export class CoreDeviceSession extends BackendEventEmitter {
  constructor(device: CoreDevice, options?: {
    sdk?: ShroomSensorSDK;
    store?: CaptureStoreLike;
    algorithmChannel?: AlgorithmChannel;
    sensorType?: string;
    channel?: string;
    closeDevice?: boolean;
  });
  readonly store: CaptureStoreLike;
  readonly latestFrame: BackendFrame | null;
  startCapture(options?: CaptureOptions): CaptureState;
  stopCapture(): CaptureState | null;
  getState(): Record<string, unknown>;
  close(): Promise<void>;
}

export interface SerialConnectResult extends Record<string, unknown> {
  session?: SensorSession;
  sessions: SensorSession[];
  sdk?: ShroomSensorSDK;
}

export class SensorSession extends BackendEventEmitter {
  readonly sensorType: string;
  readonly sessionId?: string;
  startCapture(options: CaptureOptions & { store: CaptureStoreLike }): CaptureState;
  stopCapture(): CaptureState | null;
  write(channel: string, data: BinaryInput): Promise<Record<string, unknown>>;
  close(): Promise<void>;
  getState(): Record<string, unknown>;
}

export class SerialManager extends BackendEventEmitter {
  constructor(options: { sdk: ShroomSensorSDK; [key: string]: unknown });
  connect(options?: Record<string, unknown>): Promise<SerialConnectResult>;
  rescan(options?: Record<string, unknown>): Promise<SerialConnectResult>;
  write(target: unknown, channel: string, data: BinaryInput, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
  disconnect(target: unknown): Promise<boolean>;
  disconnectAll(): Promise<number>;
  close(): Promise<number>;
  getState(): Record<string, unknown>;
}

export class ShroomSensorSDK {
  constructor(options?: Record<string, unknown> & {
    store?: CaptureStoreLike;
    dbDir?: string;
    dbPath?: string;
    exportDir?: string;
    algorithmChannel?: AlgorithmChannel;
  });
  readonly algorithmChannel: AlgorithmChannel;
  readonly serialManager: SerialManager;
  readonly registry: ProtocolRegistry;
  readonly zeroCalibrator: ZeroCalibrator;
  getStore(): CaptureStoreLike;
  registerProfile(sensorType: string, profile: Record<string, unknown>): unknown;
  registerLineOrder(name: string, handler: (data: number[], context?: Record<string, unknown>) => number[]): unknown;
  listLineOrders(): string[];
  applyLineOrder(name: string, data: number[], context?: Record<string, unknown>): number[];
  registerAlgorithm(name: string, handler: AlgorithmHandler, options?: Record<string, unknown>): this;
  unregisterAlgorithm(name: string): boolean;
  processAlgorithms(frame: BackendFrame, context?: Record<string, unknown>): BackendFrame;
  listPorts(options?: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  open(options?: Record<string, unknown>): Promise<SensorSession>;
  connectGlove(options?: Record<string, unknown>): Promise<SensorSession>;
  connectSerial(options?: Record<string, unknown>): Promise<SerialConnectResult>;
  rescanSerial(options?: Record<string, unknown>): Promise<SerialConnectResult>;
  writeSerial(target: unknown, channel: string, data: BinaryInput, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
  disconnectSerial(target?: unknown): Promise<boolean | number>;
  getSerialState(): Record<string, unknown>;
  startCapture(session: SensorSession | CoreDeviceSession, options?: CaptureOptions): CaptureState;
  stopCapture(session: SensorSession | CoreDeviceSession): CaptureState | null;
  listCaptures(filter?: Record<string, unknown>): Array<Record<string, unknown>>;
  countCaptures(filter?: Record<string, unknown>): number;
  getCapture(options?: CaptureQuery): Record<string, unknown> | null;
  getCaptureFrames(options?: CaptureQuery): Array<Record<string, unknown>>;
  countCaptureFrames(options?: CaptureQuery): number;
  deleteCapture(options?: CaptureQuery): Record<string, unknown>;
  replay(options?: CaptureQuery & { applyAlgorithms?: boolean }): ReturnType<ReplayService['buildTimeline']>;
  createReplay(options?: CaptureQuery & { speed?: number; loop?: boolean; applyAlgorithms?: boolean }): ReplayPlayer;
  exportCsv(options?: CaptureQuery & { language?: 'zh' | 'en'; locale?: string; outputPath?: string }): Promise<CsvExportResult>;
  close(): Promise<void>;
}

export function attachCoreDevice(device: CoreDevice, options?: ConstructorParameters<typeof CoreDeviceSession>[1]): CoreDeviceSession;
export function coreFrameToBackendFrame(frame: CoreFrame, options?: { sensorType?: string; channel?: string; valueScale?: string }): BackendFrame;
export function backendFrameToCoreFrame(frame: BackendFrame): CoreFrame;
export function connectSerial(options?: Record<string, unknown>): Promise<SerialConnectResult & { sdk: ShroomSensorSDK }>;
export function connectGlove(options?: Record<string, unknown>): Promise<SensorSession & { sdk: ShroomSensorSDK }>;
export function createPressureStatsAlgorithm(options?: { threshold?: number }): AlgorithmHandler;
export function selectFrameData(frame: BackendFrame): number[];
export function normalizeCaptureFrequency(value: unknown, fallback?: number): number;
export function normalizeCaptureOptions(options?: CaptureOptions): Required<Pick<CaptureOptions, 'frequencyMode' | 'frequencyHz' | 'dataField' | 'batchSize' | 'flushIntervalMs' | 'minFreeBytes'>> & Record<string, unknown>;
export function resolveCaptureData(frame: BackendFrame, options?: CaptureOptions): number[];
export function normalizeSpeed(speed: unknown): number;

export class ProtocolRegistry {
  constructor(profiles?: Record<string, Record<string, unknown>>, options?: Record<string, unknown>);
  readonly lineOrders: LineOrderRegistry;
  registerProfile(sensorType: string, profile?: Record<string, unknown>): unknown;
  getProfile(sensorType: string, override?: Record<string, unknown>): Record<string, unknown>;
  parse(sensorType: string, buffer: BinaryInput, context?: Record<string, unknown>): BackendFrame | null;
}

export class ZeroCalibrator {
  getKey(sensorType: string, channel?: string): string;
  setBaseline(sensorType: string, channel: string, data: number[]): void;
  clearBaseline(sensorType?: string, channel?: string): void;
  captureBaseline(frame: BackendFrame): void;
  apply(frame: BackendFrame): BackendFrame;
}

export class BackendCommandRouter extends BackendEventEmitter {
  route(message: BinaryInput | Record<string, unknown>): Record<string, unknown>;
}

export class BackendSdkClient extends BackendEventEmitter {
  constructor(options?: Record<string, unknown>);
  route(name: string, params?: Record<string, unknown>): string;
  request(routeOrName: string, options?: Record<string, unknown>): Promise<unknown>;
  getContract(options?: { refresh?: boolean }): Promise<unknown>;
  getChannels(): Promise<unknown>;
  getWsStatus(): Promise<unknown>;
  listDisplaySystems(): Promise<unknown>;
  getDisplaySystem(id: string | number): Promise<unknown>;
  listSerialPorts(): Promise<unknown>;
  getSerialStatus(role?: string): Promise<unknown>;
  getCurrentSensor(): Promise<unknown>;
  setSensorType(type: string): Promise<unknown>;
  openSerial(options?: Record<string, unknown>): Promise<unknown>;
  closeSerial(options?: Record<string, unknown>): Promise<unknown>;
  startCollection(options?: Record<string, unknown>): Promise<unknown>;
  stopCollection(): Promise<unknown>;
  connectRealtime(options?: { channels?: string[] }): unknown;
  disconnectRealtime(): void;
  sendRealtime(message: unknown): void;
  subscribe(channels: string | string[]): void;
  unsubscribe(channels: string | string[]): void;
}

export class LicenseService {
  constructor(options?: Record<string, unknown>);
  parseKey(encryptedKey: string): Record<string, unknown>;
  getSelectFlag(licenseFile: string | string[] | null): string | string[] | null;
  getDefaultFile(licenseFile: string | string[] | null, fallback?: string): string;
  isExpired(expiresAt: string | number, now?: number): boolean;
}

export class PathService {
  constructor(options?: Record<string, unknown>);
  ensureRuntimeDirs(): Record<string, string>;
  validateWritableDirectory(targetDir: string): Record<string, unknown>;
  getExportPath(filename: string, dir?: string): string;
}

export class ReportService {
  constructor(options?: Record<string, unknown>);
  setPythonClient(pythonClient: unknown): void;
  getDbHeatmap(options?: Record<string, unknown>): Promise<unknown>;
  generateFootPressureReport(options?: Record<string, unknown>): Promise<unknown>;
}

export class LineOrderRegistry {
  constructor(lineOrders?: Record<string, (data: number[], context?: Record<string, unknown>) => number[]>);
  register(name: string, handler: (data: number[], context?: Record<string, unknown>) => number[]): (data: number[], context?: Record<string, unknown>) => number[];
  has(name: string): boolean;
  get(name: string): ((data: number[], context?: Record<string, unknown>) => number[]) | undefined;
  list(): string[];
  apply(name: string, data: number[], context?: Record<string, unknown>): number[];
}

export class SerialConnectionError extends Error {
  code: string;
  details?: Record<string, unknown>;
}
export class GloveConnectionError extends Error { code: string; }
export class GloveFrameError extends Error { code: string; }

export function classifySerialError(error: unknown): string;
export function createSerialError(code: string, details?: Record<string, unknown>, cause?: unknown): SerialConnectionError;
export function isPortBusyError(error: unknown): boolean;
export function isPortNotFoundError(error: unknown): boolean;
export function normalizeSerialError(error: unknown, fallbackCode?: string, details?: Record<string, unknown>): SerialConnectionError;
export function serializeSerialError(error: unknown): Record<string, unknown>;
export function detectBaudRate(portOrPath: unknown, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
export function filterSerialPorts(ports?: Array<Record<string, unknown>>): Array<Record<string, unknown>>;
export function listDevicePorts(options?: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
export function listSerialPorts(options?: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
export function tryBaudRate(portOrPath: unknown, baudRate: number, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
export function writeSerialPort(port: unknown, data: BinaryInput): Promise<Record<string, unknown>>;

export function createProjectLineOrderRegistry(extra?: Record<string, (data: number[]) => number[]>): LineOrderRegistry;
export function listBackendOperations(): Array<Record<string, unknown>>;
export function getDefaultBaudRate(sensorType: string): number;
export function getGloveProductProfile(profileId: string): Record<string, unknown>;
export function isGloveProfile(profileId: string): boolean;
export function buildQuaternion(input: BinaryInput): {
  encoding: 'float32le';
  order: 'xyzw';
  values: number[];
  x: number;
  y: number;
  z: number;
  w: number;
  norm: number;
  valid: boolean;
};
export function decodeFloat32LE(input: BinaryInput): number[];
export function mapGlovePressure(values: NumericInput, side?: string, product?: Record<string, unknown>): Record<string, unknown>;
export function remapGloveFrame(frame: BackendFrame): BackendFrame;
export function flattenGloveHandMapping(side: string, mapping?: Record<string, unknown>): unknown[];
export function handLeft256To147(values: NumericInput): number[];
export function handLeft256To1024(values: NumericInput): number[];
export function handRight256To147(values: NumericInput): number[];
export function handRight256To1024(values: NumericInput): number[];
export function mapHand147To1024(values: NumericInput): number[];
export function mapHand256To147(values: NumericInput, side?: string): number[];
export function validateGloveHandMapping(mapping?: Record<string, unknown>): Record<string, unknown>;
export function mapFullPacketPressure(values: NumericInput, side?: string): number[];
export function mapFullPacketTo1024(values: NumericInput, side?: string): number[];
export function createGlovePacketAssembler(profileOrId: string | Record<string, unknown>): {
  push(buffer: BinaryInput, context?: Record<string, unknown>): BackendFrame | null;
  reset(): void;
};
export function parseFullGlovePacket(buffer: BinaryInput, profileOrId: string | Record<string, unknown>, context?: Record<string, unknown>): BackendFrame;
export function validateGlovePacket(buffer: BinaryInput, profileOrId: string | Record<string, unknown>): Record<string, unknown>;

export const CONNECTION_ERROR_META: Readonly<Record<string, Record<string, unknown>>>;
export const DEFAULT_BAUD_CANDIDATES: readonly number[];
export const DEFAULT_BAUD_DEVICE_MAP: Readonly<Record<number, string>>;
export const VALID_FRAME_LENGTHS: readonly number[];
export const PROJECT_LINE_ORDER_NAMES: readonly string[];
export const BACKEND_OPERATIONS: readonly Record<string, unknown>[];
export const DEFAULT_SENSOR_PROFILES: Readonly<Record<string, Record<string, unknown>>>;
export const STANDARD_FRAME_DELIMITER: Uint8Array;
export const SMALL_BED_12B_FRAME_TAIL: Uint8Array;
export const GLOVE_DATA_SEMANTICS: Readonly<Record<string, unknown>>;
export const GLOVE_PRODUCT_PROFILES: Readonly<Record<string, Record<string, unknown>>>;
export const GLOVE_PROFILE_IDS: readonly string[];
export const GLOVE_HAND_MAPPING: Readonly<Record<string, unknown>>;
export const HAND_LEFT_ADC_ORDER: readonly number[];
export const HAND_MODEL_POINTS: Readonly<Record<string, unknown>>;
export const HAND_RIGHT_ADC_ORDER: readonly number[];
export const FULL_PACKET_HAND_LAYOUTS: Readonly<Record<string, unknown>>;
