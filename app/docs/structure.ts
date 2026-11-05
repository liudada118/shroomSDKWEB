import catalog from '../../sdk/docs/catalog.json';

export type DocArea = 'backend' | 'frontend' | 'guides';
export type DocGroup = 'languages' | 'features' | 'guides';
export type DocRoute = 'quick' | 'custom' | 'guides';
export type DocDefinition = {
  slug: string;
  file: string;
  label: string;
  navLabel: string;
  summary: string;
  forAi: boolean;
  area: DocArea;
  group: DocGroup;
  route?: DocRoute;
  hidden?: boolean;
  apiReference?: boolean;
  chapters?: { id: string; label: string }[];
  tocDescriptions?: Record<string, string>;
};

// Only navigation metadata enters client components; article HTML stays on the server.
export const docDefinitions: DocDefinition[] = (catalog as DocDefinition[]).filter(doc => doc.slug !== 'python').map(doc =>
  doc.slug === 'ai-context' ? { ...doc, navLabel: 'AI 接入参考' }
    : doc.slug === 'backend' ? { ...doc, summary: '查阅 Node.js 产品连接、模拟、解析、后端通讯与存储 API 的参数和示例。' } : doc);
export const docAreas: { id: DocArea; label: string; description: string }[] = [
  { id: 'backend', label: '后端', description: '查阅 Node.js 后端文档；串口、通讯、存储按章节展开。' },
  { id: 'frontend', label: '前端', description: '连接网页数据源，把实时数据绘制到界面。' },
  { id: 'guides', label: '辅助指南', description: '使用 SDK Skill、AI 开发指南和 API 排错参考。' },
];

export const docRoutes: { id: DocRoute; label: string; description: string }[] = [
  { id: 'quick', label: '快速接入文档', description: '按产品直接取数并接入自有程序；鞋垫与人体全身从 SDK 0.3.0 起支持，再按需接入 WS、录制与下载。' },
  { id: 'custom', label: '基础文档', description: '进入独立页面，按需查阅串口、解析、通讯、存储和渲染 API，用于新设备和自定义开发。' },
  { id: 'guides', label: '辅助指南', description: '使用 SDK Skill、AI 开发指南和 API 排错参考。' },
];

/** Resolve the learning route without changing existing document areas or URLs. */
export function routeFor(doc: DocDefinition): DocRoute {
  return doc.route ?? (doc.area === 'guides' ? 'guides' : 'custom');
}

/** List visible articles in one learning route, retaining catalog order. */
export function docsForRoute(route: DocRoute) {
  return docDefinitions.filter((doc) => !doc.hidden && routeFor(doc) === route);
}

export function docsFor(area: DocArea, group?: DocGroup) {
  return docDefinitions.filter((doc) => !doc.hidden && doc.area === area && (!group || doc.group === group));
}

export function getDocDefinition(slug: string) {
  return docDefinitions.find((doc) => doc.slug === slug);
}

export function docBreadcrumbs(slug: string) {
  const doc = getDocDefinition(slug);
  if (!doc) return [];
  const route = routeFor(doc);
  if (route === 'quick' || slug === 'custom') return [];
  if (route === 'custom') return [{ label: '基础文档', href: '/docs/custom' }];
  return [{ label: '辅助指南', href: '/docs/custom#guides' }];
}
