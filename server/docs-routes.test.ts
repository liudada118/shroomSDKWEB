import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDoc } from '../app/docs/generated.ts';
import { sectionCatalog } from '../app/docs/catalog.generated.ts';
import { workspaceChapters } from '../app/docs/product-workspace-model.ts';

/** Read the source catalog so route tests also detect accidental metadata regressions. */
async function definitions() {
  return JSON.parse(await readFile(new URL('../sdk/docs/catalog.json', import.meta.url), 'utf8')) as Array<{
    slug: string; area: string; route?: string; hidden?: boolean;
    chapters?: Array<{ id: string; label: string }>;
  }>;
}

test('workflow and custom routes exist without replacing existing reference URLs', async () => {
  const catalog = await definitions();
  assert.equal(catalog.find((doc) => doc.slug === 'quick-start')?.route, 'quick');
  assert.equal(catalog.find((doc) => doc.slug === 'custom')?.route, 'custom');
  for (const slug of ['backend', 'frontend-communication', 'rendering', 'node', 'serial', 'storage', 'backend-api']) {
    assert.ok(catalog.some((doc) => doc.slug === slug), slug);
    assert.ok(getDoc(slug), `${slug} must remain generated`);
  }
  assert.equal(catalog.filter((doc) => doc.area === 'backend' && !doc.hidden).length, 1);
  assert.equal(getDoc('python'), undefined);
});

