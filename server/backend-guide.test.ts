import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { docPages, getDoc } from '../app/docs/generated.ts';
import { sectionCatalog } from '../app/docs/catalog.generated.ts';
import { backendLanguageFromSearch, backendMarkdownForLanguage } from '../app/docs/backend-language.ts';

const backend = getDoc('backend')!;

test('backend chapters share a single page with stable h2 anchors and nested h3 headings', async () => {
  const definitions = JSON.parse(await readFile(new URL('../sdk/docs/catalog.json', import.meta.url), 'utf8'));
  const visibleBackend = definitions.filter((doc: { area: string; hidden?: boolean }) => doc.area === 'backend' && !doc.hidden);
  assert.equal(visibleBackend.length, 1);
  assert.equal(visibleBackend[0].slug, 'backend');
  for (const chapter of visibleBackend[0].chapters) {
    assert.ok(backend.toc.some((item) => item.id === chapter.id && item.level === 2 && item.text === chapter.label));
    assert.ok(backend.html.includes(`<h2 id="${chapter.id}">${chapter.label}</h2>`));
    assert.ok(sectionCatalog.some((section) => section.href === `/docs/backend#${chapter.id}`));
  }
  for (const id of ['node-connect', 'backend-client', 'backend-queries']) {
    assert.ok(backend.toc.some((item) => item.id === id && item.level === 3));
  }
  assert.doesNotMatch(backend.html, /\{#[a-z-]+\}/);
});

test('copying backend Markdown selects Node.js examples and retains the shared chapters', () => {
  const raw = backendMarkdownForLanguage(backend.raw, 'node');
  assert.match(raw, /npm install/);
  assert.match(raw, /await Shroom\.connect/);
  assert.match(raw, /client\.connectRealtime/);
  assert.match(raw, /await writeFile/);
  assert.doesNotMatch(raw, /from shroom_sdk import|python -m pip|data-sdk-language|\{#[a-z-]+\}/);
  for (const title of ['串口', '通讯', '存储']) assert.ok(raw.includes(`## ${title}\n`));
});

test('public documents, copied Markdown and knowledge sections omit the hidden language', () => {
  assert.equal(backendLanguageFromSearch('?language=python'), 'node');
  assert.equal(getDoc('python'), undefined);
  for (const page of docPages) {
    assert.doesNotMatch(`${page.label}\n${page.summary}\n${page.raw}\n${page.html}`, /python|pyserial|shroom_sdk|pip install/i, page.slug);
  }
  assert.doesNotMatch(JSON.stringify(sectionCatalog), /python/i);
  assert.match(backend.raw, /\| `fullScale` \|/);
  assert.match(backend.raw, /\| `raw` \| `Uint8Array` \|/);
  assert.doesNotMatch(backend.raw, /full_scale|bytes_received|get_diagnostics/);
});

test('language blocks become complete Markdown HTML and existing reference routes remain available', () => {
  for (const language of ['node']) {
    const blocks = [...backend.html.matchAll(new RegExp(`<div data-sdk-language="${language}">([\\s\\S]*?)<\\/div>`, 'g'))];
    assert.equal(blocks.length, 4);
    assert.ok(blocks.every((block) => block[1].includes('<p>') || block[1].includes('<pre>')));
  }
  for (const slug of ['node', 'serial', 'storage', 'backend-api']) assert.ok(getDoc(slug));
  assert.ok(backend.html.includes('href="/docs/backend-api#request"'));
});

test('API headings and knowledge links follow the selected language', () => {
  for (const language of ['node'] as const) {
    const headings = backend.toc.filter((item) => item.language === language);
    assert.ok(headings.length > 10);
    for (const heading of headings) {
      assert.equal(heading.level, 3);
      assert.ok(sectionCatalog.some((section) => section.anchor === `backend--${heading.id}`
        && section.href === `/docs/backend?language=${language}#${heading.id}`));
    }
  }
  for (const id of ['serial', 'communication', 'storage', 'frame', 'diagnostics', 'storage-boundary']) {
    assert.equal(backend.toc.find((item) => item.id === id)?.language, undefined);
  }
  assert.equal(backend.toc.find((item) => item.id === 'node-connect')?.language, 'node');
  assert.equal(backend.toc.find((item) => item.id === 'python-connect'), undefined);
});

test('relative API links preserve anchors and every generated document anchor exists', () => {
  assert.ok(backend.html.includes('href="/docs/backend-api#request"'));
  for (const page of docPages) {
    for (const [, slug, anchor] of page.html.matchAll(/href="\/docs\/([a-z-]+)(?:\?[^"#]*)?#([^"\s]+)"/g)) {
      assert.ok(getDoc(slug)?.toc.some((item) => item.id === anchor), `${page.slug} links to missing ${slug}#${anchor}`);
    }
  }
});

test('BackendSdkClient reference covers every declared public method', async () => {
  const declarations = await readFile(new URL('../sdk/src/backend/client.d.ts', import.meta.url), 'utf8');
  const reference = getDoc('backend-api')!;
  const methods = [...declarations.matchAll(/^  (\w+)(?:<[^\n]+>)?\(/gm)]
    .map((match) => match[1]).filter((method) => method !== 'constructor');
  assert.ok(methods.length >= 25);
  for (const method of methods) {
    assert.ok(reference.toc.some((heading) => heading.text.includes(`${method}(`)), `Missing ${method} API heading`);
  }
  assert.match(reference.raw, /返回值/);
  assert.match(reference.raw, /默认值/);
  assert.match(reference.raw, /注意事项/);
});

test('serial and rendering references expose the actual core capabilities', () => {
  const node = backendMarkdownForLanguage(backend.raw, 'node');
  for (const method of ['Shroom.listPorts', 'Shroom.connect', 'Shroom.mock', 'device.onFrame', 'device.close',
    'createFramer', 'framer.push', 'framer.reset', 'decodeFrame', 'resolveShape', 'getLayout', 'listLayouts',
    'listProducts', 'getProduct', 'Shroom.renderAscii']) assert.ok(node.includes(`${method}(`), method);
  const rendering = getDoc('rendering')!;
  for (const method of ['createHeatmap', 'heatmap.render', 'heatmap.setOptions', 'heatmap.resize', 'heatmap.clear', 'getColormap']) {
    assert.ok(rendering.toc.some((heading) => heading.text.includes(`${method}(`)), method);
  }
});

test('API contents explain English function headings in Chinese without renaming the APIs', () => {
  for (const slug of ['backend', 'backend-api', 'frontend-communication', 'rendering']) {
    const page = getDoc(slug)!;
    const englishHeadings = page.toc.filter((heading) => !/[\u3400-\u9fff]/u.test(heading.text));
    assert.ok(englishHeadings.length > 0);
    for (const heading of englishHeadings) {
      assert.match(heading.description ?? '', /[\u3400-\u9fff]/u, `${slug}#${heading.id} needs a Chinese function description`);
      assert.ok(page.html.includes(`id="${heading.id}"`));
      assert.ok(sectionCatalog.find((section) => section.anchor === `${slug}--${heading.id}`)?.keywords.includes(heading.description!));
    }
  }
  const nodeConnect = backend.toc.find((heading) => heading.id === 'node-connect')!;
  assert.equal(nodeConnect.description, '连接串口设备');
  assert.equal(nodeConnect.text, 'Shroom.connect(options)');
  assert.equal(nodeConnect.language, 'node');
  assert.equal(backend.toc.find((heading) => heading.id === 'python-connect'), undefined);
  assert.equal(backend.toc.find((heading) => heading.id === 'serial')?.description, undefined);
});
