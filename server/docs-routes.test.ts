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
  for (const slug of ['backend', 'frontend-communication', 'rendering', 'python', 'node', 'serial', 'storage', 'backend-api']) {
    assert.ok(catalog.some((doc) => doc.slug === slug), slug);
    assert.ok(getDoc(slug), `${slug} must remain generated`);
  }
  assert.equal(catalog.filter((doc) => doc.area === 'backend' && !doc.hidden).length, 1);
});

test('quick guide exposes the complete product, transport, view, recording and download path', () => {
  const quick = getDoc('quick-start')!;
  assert.ok(quick);
  for (const method of ['connectGlove', 'connectHandPad', 'serveDevice', 'connectStream', 'createProductView',
    'startRecording', 'stopRecording', 'downloadRecording', 'listRecordings', 'getRecordingStatus']) {
    assert.ok(quick.raw.includes(`${method}(`), method);
  }
  for (const id of ['demo', 'device', 'view', 'record', 'download', 'troubleshooting']) {
    assert.ok(quick.toc.some((heading) => heading.id === id), id);
    assert.ok(sectionCatalog.some((section) => section.href === `/docs/quick-start#${id}`));
  }
  assert.match(quick.raw, /node node\/quick-demo\.js --mock --port 19999/);
  assert.match(quick.raw, /node start\.mjs/);
  assert.match(quick.raw, /web\/quick-start\.html/);
  assert.match(quick.raw, /一次会话对应一个标签/);
  assert.match(quick.raw, /Python 当前提供基础串口/);
  assert.match(quick.raw, /不是 3D/);
});

test('quick guide and product workspace share six unique ordered chapters before optional extensions', async () => {
  const quick = getDoc('quick-start')!;
  const catalog = await definitions();
  const chapters = catalog.find((doc) => doc.slug === 'quick-start')!.chapters!;
  assert.equal(chapters.length, 6);
  assert.deepEqual(chapters, workspaceChapters, 'navigation metadata and interactive chapter labels must agree');
  assert.deepEqual(quick.toc.filter((heading) => heading.level === 2).slice(0, 6)
    .map(({ id, text }) => ({ id, label: text })), chapters);
  for (const chapter of chapters) {
    assert.equal(quick.toc.filter((heading) => heading.id === chapter.id).length, 1, chapter.id);
    assert.equal(quick.raw.split(`{#${chapter.id}}`).length - 1, 1, 'anchors must be explicit and unique');
    assert.ok(sectionCatalog.some((section) => section.href === `/docs/quick-start#${chapter.id}`));
    const start = quick.raw.indexOf(`{#${chapter.id}}`);
    const end = quick.raw.indexOf('\n## ', start);
    const body = quick.raw.slice(start, end);
    assert.match(body, /\*\*前置\*\*/, `${chapter.id}: prerequisites`);
    assert.match(body, /\*\*操作[^\n]*\*\*/, `${chapter.id}: action`);
    assert.match(body, /\*\*完成标志\*\*/, `${chapter.id}: completion criteria`);
  }
  const extensionIndex = quick.toc.findIndex((heading) => heading.id === 'extensions');
  assert.ok(extensionIndex >= 6);
  for (const id of ['device', 'demo', 'view', 'record', 'download', 'troubleshooting']) {
    assert.ok(quick.toc.findIndex((heading) => heading.id === id) > extensionIndex, `${id} remains an optional reference`);
  }
  assert.match(quick.raw, /node start\.mjs --no-open/);
  assert.match(quick.raw, /glove-left-example\.mjs COM3/);
  assert.match(quick.raw, /activateLicenseFromEnv\(\)/);
  assert.match(quick.raw, /CH341SER\.EXE/);
  assert.match(quick.raw, /CH34xVCPDriver\.zip/);
});

test('custom guide links to references and distinguishes the legacy backend from the standalone service', () => {
  const custom = getDoc('custom')!;
  assert.ok(custom);
  for (const slug of ['backend', 'frontend-communication', 'rendering', 'storage', 'quick-start']) {
    assert.ok(custom.html.includes(`href="/docs/${slug}`), slug);
  }
  assert.match(custom.raw, /Node\.js \/ Python/);
  assert.match(custom.raw, /不是同一协议/);
  assert.match(custom.raw, /BackendSdkClient\.startCollection\(\)/);
  assert.match(custom.raw, /Python 目前只有基础串口/);
});

