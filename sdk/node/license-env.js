/** CLI examples keep keys in environment/file input and a stable installation ID outside the SDK tree. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { activateLicense } from '../core/license.js';

export async function activateLicenseFromEnv() {
  const key = process.env.SHROOM_LICENSE_KEY ?? (process.env.SHROOM_LICENSE_FILE
    ? await readFile(process.env.SHROOM_LICENSE_FILE, 'utf8') : '');
  if (!key.trim()) return activateLicense('');
  let deviceId = process.env.SHROOM_DEVICE_ID;
  if (!deviceId) {
    const directory = join(homedir(), '.shroom-sdk');
    const path = join(directory, 'device-id');
    await mkdir(directory, { recursive: true });
    try { deviceId = (await readFile(path, 'utf8')).trim(); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const candidate = randomBytes(32).toString('hex');
      try { await writeFile(path, candidate, { flag: 'wx', mode: 0o600 }); }
      catch (writeError) { if (writeError.code !== 'EEXIST') throw writeError; }
      deviceId = (await readFile(path, 'utf8')).trim();
    }
  }
  return activateLicense(key.trim(), {
    mode: process.env.SHROOM_LICENSE_MODE ?? 'online',
    ...(process.env.SHROOM_LICENSE_SERVER ? { serverUrl: process.env.SHROOM_LICENSE_SERVER } : {}), deviceId,
    ...(process.env.SHROOM_LICENSE_PUBLIC_KEY_FILE
      ? { publicKey: await readFile(process.env.SHROOM_LICENSE_PUBLIC_KEY_FILE, 'utf8') } : {}),
  });
}
