export interface BackendFrame {
  channelId?: string;
  portId?: string;
  value?: unknown;
  timestamp?: number;
  /** Backend-defined fields are preserved; this is not the serial SDK's Frame. */
  [key: string]: unknown;
}

export interface BackendContract {
  http?: { routes?: Record<string, string> };
  websocket?: { messageTypes?: { SUBSCRIBE?: string; UNSUBSCRIBE?: string } };
  [key: string]: unknown;
}

export interface BackendClientOptions {
  httpBaseUrl?: string;
  wsUrl?: string;
  fetchImpl?: typeof fetch;
  /** Browser-compatible WebSocket constructor; Node entry also falls back to ws. */
  WebSocketImpl?: typeof WebSocket;
  contract?: BackendContract | null;
  routes?: Record<string, string>;
  headers?: HeadersInit;
  /** HTTP and WebSocket opening timeout, default 10000 ms. */
  timeoutMs?: number;
}

export interface BackendRequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  raw?: boolean;
  routeParams?: Record<string, string | number>;
  headers?: HeadersInit;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface BackendClientEvents {
  open: [];
  close: [event: unknown];
  error: [error: Error];
  message: [message: unknown];
  frame: [frame: BackendFrame];
  raw: [message: unknown];
}

export const DEFAULT_HTTP_BASE_URL: string;
export const DEFAULT_WS_URL: string;
export const DEFAULT_ROUTES: Readonly<Record<string, string>>;
export function normalizeHttpResult(payload: unknown): unknown;

export class BackendSdkClient {
  constructor(options?: BackendClientOptions);
  readonly httpBaseUrl: string;
  readonly wsUrl: string;
  readonly timeoutMs: number;
  readonly contract: BackendContract | null;
  readonly routes: Record<string, string>;
  readonly ws: WebSocket | null;
  on<K extends keyof BackendClientEvents>(event: K, handler: (...args: BackendClientEvents[K]) => void): this;
  off<K extends keyof BackendClientEvents>(event: K, handler: (...args: BackendClientEvents[K]) => void): this;
  once<K extends keyof BackendClientEvents>(event: K, handler: (...args: BackendClientEvents[K]) => void): this;
  removeAllListeners(event?: keyof BackendClientEvents): this;
  route(name: string, params?: Record<string, string | number>): string;
  request<T = unknown>(routeOrName: string, options?: BackendRequestOptions): Promise<T>;
  getContract(options?: { refresh?: boolean }): Promise<BackendContract>;
  getChannels(): Promise<unknown>;
  getWsStatus(): Promise<unknown>;
  listDisplaySystems(): Promise<unknown>;
  getDisplaySystem(id: string): Promise<unknown>;
  listSerialPorts(): Promise<unknown>;
  getSerialStatus(role?: string): Promise<unknown>;
  getCurrentSensor(): Promise<unknown>;
  setSensorType(type: string): Promise<unknown>;
  openSerial(options: { role?: string; port?: string; path?: string; portPath?: string }): Promise<unknown>;
  closeSerial(options?: { role?: string }): Promise<unknown>;
  startCollection(options?: Record<string, unknown>): Promise<unknown>;
  stopCollection(): Promise<unknown>;
  connectRealtime(options?: { channels?: string | string[]; timeoutMs?: number; protocols?: string | string[] }): WebSocket;
  disconnectRealtime(): void;
  subscribe(channels: string | string[]): void;
  unsubscribe(channels: string | string[]): void;
  sendRealtime(message: unknown): void;
  handleRealtimeMessage(message: unknown): void;
}