test('quick guide presents the requested five API steps and keeps the preparation outline consistent', async () => {
  const quick = getDoc('quick-start')!;
  const catalog = await definitions();
  const steps = ['flow-read', 'flow-ws', 'flow-start', 'flow-stop', 'flow-download'];
  assert.deepEqual(quick.toc.filter(heading => steps.includes(heading.id)).map(heading => heading.id), steps);
  for (const method of ['readProduct', 'createWS', 'startRecording', 'stopRecording', 'downloadRecording']) {
    assert.ok(quick.raw.includes(`${method}(`), method);
  }
  assert.match(quick.raw, /const recording = await stopRecording\(stream\)/);
  assert.match(quick.raw, /downloadRecording\(stream,/);
  assert.doesNotMatch(quick.raw, /<!doctype html|node node\/quick-demo|glove-left-example\.mjs/);
  const chapters = catalog.find(doc => doc.slug === 'quick-start')!.chapters!;
  assert.deepEqual(chapters, workspaceChapters);
  assert.deepEqual(quick.toc.filter(heading => chapters.some(chapter => chapter.id === heading.id))
    .map(({ id, text }) => ({ id, label: text })), chapters);
  for (const id of [...steps, ...chapters.map(chapter => chapter.id), 'device', 'demo', 'view', 'record', 'download', 'troubleshooting']) {
    assert.equal(quick.toc.filter(heading => heading.id === id).length, 1, id);
    assert.ok(sectionCatalog.some(section => section.href === `/docs/quick-start#${id}`), id);
  }
  assert.match(quick.raw, /CH341SER\.EXE/);
  assert.match(quick.raw, /CH34xVCPDriver\.zip/);
  assert.doesNotMatch(quick.raw, /Python/i);
});

test('custom guide links to references and distinguishes the legacy backend from the standalone service', () => {
  const custom = getDoc('custom')!;
  assert.ok(custom);
  for (const slug of ['backend', 'frontend-communication', 'rendering', 'storage', 'quick-start']) {
    assert.ok(custom.html.includes(`href="/docs/${slug}`), slug);
  }
  assert.match(custom.raw, /集中展示 Node\.js 示例/);
  assert.match(custom.raw, /(?:不是同一协议|使用不同协议)/);
  assert.match(custom.raw, /BackendSdkClient\.startCollection\(\)/);
  assert.doesNotMatch(custom.raw, /Python/i);
});

test('stop and download remain distinct steps with the persisted ID managed by the SDK', () => {
  const quick = getDoc('quick-start')!;
  const stop = quick.raw.indexOf('{#flow-stop}');
  const download = quick.raw.indexOf('{#flow-download}');
  const after = quick.raw.indexOf('\n## ', download);
  assert.ok(stop > 0 && download > stop && after > download);
  assert.match(quick.raw.slice(stop, download), /const recording = await stopRecording\(stream\)/);
  assert.match(quick.raw.slice(download, after), /downloadRecording\(stream,/);
  assert.doesNotMatch(quick.raw.slice(download, after), /await (?:stream\.)?stopRecording\(/);
  assert.doesNotMatch(quick.raw.slice(download, after), /downloadRecording\(recording\.id,/, '下载按钮不依赖停止按钮的局部变量');
  const storage = getDoc('storage')!.raw;
  for (const content of [/采集记录 ID/, /downloadRecording\(recordingId,/, /404/, /409/]) assert.match(storage, content);
  assert.match(quick.raw, /session\.id/);
  assert.match(quick.raw.slice(download, after), /下载[^\r\n]*(?:不等于|不代表)文件已保存完成/);
});

test('product navigation exposes task references and basic references remain on their own pages', async () => {
  const navigation = await readFile(new URL('../app/docs/DocsNavigation.tsx', import.meta.url), 'utf8');
  const index = await readFile(new URL('../app/docs/page.tsx', import.meta.url), 'utf8');
  const structure = await readFile(new URL('../app/docs/structure.ts', import.meta.url), 'utf8');
  assert.match(navigation, /quickActive && <DocOutline[^>]+collapsible=\{false\}/);
  assert.match(navigation, /const showReferenceNavigation = pathname\.startsWith\('\/docs\/'\) && !quickActive/);
  assert.match(navigation, /showReferenceNavigation && <>\s*<ul>\{basicReferences\.map\(docLink\)\}/);
  assert.ok(navigation.indexOf('data-doc-route="quick"') < navigation.indexOf('data-doc-route="basic"'));
  assert.match(navigation, /href="\/docs\/custom"/);
  assert.match(navigation, /\/docs\/backend#/);
  assert.match(navigation, /aria-current/);
  assert.match(index, /href="\/docs\/quick-start(?:#guide-prepare)?"/);
  assert.match(index, /快速接入步骤/);
  assert.match(index, /id="backend"/);
  assert.match(index, /id="frontend"/);
  assert.match(index, /<DocEntry doc=\{basic\}/);
  assert.doesNotMatch(index, /docsForRoute\('custom'\)\.map/);
  assert.match(structure, /label: '基础文档', href: '\/docs\/custom'/);
  const outline = await readFile(new URL('../app/docs/DocOutline.tsx', import.meta.url), 'utf8');
  assert.match(outline, /group\.children\.length && collapsible \? <details open/);
  const detail = await readFile(new URL('../app/docs/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.match(detail, /doc\.slug === 'quick-start' \? <section aria-label="基础文档入口"/);
  assert.match(detail, /if \(doc\.slug === 'quick-start'\)/);
  assert.match(detail, /return <ProductWorkspace \/>/);
  const siteNavigation = await readFile(new URL('../app/SiteNavigation.tsx', import.meta.url), 'utf8');
  assert.match(siteNavigation, /pathname === '\/docs\/quick-start' \? <ProductWorkspaceNavigation/);
  const productNavigation = await readFile(new URL('../app/docs/ProductWorkspaceNavigation.tsx', import.meta.url), 'utf8');
  for (const task of ['start', 'guide', 'data', 'debug', 'downloads']) assert.ok(productNavigation.includes(`tab: '${task}'`));
  assert.doesNotMatch(productNavigation, /workspaceChapters\.map/);
  assert.match(productNavigation, /label: '调用流程'/);
  assert.match(productNavigation, /label: '接入准备'/);
  assert.doesNotMatch(productNavigation, /完整示例|href="#extensions"/);
  assert.ok(getDoc('custom')!.toc.some((heading) => heading.id === 'guides'));
});

test('new workflow sections do not displace existing readme or storage anchors', () => {
  const readme = getDoc('readme')!;
  assert.equal(readme.toc.find((heading) => heading.id === 's1')?.text, '五步调用概览');
  assert.equal(readme.toc.find((heading) => heading.id === 's14')?.text, '拿去问 AI');
  const storage = getDoc('storage')!;
  assert.equal(storage.toc.find((heading) => heading.id === 's1')?.text, '选择保存内容');
  assert.equal(storage.toc.find((heading) => heading.id === 's5')?.text, '前端职责');
});
