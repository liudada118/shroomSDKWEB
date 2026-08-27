/**
 * 产出两样东西：
 *   1. sdk/web/shroom.bundle.js  —— core/ + web/ 拼成的「经典脚本」，挂 window.Shroom
 *   2. sdk/web/index.html        —— 由 index.template.html 把上面那段**内联**进去
 *
 *   npm run build:sdk-bundle
 *
 * 为什么要这么绕：
 *   - 浏览器不允许 file:// 页面加载 ES 模块（<script type="module"> 被 CORS 拦掉），
 *     但普通脚本是放行的。所以示例页面不能用 import，得有个 bundle。
 *   - 而且不能用 <script src="./shroom.bundle.js">：在 zip 里直接双击 html 时，
 *     Windows 资源管理器只把那一个文件解到临时目录，同目录的兄弟文件一个都没有。
 *     内联进去就彻底没有「依赖同目录文件」这回事了，单个 html 拷到哪都能跑。
 *
 * 注意：串口该连不上还是连不上 —— navigator.serial 在规范里标了 SecureContext，
 * 白名单只有 https 和 localhost，file:// 不在其中。那部分只能靠 start-demo.bat。
 *
 * 这里没做真正的打包器，只是按依赖顺序拼接 + 去掉 import/export。
 * 前提是 sdk 里全是顶层具名导出、没有循环依赖 —— 下面会校验，不满足就报错退出。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SDK = join(ROOT, 'sdk');
const OUT = join(SDK, 'web', 'shroom.bundle.js');
const PAGE_TEMPLATE = join(SDK, 'web', 'index.template.html');
const PAGE_OUT = join(SDK, 'web', 'index.html');
const PLACEHOLDER = '<!--@INLINE_BUNDLE@-->';

// 依赖在前，被依赖的先出现。改动 sdk 结构时记得同步这张表。
const FILES = [
  'core/colormap.js',
  'core/framer.js',
  'core/frame.js',
  'core/device.js',
  'core/mock.js',
  'web/heatmap.js',
  'web/serial.js',
];

// 顶层 import 整行删掉；export 关键字去掉，声明本身留下。
const IMPORT_LINE = /^import\s[^;]*;\s*$/;
const EXPORT_DECL = /^export\s+(?=(?:async\s+)?function\b|const\b|let\b|var\b|class\b)/;
// 这两种形态拼接不了，遇到就直接报错，免得悄悄少打包一个符号
const EXPORT_OTHER = /^export\s/;

function strip(source, file) {
  return source
    .split('\n')
    .map((line) => {
      if (IMPORT_LINE.test(line)) return null;
      if (EXPORT_DECL.test(line)) return line.replace(EXPORT_DECL, '');
      if (EXPORT_OTHER.test(line)) {
        throw new Error(
          `${file} 里有拼接不了的导出写法，请改成顶层具名声明：\n    ${line.trim()}`
        );
      }
      return line;
    })
    .filter((line) => line !== null)
    .join('\n')
    .trim();
}

const pkg = JSON.parse(await readFile(join(SDK, 'package.json'), 'utf8'));

const parts = [];
for (const file of FILES) {
  const source = await readFile(join(SDK, file), 'utf8');
  parts.push(`// ---------- ${file} ----------\n${strip(source, file)}`);
}

const body = parts.join('\n\n');

// 注意：这段注释里不要出现 script 标签的字面量 —— 它会被原样内联进 index.html
const bundle = `/**
 * Shroom SDK ${pkg.version} —— 单文件版（自动生成，别手改）
 *
 * 由 scripts/build-sdk-bundle.mjs 从 core/ + web/ 拼出来，内容和模块版完全一致。
 * 它是「经典脚本」而不是模块，所以用普通的 script 标签引进去就行，file:// 下也能加载，
 * 加载完全局多一个 Shroom 对象。
 *
 * 正经项目里请直接 import 模块版：import { Shroom } from './web/index.js'
 */
(function (global) {
  'use strict';

${body
  .split('\n')
  .map((line) => (line ? `  ${line}` : ''))
  .join('\n')}

  // ---------- 对外入口 ----------
  var Shroom = {
    connect: connectSerial,
    mock: createMockDevice,
    createHeatmap: createHeatmap,
    isSupported: isSerialSupported,
    version: ${JSON.stringify(pkg.version)},
    // 想自己接数据源（WebSocket、蓝牙、录制回放）就用这几个
    createFramer: createFramer,
    decodeFrame: decodeFrame,
    resolveShape: resolveShape,
    getColormap: getColormap,
    DEFAULT_DELIMITER: DEFAULT_DELIMITER,
  };

  global.Shroom = Shroom;
})(typeof globalThis !== 'undefined' ? globalThis : window);
`;

await writeFile(OUT, bundle);
console.log(`  已生成 sdk/web/shroom.bundle.js（${FILES.length} 个模块，${bundle.length} 字节）`);

// ---------- 把 bundle 内联进示例页面 ----------
const template = await readFile(PAGE_TEMPLATE, 'utf8');
if (!template.includes(PLACEHOLDER)) {
  throw new Error(`index.template.html 里找不到占位符 ${PLACEHOLDER}`);
}

// 闭合标签出现在内联脚本里会提前结束 script，哪怕是在注释或字符串里也一样
const inlineSafe = bundle.replace(/<\/(script)/gi, '<\\/$1');
if (/<\/script/i.test(inlineSafe)) throw new Error('内联脚本里还有没转义的 script 闭合标签');

const INDENT = '    ';
const page = template.replace(
  PLACEHOLDER,
  [
    '<!--',
    '  下面这段是 SDK 本体，由 scripts/build-sdk-bundle.mjs 内联进来的，别手改。',
    '  内联而不是外链一个 .js，是为了让这个 html 单独拷到任何地方都能跑 ——',
    '  在 zip 里直接双击时，资源管理器只解出这一个文件，同目录的兄弟文件拿不到。',
    "  写自己的项目请用模块版：import { Shroom } from './index.js'",
    '-->',
    '<script>',
    inlineSafe.trim(),
    '</script>',
  ]
    .join('\n')
    .split('\n')
    .map((line, i) => (i === 0 || !line ? line : INDENT + line))
    .join('\n')
);

await writeFile(PAGE_OUT, page);
console.log(`  已生成 sdk/web/index.html（自包含，${page.length} 字节）`);
