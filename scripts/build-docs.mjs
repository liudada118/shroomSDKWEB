/**
 * 把 sdk/ 中配置的 Markdown 预渲染成 app/docs/generated.ts。
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
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SDK = join(ROOT, 'sdk');
const OUT = join(ROOT, 'app', 'docs', 'generated.ts');

// slug 是 URL 的一部分，必须是 ASCII —— 文件名有中文的那份尤其不能直接拿来用
const DOCS = JSON.parse(await readFile(join(SDK, 'docs', 'catalog.json'), 'utf8'));
const slugs = new Set();
for (const doc of DOCS) {
  if (!/^[a-z][a-z0-9-]*$/.test(doc.slug) || slugs.has(doc.slug)) {
    throw new Error(`文档 slug 无效或重复：${doc.slug}`);
  }
  slugs.add(doc.slug);
  if (!['backend', 'frontend', 'guides'].includes(doc.area)
    || !['languages', 'features', 'guides'].includes(doc.group)) {
    throw new Error(`文档分类无效：${doc.slug}`);
  }
}

/** 取第一个 # 标题当页面标题，并把它从正文里去掉（页面自己会渲染标题） */
function splitTitle(markdown) {
  const match = markdown.match(/^#\s+(.+?)\s*$/m);
  if (!match) return { title: null, body: markdown };
  return { title: match[1], body: markdown.replace(match[0], '') };
}

/**
 * Markdown 里写的是 SDK 文件夹内部的相对链接（`[README.md](README.md)`），
 * 那在解压出来的 zip 里点得开，但放到网站上就是 404 —— 网站没有 /docs/README.md 这个地址。
 *
 * 所以：能对上文档页的，改成站内地址；对不上的（`index.d.ts` 这种源码文件）
 * 直接把链接拆掉，只留 `<code>` 文本 —— 宁可不可点，也不能让人点进 404。
 */
const FILE_TO_SLUG = new Map(DOCS.map((doc) => [doc.file, doc.slug]));

function rewriteLocalLinks(html, sourceFile) {
  return html.replace(/<a href="(?!https?:|\/|#)([^"]+)">([\s\S]*?)<\/a>/g, (_all, href, text) => {
    const sourcePath = href.split(/[#?]/)[0];
    const file = posix.normalize(posix.join(posix.dirname(sourceFile), decodeURIComponent(sourcePath)));
    const slug = FILE_TO_SLUG.get(file);
    return slug ? `<a href="/docs/${slug}${href.slice(sourcePath.length)}">${text}</a>` : `<code>${text}</code>`;
  });
}

/**
 * 给 h2 / h3 补 id，同时收集目录。
 *
 * 用序号而不是标题文本生成 id：标题全是中文，转 slug 要么变成一串百分号编码，
 * 要么撞车（比如两个「注意」）。序号丑一点但唯一，而且不会因为改标题措辞就断链。
 */
function addAnchors(html) {
  const toc = [];
  const ids = new Set();
  const languageBlocks = [...html.matchAll(/<div data-sdk-language="(node|python)">[\s\S]*?<\/div>/g)]
    .map((match) => ({ start: match.index, end: match.index + match[0].length, language: match[1] }));
  let index = 0;
  const withIds = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_all, level, inner, offset) => {
    // Optional {#id} suffix keeps primary chapter links stable when subheadings change.
    const explicit = inner.match(/\s+\{#([a-z][a-z0-9-]*)\}$/);
    index += 1;
    const id = explicit?.[1] ?? `s${index}`;
    const content = explicit ? inner.slice(0, explicit.index) : inner;
    if (ids.has(id)) throw new Error(`文档章节 id 重复：${id}`);
    ids.add(id);
    const text = content.replace(/<[^>]+>/g, '').trim();
    const language = languageBlocks.find((block) => offset >= block.start && offset < block.end)?.language;
    toc.push({ id, text, level: Number(level), ...(language ? { language } : {}) });
    return `<h${level} id="${id}">${content}</h${level}>`;
  });
  return { html: withIds, toc };
}

const pages = [];
for (const doc of DOCS) {
  const source = await readFile(join(SDK, doc.file), 'utf8');
  const { title, body } = splitTitle(source);
  const parsed = await marked.parse(body, { gfm: true, breaks: false });
  const { html, toc } = addAnchors(rewriteLocalLinks(parsed, doc.file));
  // Human-readable function descriptions only affect navigation, not API headings or anchors.
  for (const [id, description] of Object.entries(doc.tocDescriptions ?? {})) {
    const heading = toc.find((item) => item.id === id);
    if (!heading || typeof description !== 'string' || !description.trim()) {
      throw new Error(`目录功能描述无效：${doc.slug}#${id}`);
    }
    heading.description = description.trim();
  }
  for (const chapter of doc.chapters ?? []) {
    if (!toc.some((item) => item.id === chapter.id && item.level === 2 && item.text === chapter.label)) {
      throw new Error(`导航章节与正文不一致：${doc.slug}#${chapter.id}`);
    }
  }
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
  language?: 'node' | 'python';
  description?: string;
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
// 只把轻量章节目录交给问答客户端，避免携带整份 Markdown / HTML。
const catalog = pages.flatMap((page) => page.toc.map((section) => ({
  anchor: `${page.slug}--${section.id}`,
  label: section.text,
  href: `/docs/${page.slug}${section.language ? `?language=${section.language}` : ''}#${section.id}`,
  page: page.slug,
  description: page.label,
  keywords: `${page.slug} ${section.language ?? ''} ${section.text} ${section.description ?? ''}`.replace(/\s+/g, ' ').trim(),
})));
await writeFile(join(ROOT, 'app', 'docs', 'catalog.generated.ts'),
  `// 由 scripts/build-docs.mjs 自动生成，供问答章节定位使用。\nexport const sectionCatalog = ${JSON.stringify(catalog, null, 2)} as const;\n`, 'utf8');
console.log(`已生成 app/docs/generated.ts（${pages.length} 篇，${banner.length} 字节）`);
