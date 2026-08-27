/**
 * 把 sdk/ 打包成 public/shroom-sdk.zip，供网站上的「获取 SDK」按钮直接下载。
 *
 *   npm run pack:sdk
 *
 * 自己实现 zip 是为了不引依赖、也不依赖系统上有没有 zip / PowerShell，
 * CI 上跑和本地跑结果一致。时间戳写死，所以内容不变时产物字节相同，
 * 不会每次打包都在 git 里产生 diff。
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'sdk');
const OUT = join(ROOT, 'public', 'shroom-sdk.zip');
const PREFIX = 'shroom-sdk/';
// index.template.html 是给构建脚本用的源文件，用户拿到的是渲染好的 index.html
const SKIP = new Set(['node_modules', '.git', '.DS_Store', 'index.template.html']);

// 固定为 2026-01-01 00:00:00 的 DOS 时间，保证产物可复现
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

async function main() {
  await stat(SRC).catch(() => {
    throw new Error(`找不到 ${SRC}`);
  });

  const files = (await walk(SRC)).sort(); // 排序保证顺序稳定
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const name = PREFIX + relative(SRC, file).split(sep).join('/');
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = await readFile(file);
    const deflated = deflateRawSync(raw, { level: 9 });
    // 压完反而更大的（比如小图片）就原样存
    const useDeflate = deflated.length < raw.length;
    const body = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x800, 6); // 文件名按 UTF-8 解释
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(0, 38); // external attributes
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  const zip = Buffer.concat([...locals, centralBuf, eocd]);
  await mkdir(join(ROOT, 'public'), { recursive: true });
  await writeFile(OUT, zip);

  console.log(`已打包 ${files.length} 个文件 → public/shroom-sdk.zip (${(zip.length / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
