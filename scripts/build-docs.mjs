/**
 * 把 sdk/ 里的三份 Markdown 预渲染成 app/docs/generated.ts。
 *
 *   npm run build:docs
 *
 * 为什么是「构建期生成」而不是运行时读文件：
 *   站点可能被部署成静态产物或跑在 Worker 上，两种环境都没有 node:fs。
 *   把 HTML 在构建时算好、编译进 bundle，部署到哪都不会因为读不到文件而 500。
 *
 * 顺带把原始 Markdown 也带上：文档站上「复制给 AI」按钮要发的是原文，不是渲染后的 HTML。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SDK = join(ROOT, 'sdk');
const OUT = join(ROOT, 'app', 'docs', 'generated.ts');

// slug 是 URL 的一部分，必须是 ASCII —— 文件名有中文的那份尤其不能直接拿来用
const DOCS = [
  {
    slug: 'ai-context',
    file: 'AI-CONTEXT.md',
    label: '给 AI 的上下文',
    summary: '把这份整个发给 AI，它就掌握了 SDK 的全部能力边界和正确用法，不必再翻源码。',
    forAi: true,
  },
  {
    slug: 'ai-guide',
    file: '怎么用AI开发.md',
    label: '怎么用 AI 来开发',
    summary: '写给不写代码的人：怎么把 SDK 交给 AI，怎么描述需求，出问题了怎么跟它说。',
    forAi: false,
  },
  {
    slug: 'readme',
    file: 'README.md',
    label: 'SDK 说明与排错',
    summary: 'SDK 完整说明、API 一览和排错对照表。连不上设备时先查这份。',
    forAi: false,
  },
];

/** 取第一个 # 标题当页面标题，并把它从正文里去掉（页面自己会渲染标题） */
function splitTitle(markdown) {
  const match = markdown.match(/^#\s+(.+?)\s*$/m);
  if (!match) return { title: null, body: markdown };
  return { title: match[1], body: markdown.replace(match[0], '') };
}

/**
 * 给 h2 / h3 补 id，同时收集目录。
 *
 * 用序号而不是标题文本生成 id：标题全是中文，转 slug 要么变成一串百分号编码，
 * 要么撞车（比如两个「注意」）。序号丑一点但唯一，而且不会因为改标题措辞就断链。
 */
function addAnchors(html) {
  const toc = [];
  let index = 0;
  const withIds = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_all, level, inner) => {
    const id = `s${(index += 1)}`;
    const text = inner.replace(/<[^>]+>/g, '').trim();
    toc.push({ id, text, level: Number(level) });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  return { html: withIds, toc };
}

const pages = [];
for (const doc of DOCS) {
  const source = await readFile(join(SDK, doc.file), 'utf8');
  const { title, body } = splitTitle(source);
  const { html, toc } = addAnchors(await marked.parse(body, { gfm: true, breaks: false }));
  pages.push({
    slug: doc.slug,
    label: doc.label,
    summary: doc.summary,
    forAi: doc.forAi,
    file: doc.file,
    title: title ?? doc.label,
    html,
    // 原文照带，给「复制给 AI」用
    raw: source,
    toc,
  });
  console.log(`  ${doc.file} → /docs/${doc.slug}（${toc.length} 个小节，${source.length} 字）`);
}

const banner = `// 由 scripts/build-docs.mjs 自动生成，请勿手改。
// 内容来源：${DOCS.map((d) => `sdk/${d.file}`).join('、')}
// 重新生成：npm run build:docs

export interface DocToc {
  id: string;
  text: string;
  level: number;
}

export interface DocPage {
  slug: string;
  label: string;
  summary: string;
  forAi: boolean;
  file: string;
  title: string;
  html: string;
  raw: string;
  toc: DocToc[];
}

export const docPages: DocPage[] = ${JSON.stringify(pages, null, 2)};

export function getDoc(slug: string): DocPage | undefined {
  return docPages.find((page) => page.slug === slug);
}
`;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, banner, 'utf8');
console.log(`已生成 app/docs/generated.ts（${pages.length} 篇，${banner.length} 字节）`);
