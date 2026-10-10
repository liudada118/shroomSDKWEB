export * from '../index.js';
import type { NodeConnectOptions, Device, MockOptions, Frame, AsciiOptions, PortInfo } from '../index.js';

export function connectSerial(options?: NodeConnectOptions): Promise<Device>;
export const Shroom: {
  connect(options?: NodeConnectOptions): Promise<Device>;
  mock(options?: MockOptions): Device;
  listPorts(): Promise<PortInfo[]>;
  renderAscii(frame: Frame, options?: AsciiOptions): string;
  version: string;
};
export default Shroom;
