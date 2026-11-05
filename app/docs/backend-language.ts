export type BackendLanguage = 'node';

export const BACKEND_LANGUAGE_EVENT = 'shroom:backend-language-change';

export function backendLanguageFromSearch(search: string): BackendLanguage {
  // 旧语言参数不再改变官网展示；底层 SDK 的语言能力不受影响。
  void search;
  return 'node';
}

/** Select the same language blocks as the article, keeping shared Markdown intact. */
export function backendMarkdownForLanguage(raw: string, language: BackendLanguage) {
  return raw.replace(/<div data-sdk-language="(node|python)">\s*\n([\s\S]*?)\n<\/div>/g,
    (_block, blockLanguage: string, content: string) => blockLanguage === language ? content.trim() : '')
    .replace(/\s+\{#[a-z][a-z0-9-]*\}/g, '')
    .replace(/\n{3,}/g, '\n\n').trim();
}
