import { Shroom as WebShroom, type WebConnectOptions } from 'shroom-sdk';
import { Shroom as WebSubpath } from 'shroom-sdk/web';
import { Shroom as NodeShroom, type NodeConnectOptions } from 'shroom-sdk/node';
import { decodeFrame } from 'shroom-sdk/core';
import { MemoryCaptureStore, ShroomSensorSDK } from 'shroom-sdk/backend';

const webOptions: WebConnectOptions = { baudRate: 1_000_000 };
const nodeOptions: NodeConnectOptions = { path: 'COM3', baudRate: 1_000_000 };
const supported: boolean = WebShroom.isSupported();
const subpathSupported: boolean = WebSubpath.isSupported();
const ports: Promise<unknown[]> = NodeShroom.listPorts();
const frame = decodeFrame(Uint8Array.from([1, 2, 3, 4]));
const sdk = new ShroomSensorSDK({ store: new MemoryCaptureStore() });
const closed: Promise<void> = sdk.close();

void [webOptions, nodeOptions, supported, subpathSupported, ports, frame, closed];
