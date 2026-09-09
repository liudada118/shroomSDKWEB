/**
 * 把打好的 Windows 上位机包接进网站。
 *
 *   node scripts/sync-desktop-release.mjs "C:/project/ShroomConstruction/shroom-monitor/dist/ShroomMonitor-0.1.0-win-x64.zip"
 *
 * 干三件事：算 SHA-256 和体积、把包拷进 public/downloads/、把版本信息写进
 * app/desktop-release.json。
 *
 * 为什么要有这个脚本：包有 100MB 上下，版本号、体积、校验值三样东西如果靠手填，
 * 迟早会和真正挂在服务器上的那个文件对不上 —— 那比不写校验值更糟，
 * 用户拿校验值一比对不上，会以为包被人掉了。所以只允许从文件本身算出来。
 *
 * 包本身不进 git（public/downloads/ 已在 .gitignore 里）。
 * 线上建议让 Nginx 直接 alias 到磁盘目录，别走 Node 进程发这么大的文件。
 * 只有 app/desktop-release.json 这个几百字节的元数据进仓库。
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_JSON = join(ROOT, 'app', 'desktop-release.json');
const OUT_DIR = join(ROOT, 'public', 'downloads');

// 更新日志从上位机仓库里读，不在这边重抄一遍
const NOTES_DIR = 'C:/project/ShroomConstruction/shroom-monitor/release-notes';

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

// 从「ShroomMonitor-0.1.0-win-x64.zip」里抠出 0.1.0
function versionFrom(name) {
  const m = name.match(/(\d+\.\d+\.\d+)/);
  if (!m) throw new Error(`文件名里看不出版本号：${name}`);
  return m[1];
}

async function readNotes(version) {
  try {
    const text = await readFile(join(NOTES_DIR, `${version}.md`), 'utf8');
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-'))
      .map((line) => line.replace(/^-\s*/, ''));
  } catch {
    // 没有更新日志不是错误，页面上那一块不显示就是了
    return [];
  }
}

async function main() {
  const src = process.argv[2];
  if (!src) throw new Error('用法：node scripts/sync-desktop-release.mjs <安装包路径>');

  const info = await stat(src).catch(() => {
    throw new Error(`找不到安装包：${src}`);
  });

  const original = basename(src);
  const version = versionFrom(original);
  // 扩展名跟着输入文件走：现在发的是免安装 zip，以后要是换成别的格式也不用再改脚本
  const ext = extname(original).toLowerCase() || '.zip';
  // 发布用的文件名去掉空格：带空格的 URL 要转义，粘到聊天窗口里容易被截断
  const fileName = `ShroomMonitor-${version}-win-x64${ext}`;

  console.log(`正在计算 SHA-256（${formatSize(info.size)}，要等一会）…`);
  const digest = await sha256(src);

  await mkdir(OUT_DIR, { recursive: true });
  await copyFile(src, join(OUT_DIR, fileName));

  const release = {
    version,
    fileName,
    // 用文件的 mtime 当发布日期，不用当前时间 —— 重跑一次脚本不该让发布日期跳到今天
    releaseDate: info.mtime.toISOString().slice(0, 10),
    size: info.size,
    sizeLabel: formatSize(info.size),
    sha256: digest,
    notes: await readNotes(version),
  };

  await writeFile(OUT_JSON, `${JSON.stringify(release, null, 2)}\n`);

  console.log(`已同步 Windows 上位机 ${version}`);
  console.log(`  public/downloads/${fileName}`);
  console.log(`  sha256 ${digest}`);
  if (release.notes.length === 0) {
    console.log(`  ⚠ 没找到 ${NOTES_DIR}/${version}.md，页面上不会显示更新内容`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
