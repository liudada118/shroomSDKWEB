'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createProductExample } from '../../sdk/examples/product-examples.js';
import { workspaceReadingPreview } from './product-workspace-preview';
import {
  createWorkspaceStore, parseWorkspaceLocation, workspaceChapters, workspaceCommands, workspaceFilename,
  workspaceReady, workspaceStateForLocation, workspaceUrl, workspaceLocationTarget,
  type WorkspaceState, type WorkspaceProduct, type WorkspaceSide, type WorkspaceEnvironment,
  type WorkspacePlatform, type WorkspaceTab, type WorkspaceSection, type WorkspaceCodeKind,
} from './product-workspace-model';

type WorkspaceContextValue = {
  state: WorkspaceState; ready: boolean; filename: string; code: string; previewCode: string; commands: string;
  setProduct: (product: WorkspaceProduct) => void;
  confirmSide: (side: WorkspaceSide) => void;
  setEnvironment: (env: WorkspaceEnvironment) => void;
  setPlatform: (platform: WorkspacePlatform) => void;
  setTab: (tab: WorkspaceTab) => void;
  navigateChapter: (section: WorkspaceSection) => void;
  setCodeKind: (kind: WorkspaceCodeKind) => void;
};
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useProductWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('Product workspace requires ProductWorkspaceProvider');
  return context;
}

export function ProductWorkspaceProvider({ children }: { children: ReactNode }) {
  // 固定 SSR 初值避免水合不一致；首次挂载读取 URL，手侧仍需本机操作确认。
  const [store] = useState(createWorkspaceStore);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const pendingTarget = useRef<string | null>(null);

  useEffect(() => {
    const readLocation = () => {
      const next = workspaceStateForLocation(store.getSnapshot(), window.location.search, window.location.hash);
      pendingTarget.current = workspaceLocationTarget(window.location.search, window.location.hash);
      store.replace(next);
    };
    const next = parseWorkspaceLocation(window.location.search, window.location.hash);
    if (!new URLSearchParams(window.location.search).has('platform')) {
      next.platform = /Mac|iPhone|iPad/.test(navigator.platform) ? 'macos' : /Linux/.test(navigator.platform) ? 'linux' : 'windows';
    }
    pendingTarget.current = workspaceLocationTarget(window.location.search, window.location.hash);
    store.replace(next);
    window.history.replaceState(window.history.state, '', workspaceUrl(next, new URL(window.location.href)));
    window.addEventListener('popstate', readLocation);
    window.addEventListener('hashchange', readLocation);
    return () => {
      window.removeEventListener('popstate', readLocation);
      window.removeEventListener('hashchange', readLocation);
    };
  }, [store]);

  const change = useCallback((update: (previous: WorkspaceState) => WorkspaceState, hash?: string) => {
    // history 更新属于用户动作，放在 updater 外，避免 React 重放 updater 时产生副作用。
    const next = update(store.getSnapshot());
    store.replace(next);
    window.history.replaceState(window.history.state, '', workspaceUrl(next, new URL(window.location.href), hash));
  }, [store]);

  useEffect(() => {
    const id = pendingTarget.current;
    if (!id) return;
    const target = document.getElementById(id);
    // 首次深链在水合后才显示参考面板；保留待定位目标，等可见 DOM 提交后重试。
    if (target && !target.getClientRects().length) return;
    pendingTarget.current = null;
    if (target) target.tabIndex = -1;
    target?.scrollIntoView({ block: 'start' });
    target?.focus({ preventScroll: true });
  }, [state]);

  const navigateChapter = useCallback((section: WorkspaceSection) => {
    if (!workspaceChapters.some(item => item.id === section)) return;
    pendingTarget.current = section;
    change(previous => ({ ...previous, tab: 'start', section }), section);
    // 教程默认折叠；先让正文展开对应说明，再在可见布局中定位章节。
    window.dispatchEvent(new CustomEvent('shroom:workspace-chapter', { detail: { section } }));
  }, [change]);

  const ready = workspaceReady(state);
  const code = useMemo(() => ready ? createProductExample({
    product: state.product, ...(state.product === 'glove' && state.side ? { side: state.side } : {}),
    env: state.env, platform: state.platform, kind: state.codeKind,
  }) : '// 请先在顶部按实物确认左手或右手，再生成对应示例。', [ready, state.product, state.side, state.env, state.platform, state.codeKind]);
  const previewCode = useMemo(() => workspaceReadingPreview(state), [state]);

  const value: WorkspaceContextValue = {
    state, ready, filename: workspaceFilename(state), code, previewCode, commands: workspaceCommands(state),
    setProduct: product => change(previous => previous.product === product ? previous : { ...previous, product, side: null, sideConfirmed: false }),
    confirmSide: side => change(previous => ({ ...previous, side, sideConfirmed: true })),
    setEnvironment: env => change(previous => ({ ...previous, env })),
    setPlatform: platform => change(previous => ({ ...previous, platform })),
    setTab: tab => {
      const target = tab === 'start' ? 'product-start' : `product-${tab}`;
      pendingTarget.current = target;
      change(previous => ({ ...previous, tab }), target);
    },
    navigateChapter,
    setCodeKind: codeKind => change(previous => ({ ...previous, codeKind })),
  };
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
