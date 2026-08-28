'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { allDocsItems, docsNavigation, SDK_DOWNLOAD, SDK_VERSION, type DocsPageId } from '../docs-data';
import DocsNavigation from './docs-navigation';

const searchableItems = allDocsItems.map((item) => ({
  ...item,
  group: docsNavigation.find((group) => group.items.some((entry) => entry.href === item.href))?.title || '',
}));

export default function DocsHeader({ page = 'sdk' }: { page?: DocsPageId }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return searchableItems.filter((item) =>
      `${item.label} ${item.description} ${item.keywords || ''} ${item.group}`.toLowerCase().includes(normalized),
    );
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      if (event.key === '/' && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        if (window.matchMedia('(min-width: 768px)').matches) {
          searchRef.current?.focus();
          setSearchOpen(true);
        } else {
          setMobileOpen(true);
        }
      }

      if (event.key === 'Escape') {
        setSearchOpen(false);
        setMobileOpen(false);
        searchRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    const desktopMedia = window.matchMedia('(min-width: 1024px)');
    const panel = mobilePanelRef.current;

    document.body.style.overflow = 'hidden';
    const getFocusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('input, a, button, summary') ?? [])
      .filter((element) => element.offsetParent !== null && !element.hasAttribute('disabled'));
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };

    panel?.addEventListener('keydown', trapFocus);
    desktopMedia.addEventListener('change', closeAtDesktop);
    const focusTimer = window.setTimeout(() => {
      getFocusable()[0]?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      panel?.removeEventListener('keydown', trapFocus);
      desktopMedia.removeEventListener('change', closeAtDesktop);
      document.body.style.overflow = previousOverflow;
      if (menuButton?.offsetParent !== null) menuButton?.focus();
    };
  }, [mobileOpen]);

  function completeSearch() {
    setQuery('');
    setSearchOpen(false);
    setMobileOpen(false);
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[var(--line)] bg-[var(--header)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="返回 Shroom Developer 展示首页">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-fill)] text-xs font-black text-[var(--on-accent)]">S</span>
            <span className="hidden text-sm font-bold text-[var(--text-strong)] sm:inline">Shroom SDK Docs</span>
          </Link>

          <div
            className="relative mx-auto hidden w-full max-w-xl md:block"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
            }}
          >
            <label>
              <span className="sr-only">搜索文档</span>
              <input
                ref={searchRef}
                type="search"
                role="combobox"
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                placeholder="搜索文档章节"
                aria-expanded={searchOpen && query.length > 0}
                aria-controls="desktop-search-results"
                aria-autocomplete="list"
                className="h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 pr-10 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-subtle)] focus:border-[var(--focus)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-subtle)]">/</kbd>
            </label>

            {searchOpen && query.length > 0 && (
              <div id="desktop-search-results" className="absolute inset-x-0 top-12 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[0_20px_50px_rgba(15,23,42,0.16)]">
                {results.length > 0 ? (
                  <nav aria-label="搜索结果">
                    {results.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={completeSearch}
                        className="block rounded-lg px-3 py-3 transition hover:bg-[var(--surface-muted)]"
                      >
                        <span className="block text-sm font-semibold text-[var(--text-strong)]">{item.label}</span>
                        <span className="mt-1 block text-xs text-[var(--text-muted)]">{item.group} · {item.description}</span>
                      </Link>
                    ))}
                  </nav>
                ) : (
                  <p className="px-3 py-4 text-sm text-[var(--text-muted)]">没有匹配的文档条目。</p>
                )}
              </div>
            )}
            <span className="sr-only" role="status" aria-live="polite">
              {searchOpen && query.length > 0 ? `找到 ${results.length} 个文档条目` : ''}
            </span>
          </div>

          <span className="hidden shrink-0 font-mono text-xs text-[var(--text-muted)] lg:inline">v{SDK_VERSION}</span>
          <a
            href={SDK_DOWNLOAD}
            download
            className="hidden min-h-11 shrink-0 items-center rounded-lg bg-[var(--accent-fill)] px-4 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-fill-hover)] sm:inline-flex"
          >
            下载 SDK
          </a>
          <button
            ref={menuButtonRef}
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-docs-nav"
            onClick={() => setMobileOpen((open) => !open)}
            className="min-h-11 shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--text-strong)] lg:hidden"
          >
            {mobileOpen ? '关闭' : '目录'}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div
          ref={mobilePanelRef}
          id="mobile-docs-nav"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-docs-nav-title"
          className="fixed inset-x-0 bottom-0 top-16 z-30 overflow-y-auto bg-[var(--surface)] p-5 lg:hidden"
        >
          <div className="flex items-center justify-between gap-4">
            <p id="mobile-docs-nav-title" className="font-semibold text-[var(--text-strong)]">文档目录</p>
            <button type="button" onClick={() => setMobileOpen(false)} className="min-h-11 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold text-[var(--text-strong)]">关闭</button>
          </div>

          <label className="mt-4 block md:hidden">
            <span className="sr-only">搜索文档</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索文档章节"
              className="h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--page)] px-3 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-subtle)] focus:border-[var(--focus)] focus:outline-none"
            />
          </label>

          <div className="mt-5">
            {query.trim() ? (
              results.length > 0 ? (
                <nav aria-label="移动端搜索结果" className="space-y-1">
                  {results.map((item) => (
                    <Link key={item.href} href={item.href} onClick={completeSearch} className="block rounded-lg px-3 py-3 hover:bg-[var(--surface-muted)]">
                      <span className="block text-sm font-semibold text-[var(--text-strong)]">{item.label}</span>
                      <span className="mt-1 block text-xs text-[var(--text-muted)]">{item.description}</span>
                    </Link>
                  ))}
                </nav>
              ) : (
                <p className="px-3 py-4 text-sm text-[var(--text-muted)]">没有匹配的文档条目。</p>
              )
            ) : (
              <DocsNavigation page={page} onNavigate={completeSearch} />
            )}
          </div>

          <a href={SDK_DOWNLOAD} download className="mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--accent-fill)] px-4 text-sm font-semibold text-[var(--on-accent)] sm:hidden">
            下载 SDK v{SDK_VERSION}
          </a>
        </div>
      )}
    </>
  );
}
