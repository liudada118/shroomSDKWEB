import type { DecodeOptions, Frame } from '../types.js';

export type { DecodeOptions, Frame } from '../types.js';
export function decodeFrame(payload: Uint8Array, options?: DecodeOptions): Frame;
export function resolveShape(points: number, options?: DecodeOptions): { rows: number; cols: number };
