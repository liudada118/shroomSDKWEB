import { sectionCatalog } from './docs/catalog.generated.ts';

export { sectionCatalog };
export type DocsPageId = typeof sectionCatalog[number]['page'];
export type DocSectionRef = { anchor: string; label: string; href: string; page: DocsPageId };

export function isDocsPageId(page: unknown): page is DocsPageId {
  return sectionCatalog.some((section) => section.page === page);
}

export function findSection(anchor: string) {
  const key = anchor.trim().replace(/^#/, '').toLowerCase();
  return sectionCatalog.find((entry) => entry.anchor.toLowerCase() === key);
}

export function rankDocSections(text: string, limit = 3) {
  const haystack = text.toLowerCase();
  return sectionCatalog.map((entry, order) => ({
    entry, order,
    score: [entry.label, ...entry.keywords.split(/\s+/)].reduce((score, word) =>
      score + (word.length >= 2 && haystack.includes(word.toLowerCase()) ? 1 : 0), 0),
  })).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit).map(({ entry }) => entry);
}