test('quick guide groups capture start and stop beneath one chapter and downloads separately', () => {
  const quick = getDoc('quick-start')!;
  const recordIndex = quick.toc.findIndex((heading) => heading.id === 'record');
  const downloadIndex = quick.toc.findIndex((heading) => heading.id === 'download');
  assert.ok(recordIndex >= 0 && downloadIndex > recordIndex);
  assert.equal(quick.toc[recordIndex].level, 2);
  assert.match(quick.toc[recordIndex].text, /数据采集/);
  const controls = quick.toc.slice(recordIndex + 1, downloadIndex);
  assert.equal(controls.length, 2);
  assert.ok(controls.every((heading) => heading.level === 3));
  assert.match(controls[0].text, /开始/);
  assert.match(controls[1].text, /停止/);
  assert.equal(quick.toc[downloadIndex].level, 2);
  assert.doesNotMatch(quick.toc[downloadIndex].text, /停止/);
  const captureStart = quick.raw.search(/^## [^\n]+\{#record\}$/m);
  const downloadStart = quick.raw.search(/^## [^\n]+\{#download\}$/m);
  const nextChapter = quick.raw.indexOf('\n## ', downloadStart);
  assert.ok(captureStart >= 0 && downloadStart > captureStart && nextChapter > downloadStart);
  const capture = quick.raw.slice(captureStart, downloadStart);
  const download = quick.raw.slice(downloadStart, nextChapter);
  assert.match(capture, /await stream\.startRecording\(/);
  assert.match(capture, /await stream\.stopRecording\(/);
  assert.doesNotMatch(download, /await stream\.stopRecording\(/);
  assert.match(download, /stream\.downloadRecording\(recordingId,/);
});

test('download guides require an explicit recording ID and explain its origin and failure cases', () => {
  for (const slug of ['quick-start', 'storage']) {
    const raw = getDoc(slug)!.raw;
    assert.match(raw, /采集记录 ID/);
    assert.match(raw, /downloadRecording\(recordingId,/);
    assert.match(raw, /不会默认下载最近一次记录/);
    assert.match(raw, /404/);
    assert.match(raw, /409/);
  }
  assert.match(getDoc('quick-start')!.raw, /session\.id/);
  assert.match(getDoc('quick-start')!.raw, /startRecording\(\)/);
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
  assert.match(detail, /return <ProductWorkspace raw=\{doc\.raw\}/);
  assert.match(detail, /doc\.html\.slice\(extensionsStart\)/);
  const siteNavigation = await readFile(new URL('../app/SiteNavigation.tsx', import.meta.url), 'utf8');
  assert.match(siteNavigation, /pathname === '\/docs\/quick-start' \? <ProductWorkspaceNavigation/);
  const productNavigation = await readFile(new URL('../app/docs/ProductWorkspaceNavigation.tsx', import.meta.url), 'utf8');
  for (const task of ['start', 'data', 'debug', 'downloads']) assert.ok(productNavigation.includes(`tab: '${task}'`));
  assert.doesNotMatch(productNavigation, /workspaceChapters\.map/);
  assert.match(productNavigation, /href="#extensions"/);
  assert.ok(getDoc('custom')!.toc.some((heading) => heading.id === 'guides'));
});

test('new workflow sections do not displace existing readme or storage anchors', () => {
  const readme = getDoc('readme')!;
  assert.equal(readme.toc.find((heading) => heading.id === 's1')?.text, '30 秒跑起来');
  assert.equal(readme.toc.find((heading) => heading.id === 's14')?.text, '拿去问 AI');
  const storage = getDoc('storage')!;
  assert.equal(storage.toc.find((heading) => heading.id === 's1')?.text, '选择保存内容');
  assert.equal(storage.toc.find((heading) => heading.id === 's5')?.text, '前端职责');
});
