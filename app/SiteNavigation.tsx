'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// 页内目录严格按正文的 DOM 顺序排列；分组不改变阅读顺序。
const navigationGroups = [
  {
    label: '了解 SDK',
    items: [
      { label: '开发概览', href: '#top' },
      { label: '选择产品', href: '#products' },
      { label: '产品能力', href: '#capabilities' },
    ],
  },
  {
    label: '接入与下载',
    items: [
      { label: 'SDK Skill', href: '#skill' },
      { label: 'SDK 下载', href: '#downloads' },
      { label: '上位机下载', href: '#desktop-downloads' },
      { label: '快速开始', href: '#quick-start' },
    ],
  },
  {
    label: '工具与文档',
    items: [
      { label: '开发工具', href: '#tools' },
      { label: '文档与示例', href: '#docs' },
      { label: 'Python SDK', href: '/docs/python' },
      { label: 'AI 知识问答', href: '/knowledge' },
    ],
  },
];

const sectionLinks = navigationGroups.flatMap((group) => group.items).filter((item) => item.href.startsWith('#'));

export default function SiteNavigation({ pathname, pageTitle }: {
  pathname: string;
  pageTitle: string;
}) {
  const isHome = pathname === '/';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeHref, setActiveHref] = useState('#top');
  const navigationRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // 保留原生锚点与浏览器历史；滚动只更新当前项，不改 URL。
  useEffect(() => {
    if (!isHome) return;
    let pendingFrame = 0;
    const update = () => {
      pendingFrame = 0;
      // 跨页返回时内容可能晚于共享布局提交，始终读取当前页面的节点。
      const sections = sectionLinks.map((item) => ({
        href: item.href,
        element: document.getElementById(item.href.slice(1)),
      }));
      let currentHref = '#top';
      let closestTop = -Infinity;
      for (const section of sections) {
        const top = section.element?.getBoundingClientRect().top;
        if (top !== undefined && top <= 128 && top >= closestTop) {
          currentHref = section.href;
          closestTop = top;
        }
      }
      // 最后一节可能不足一屏，无法滚到顶栏下方；到达页尾时仍选中它。
      const lastSection = sections[sections.length - 1];
      if (lastSection?.element && window.scrollY > 0
        && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        currentHref = lastSection.href;
      }
      setActiveHref(currentHref);
    };
    const scheduleUpdate = () => {
      if (!pendingFrame) pendingFrame = window.requestAnimationFrame(update);
    };
    scheduleUpdate();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('hashchange', scheduleUpdate);
    return () => {
      window.cancelAnimationFrame(pendingFrame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('hashchange', scheduleUpdate);
    };
  }, [isHome]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !navigationRef.current?.contains(event.target)) {
        setMobileOpen(false);
      }
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside);
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, [mobileOpen]);

  function selectSection(href: string) {
    setMobileOpen(false);
    if (!isHome || !href.startsWith('#')) return;
    // 当前项只由实际滚动位置决定，避免先跳到目标项，再沿途跳回。
    // 折叠菜单后把键盘焦点交给目标内容，不留在隐藏链接里。
    if (mobileOpen) {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(href.slice(1));
        if (target) {
          target.tabIndex = -1;
          target.focus({ preventScroll: true });
        }
      });
    }
  }

  const selectedHref = isHome ? activeHref : pathname === '/docs/python' || pathname === '/knowledge' ? pathname : pathname.startsWith('/docs') ? '#docs' : undefined;
  const activeLabel = isHome ? sectionLinks.find((item) => item.href === activeHref)?.label ?? '开发概览' : pageTitle;

  return (
    <div
      ref={navigationRef}
      className="sdk-navigation"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setMobileOpen(false);
      }}
    >
      <a href="#main-content" className="sr-only fixed left-4 top-3 z-[110] rounded-lg bg-white px-4 py-3 font-semibold text-[#175cd3] shadow-lg focus:not-sr-only">
        跳转到主要内容
      </a>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#eaecf0] bg-white/95 backdrop-blur-xl">
        <div className="flex h-[72px] items-center gap-4 px-5 sm:px-8 lg:px-6">
          <Link href={isHome ? '#top' : '/#top'} onClick={() => selectSection('#top')} className="flex shrink-0 items-center gap-3 lg:w-[216px]" aria-label="Shroom Developer 首页">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#2563eb] text-sm font-black text-white shadow-[0_8px_22px_rgba(37,99,235,0.18)]">S</span>
            <span className="text-[15px] font-bold tracking-[-0.02em]">
              Shroom <span className="font-medium text-[#667085]">Developer</span>
            </span>
          </Link>
          <div className="hidden min-w-0 items-center gap-3 text-sm lg:flex">
            <span className="shrink-0 text-[#667085]">SDK 开发中心</span>
            <span aria-hidden="true" className="text-[#d0d5dd]">/</span>
            <span title={activeLabel} className="truncate font-medium text-[#344054]">{activeLabel}</span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <Link href="/docs" className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-medium text-[#475467] transition-colors hover:bg-[#f2f4f7] hover:text-[#175cd3] sm:inline-flex">
              查看文档
            </Link>
            <Link href={isHome ? '#downloads' : '/#downloads'} onClick={() => selectSection('#downloads')} className="hidden min-h-11 cursor-pointer items-center rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#175cd3] sm:inline-flex">
              获取 SDK
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              aria-label={mobileOpen ? '关闭导航' : '打开导航'}
              aria-controls="sdk-sidebar"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[#d0d5dd] px-3 text-sm font-medium text-[#344054] transition-colors hover:bg-[#f2f4f7] lg:hidden"
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d={mobileOpen ? 'M6 6l12 12M6 18L18 6' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
              目录
            </button>
          </div>
        </div>
      </header>

      <aside
        id="sdk-sidebar"
        aria-label="SDK 导航目录"
        className={`fixed bottom-0 left-0 top-[72px] z-40 w-full flex-col overflow-y-auto overscroll-contain border-r border-[#eaecf0] bg-[#f9fafb] px-4 pb-6 pt-6 shadow-xl lg:flex lg:w-60 lg:shadow-none ${mobileOpen ? 'flex' : 'hidden'}`}
      >
        <nav aria-label="SDK 主导航" className="space-y-6">
          {navigationGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-[#667085]">{group.label}</p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = selectedHref === item.href;
                  const href = item.href.startsWith('#') && !isHome ? item.href === '#docs' ? '/docs' : `/${item.href}` : item.href;
                  const className = `relative flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 text-sm transition-colors ${active ? 'bg-[#eaf1ff] font-semibold text-[#175cd3]' : 'font-medium text-[#475467] hover:bg-[#eef0f3] hover:text-[#101828]'}`;
                  const content = <><span>{item.label}</span>{active && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" />}{item.href === '#skill' && !active && <span className="rounded border border-[#d0d5dd] px-1.5 py-0.5 text-[11px] text-[#475467]">推荐</span>}</>;
                  return (
                    <li key={item.href}>
                      {item.href.startsWith('#') && isHome ? (
                        <a href={item.href} aria-current={active ? 'location' : undefined} onClick={() => selectSection(item.href)} className={className}>{content}</a>
                      ) : (
                        <Link href={href} aria-current={active ? 'page' : undefined} onClick={() => setMobileOpen(false)} className={className}>{content}</Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-auto pt-8">
          <a href="/lab.html" target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between rounded-lg border border-[#e4e7ec] bg-white px-3 text-sm font-medium text-[#344054] transition-colors hover:border-[#84adff] hover:text-[#175cd3]">
            网页测试台 <span aria-hidden="true">↗</span><span className="sr-only">（新标签页打开）</span>
          </a>
          <p className="mt-3 px-3 font-mono text-[11px] text-[#667085]">Web · Node.js · Python</p>
        </div>
      </aside>
    </div>
  );
}
