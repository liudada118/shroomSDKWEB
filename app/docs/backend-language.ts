export type BackendLanguage = 'node' | 'python';

/** Select the same language blocks as the article, keeping shared Markdown intact. */
export function backendMarkdownForLanguage(raw: string, language: BackendLanguage) {
  return raw.replace(/<div data-sdk-language="(node|python)">\s*\n([\s\S]*?)\n<\/div>/g,
    (_block, blockLanguage: BackendLanguage, content: string) => blockLanguage === language ? content.trim() : '')
    .replace(/\s+\{#[a-z][a-z0-9-]*\}/g, '')
    .replace(/\n{3,}/g, '\n\n').trim();
}
