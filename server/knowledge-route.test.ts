import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/knowledge/route.ts';
import { docPages } from '../app/docs/generated.ts';
import { sectionCatalog, findSection } from '../app/docs-data.ts';

const original = { key: process.env.ZAI_API_KEY, id: process.env.ZHIPU_KNOWLEDGE_ID };
test.afterEach(() => {
  if (original.key === undefined) delete process.env.ZAI_API_KEY; else process.env.ZAI_API_KEY = original.key;
  if (original.id === undefined) delete process.env.ZHIPU_KNOWLEDGE_ID; else process.env.ZHIPU_KNOWLEDGE_ID = original.id;
});

test('unconfigured service returns an actionable error without calling a provider', async () => {
  delete process.env.ZAI_API_KEY;
  delete process.env.ZHIPU_KNOWLEDGE_ID;
  const response = await POST(new Request('http://localhost/api/knowledge', { method: 'POST', body: JSON.stringify({ question: 'Python SDK' }) }));
  assert.equal(response.status, 503);
  const payload = await response.json() as { error: { code: string } };
  assert.equal(payload.error.code, 'KNOWLEDGE_NOT_CONFIGURED');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('cross-origin requests are rejected', async () => {
  const response = await POST(new Request('http://localhost/api/knowledge', { method: 'POST', headers: { Origin: 'https://example.com' }, body: '{}' }));
  assert.equal(response.status, 403);
});

test('body limits work without a Content-Length header', async () => {
  process.env.ZAI_API_KEY = 'test-only';
  process.env.ZHIPU_KNOWLEDGE_ID = 'test-only';
  const response = await POST(new Request('http://localhost/api/knowledge', { method: 'POST', body: JSON.stringify({ question: 'a'.repeat(70_000) }) }));
  assert.equal(response.status, 413);
});

test('invalid JSON and missing questions do not reach the provider', async () => {
  process.env.ZAI_API_KEY = 'test-only';
  process.env.ZHIPU_KNOWLEDGE_ID = 'test-only';
  for (const body of ['{bad', '{}']) {
    const response = await POST(new Request('http://localhost/api/knowledge', { method: 'POST', body }));
    assert.equal(response.status, 400);
  }
});

test('every AI section resolves to a real current document heading', () => {
  assert.equal(new Set(sectionCatalog.map((entry) => entry.anchor)).size, sectionCatalog.length);
  for (const section of sectionCatalog) {
    const doc = docPages.find((page) => page.slug === section.page);
    const hash = section.href.split('#')[1];
    assert.ok(doc?.toc.some((heading) => heading.id === hash));
    assert.equal(findSection(section.anchor)?.href, section.href);
  }
});
