import catalog from '../../sdk/docs/catalog.json';

export type DocArea = 'backend' | 'frontend' | 'guides';
export type DocGroup = 'languages' | 'features' | 'guides';
export type DocDefinition = {
  slug: string;
  file: string;
  label: string;
  navLabel: string;
  summary: string;
  forAi: boolean;
  area: DocArea;
  group: DocGroup;
  hidden?: boolean;
  apiReference?: boolean;
  chapters?: { id: string; label: string }[];
  tocDescriptions?: Record<string, string>;
};

// Only navigation metadata enters client components; article HTML stays on the server.
export const docDefinitions = catalog as DocDefinition[];
export const docAreas: { id: DocArea; label: string; description: string }[] = [
  { id: 'backend', label: '后端', description: '一篇完整的后端文档，用下拉框切换 Node.js / Python；串口、通讯、存储按章节展开。' },
  { id: 'frontend', label: '前端', description: '连接网页数据源，把实时数据绘制到界面。' },
  { id: 'guides', label: '辅助指南', description: '使用 SDK Skill、AI 开发指南和 API 排错参考。' },
];

export function docsFor(area: DocArea, group?: DocGroup) {
  return docDefinitions.filter((doc) => !doc.hidden && doc.area === area && (!group || doc.group === group));
}

export function getDocDefinition(slug: string) {
  return docDefinitions.find((doc) => doc.slug === slug);
}

export function docBreadcrumbs(slug: string) {
  const doc = getDocDefinition(slug);
  if (!doc) return [];
  if (slug === 'backend') return [];
  const area = docAreas.find((item) => item.id === doc.area)!;
  return [{ label: area.label, href: doc.area === 'backend' ? '/docs/backend' : `/docs#${area.id}` }];
}
