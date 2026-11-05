import test from 'node:test';
import assert from 'node:assert/strict';
import { currentDocHeading, groupDocOutline } from '../app/docs/doc-position.ts';
import { backendLanguageFromSearch } from '../app/docs/backend-language.ts';
import { getDoc } from '../app/docs/generated.ts';

test('document navigation stays empty before the first section', () => {
  assert.equal(currentDocHeading([{ id: 'serial', top: 240 }]), '');
  assert.equal(currentDocHeading([]), '');
});

test('the current section follows actual heading positions, not clicks or source order', () => {
  const headings = [{ id: 'serial', top: -800 }, { id: 'connect', top: 100 }, { id: 'communication', top: 700 }];
  assert.equal(currentDocHeading(headings), 'connect');
  assert.equal(currentDocHeading([...headings].reverse()), 'connect');
  assert.equal(currentDocHeading(headings, false, 96), 'serial');
});

test('the final visible section is active at the end even when it cannot reach the header', () => {
  assert.equal(currentDocHeading([{ id: 'communication', top: -600 }, { id: 'storage', top: 280 }], true), 'storage');
  assert.equal(currentDocHeading([], true), '');
});

test('the left outline groups API functions under their chapters and keeps language isolation', () => {
  const backend = getDoc('backend')!;
  for (const language of ['node'] as const) {
    const groups = groupDocOutline(backend.toc, language);
    const items = groups.flatMap((group) => [group.heading, ...group.children]);
    assert.deepEqual(items, backend.toc.filter((item) => !item.language || item.language === language));
    const serial = groups.find((group) => group.heading.id === 'serial')!;
    assert.ok(serial.children.some((item) => item.id === `${language}-connect`));
    assert.ok(serial.children.every((item) => item.level === 3));
    assert.equal(serial.children.find((item) => item.id === `${language}-connect`)?.description, '连接串口设备');
  }
});

test('every reference keeps all its headings in the left outline', () => {
  for (const slug of ['frontend-communication', 'rendering', 'backend-api', 'node', 'readme']) {
    const doc = getDoc(slug)!;
    const ids = groupDocOutline(doc.toc, 'node').flatMap((group) => [group.heading.id, ...group.children.map((item) => item.id)]);
    assert.deepEqual(ids, doc.toc.map((item) => item.id));
  }
});

test('sidebar language follows supported URL parameters and safely defaults to Node.js', () => {
  for (const search of ['', '?language=node', '?language=python', '?language=unknown', '?other=python']) {
    assert.equal(backendLanguageFromSearch(search), 'node');
  }
});
