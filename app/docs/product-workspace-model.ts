import { getCatalogProduct, productCatalog, type CatalogProduct, type ProductProtocol } from '../product-catalog.ts';

export type WorkspaceProduct = CatalogProduct['id'];
export type WorkspaceProtocol = ProductProtocol;
export type WorkspaceSide = 'left' | 'right';
export type WorkspaceEnvironment = 'web' | 'node';
export type WorkspacePlatform = 'windows' | 'macos' | 'linux';
export type WorkspaceTab = 'start' | 'guide' | 'data' | 'debug' | 'downloads';
export type WorkspaceCodeKind = 'complete' | 'snippet';
export const workspaceChapters = [
  { id: 'guide-prepare', label: '安装驱动与运行环境' },
  { id: 'guide-config', label: '确认产品与串口' },
  { id: 'guide-run', label: '安装 SDK' },
  { id: 'guide-connect', label: '激活 SDK 授权' },
  { id: 'guide-verify', label: '验证取数与采集' },
  { id: 'guide-code', label: '接入自己的页面' },
] as const;
export type WorkspaceSection = typeof workspaceChapters[number]['id'];
export type WorkspaceState = {
  product: WorkspaceProduct;
  side: WorkspaceSide | null;
  sideConfirmed: boolean;
  protocol: WorkspaceProtocol;
  env: WorkspaceEnvironment;
  platform: WorkspacePlatform;
  tab: WorkspaceTab;
  section: WorkspaceSection;
  codeKind: WorkspaceCodeKind;
};

export const workspaceProducts = productCatalog.map(product => ({ ...product, label: product.name }));
export const initialWorkspaceState: WorkspaceState = {
  product: 'glove', side: null, sideConfirmed: false, protocol: '12bit', env: 'web', platform: 'windows',
  tab: 'start', section: 'guide-prepare', codeKind: 'complete',
};

/** 每个教程挂载独立的 URL 状态源，服务端快照固定，客户端订阅变更。 */
export function createWorkspaceStore() {
  let value = initialWorkspaceState;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    getServerSnapshot: () => initialWorkspaceState,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    replace(next: WorkspaceState) { value = next; listeners.forEach(listener => listener()); },
  };
}

const oneOf = <T extends string>(value: string | null, choices: readonly T[], fallback: T): T =>
  choices.includes(value as T) ? value as T : fallback;
const referenceHashes = { guide: 'product-guide', data: 'product-data', debug: 'product-debug', downloads: 'product-downloads' } as const;
const flowAliases: Record<string, string> = {
  device: 'flow-read', demo: 'flow-ws', view: 'flow-ws',
  record: 'flow-start', 'record-start': 'flow-start', 'record-stop': 'flow-stop',
  'start-recording': 'flow-start', 'stop-recording': 'flow-stop', cleanup: 'guide-code',
  download: 'flow-download', extensions: 'product-start',
  'quick-call': 'flow-read', 'workspace-code': 'flow-read', 'workspace-example-code': 'flow-read',
  'workspace-run': 'guide-run', troubleshooting: 'product-debug',
};
const quickHashes = new Set(['product-start', 'workspace-config', 'flow-read', 'flow-ws', 'flow-start', 'flow-stop', 'flow-download']);

/** URL 参数只预选配置。共享链接不能替操作者确认实物手侧或脚侧。 */
export function parseWorkspaceLocation(search: string, hash = ''): WorkspaceState {
  const params = new URLSearchParams(search);
  const rawFragment = hash.replace(/^#/, '');
  const fragment = flowAliases[rawFragment] ?? rawFragment;
  // 兼容曾分享的原型参数格式；生产页面继续使用普通章节锚点。
  const legacy = fragment.includes('=') ? new URLSearchParams(fragment) : null;
  const value = (name: string) => params.get(name) ?? legacy?.get(name) ?? null;
  const tabFromHash = (Object.keys(referenceHashes) as Array<keyof typeof referenceHashes>)
    .find(key => referenceHashes[key] === fragment);
  const chapter = workspaceChapters.find(item => item.id === fragment)?.id;
  const requestedTab = oneOf(value('tab'), ['start', 'guide', 'data', 'debug', 'downloads'], 'start');
  const section = chapter ?? oneOf(value('section'), workspaceChapters.map(item => item.id), 'guide-prepare');
  const legacyChapter = legacy && requestedTab === 'start' && section !== 'guide-prepare';
  const product = oneOf(value('product'), workspaceProducts.map(item => item.id), 'glove');
  return {
    ...initialWorkspaceState,
    product,
    protocol: product === 'insole' ? oneOf(value('protocol'), ['12bit', '8bit'], '12bit') : '12bit',
    side: value('side') === 'left' || value('side') === 'right' ? value('side') as WorkspaceSide : null,
    env: oneOf(value('env'), ['web', 'node'], 'web'),
    platform: oneOf(value('platform'), ['windows', 'macos', 'linux'], 'windows'),
    tab: chapter || legacyChapter ? 'guide' : tabFromHash ?? (fragment && !legacy ? quickHashes.has(fragment) ? 'start' : 'guide' : requestedTab),
    section,
    codeKind: oneOf(value('codeKind'), ['complete', 'snippet'], 'complete'),
  };
}

/** 兼容旧流程和准备章链接；默认原型 URL 继续打开调用流程。 */
export function workspaceLocationTarget(search: string, hash: string): string | null {
  let fragment: string;
  try { fragment = decodeURIComponent(hash.replace(/^#/, '')); } catch { return null; }
  if (!fragment) return null;
  if (!fragment.includes('=')) return flowAliases[fragment] ?? fragment;
  const next = parseWorkspaceLocation(search, hash);
  if (next.tab === 'guide' && next.section !== 'guide-prepare') return next.section;
  if (next.tab !== 'start') return referenceHashes[next.tab];
  return null;
}

/** 普通章节跳转和协议切换保留同一实物的确认状态；换产品、手侧或脚侧必须重新确认。 */
export function workspaceStateForLocation(previous: WorkspaceState, search: string, hash: string): WorkspaceState {
  const next = parseWorkspaceLocation(search, hash);
  return { ...next, sideConfirmed: previous.sideConfirmed && previous.product === next.product && previous.side === next.side };
}

export function workspaceReady(state: WorkspaceState): boolean {
  return !getCatalogProduct(state.product).requiresSide || Boolean(state.side && state.sideConfirmed);
}

/** 保留来源/追踪等无关 query，并采用原生章节 hash，便于复制、历史和问答跳转。 */
export function workspaceUrl(state: WorkspaceState, current: URL, requestedHash?: string): string {
  const url = new URL(current);
  for (const key of ['product', 'env', 'platform', 'tab', 'codeKind'] as const) url.searchParams.set(key, state[key]);
  if (getCatalogProduct(state.product).requiresSide && state.side) url.searchParams.set('side', state.side); else url.searchParams.delete('side');
  if (state.product === 'insole') url.searchParams.set('protocol', state.protocol); else url.searchParams.delete('protocol');
  url.searchParams.delete('section');
  if (requestedHash !== undefined) url.hash = requestedHash;
  else if (state.tab !== 'start') url.hash = referenceHashes[state.tab];
  return `${url.pathname}${url.search}${url.hash}`;
}
