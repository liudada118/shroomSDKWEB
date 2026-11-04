'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { workspaceFlow } from './product-workspace-preview';
import type { ProductFlowStep } from '../../sdk/examples/product-flow.js';
import {
  createWorkspaceStore, parseWorkspaceLocation, workspaceChapters,
  workspaceReady, workspaceStateForLocation, workspaceUrl, workspaceLocationTarget,
  type WorkspaceState, type WorkspaceProduct, type WorkspaceSide,
  type WorkspacePlatform, type WorkspaceProtocol, type WorkspaceTab, type WorkspaceSection,
} from './product-workspace-model';

type WorkspaceContextValue = {
  state: WorkspaceState; ready: boolean;
  flowSteps: ProductFlowStep[];
  setProduct: (product: WorkspaceProduct) => void;
  confirmSide: (side: WorkspaceSide) => void;
  setPlatform: (platform: WorkspacePlatform) => void;
  setProtocol: (protocol: WorkspaceProtocol) => void;
  setTab: (tab: WorkspaceTab) => void;
  navigateChapter: (section: WorkspaceSection) => void;
};
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useProductWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('Product workspace requires ProductWorkspaceProvider');
  return context;
}

export function ProductWorkspaceProvider({ children }: { children: ReactNode }) {
  // 固定 SSR 初值避免水合不一致；首次挂载读取 URL，手侧或脚侧仍需本机操作确认。
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
    change(previous => ({ ...previous, tab: 'guide', section }), section);
    // 切换至接入准备面板，再在可见布局中定位章节。
    window.dispatchEvent(new CustomEvent('shroom:workspace-chapter', { detail: { section } }));
  }, [change]);

  const ready = workspaceReady(state);
  const flowSteps = useMemo(() => workspaceFlow(state), [state]);

  const value: WorkspaceContextValue = {
    state, ready, flowSteps,
    setProduct: product => change(previous => previous.product === product ? previous : { ...previous, product, side: null, sideConfirmed: false, protocol: '12bit' }),
    confirmSide: side => change(previous => ({ ...previous, side, sideConfirmed: true })),
    setPlatform: platform => change(previous => ({ ...previous, platform })),
    setProtocol: protocol => change(previous => ({ ...previous, protocol })),
    setTab: tab => {
      const target = tab === 'start' ? 'product-start' : `product-${tab}`;
      pendingTarget.current = target;
      change(previous => ({ ...previous, tab }), target);
    },
    navigateChapter,
  };
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
