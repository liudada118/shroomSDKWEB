'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { docsNavigation, pageTableOfContents, type DocsPageId } from '../docs-data';

export default function DocsNavigation({
  compact = false,
  onNavigate,
  page = 'sdk',
}: {
  compact?: boolean;
  onNavigate?: () => void;
  page?: DocsPageId;
}) {
  const itemsForPage = pageTableOfContents[page];
  const [activeAnchor, setActiveAnchor] = useState(page === 'backend' ? '#overview' : '#top');
  const [backendOpen, setBackendOpen] = useState(true);

  function handleNavigate(item: (typeof itemsForPage)[number]) {
    if (item.page !== page) return;
    window.requestAnimationFrame(() => {
      onNavigate?.();
      document.getElementById(item.anchor.slice(1))?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    const syncHash = () => {
      if (window.location.hash && itemsForPage.some((item) => item.anchor === window.location.hash)) {
        setActiveAnchor(window.location.hash as `#${string}`);
      }
    };

    syncHash();
    const elements = itemsForPage
      .map((item) => document.getElementById(item.anchor.slice(1)))
      .filter((element): element is HTMLElement => Boolean(element));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        setActiveAnchor(`#${visible[0].target.id}`);
      },
      { rootMargin: '-88px 0px -72% 0px' },
    );

    elements.forEach((element) => observer.observe(element));
    window.addEventListener('hashchange', syncHash);
    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', syncHash);
    };
  }, [itemsForPage]);

  if (compact) {
    return (
      <nav className="space-y-3 text-sm text-[var(--text-muted)]" aria-label="本页目录">
        {itemsForPage.map((item) => {
          const active = activeAnchor === item.anchor;
          return (
            <Link
              key={item.href}
              className={`block border-l pl-3 leading-5 transition ${active ? 'border-[var(--accent)] font-semibold text-[var(--accent-strong)]' : 'border-transparent hover:text-[var(--accent-strong)]'}`}
              href={item.href}
              aria-current={active ? 'location' : undefined}
              onClick={() => handleNavigate(item)}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="SDK 文档导航" className="space-y-7">
      {docsNavigation.map((group) => {
        const links = (
          <div className="mt-2 space-y-1">
            {group.items.map((item) => {
              const active = item.page === page && activeAnchor === item.anchor;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'location' : undefined}
                  onClick={() => handleNavigate(item)}
                  className={`block min-h-11 rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition ${active ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        );

        return (
        <div key={group.title}>
          <p className="px-3 text-xs font-semibold text-[var(--text-subtle)]">{group.title}</p>
          {group.collapsible ? (() => {
            const landingItem = group.items[0];
            const groupActive = group.items.some((item) => item.page === page);

            return (
              <div className="mt-2">
                <div className={`flex min-h-11 overflow-hidden rounded-lg ${groupActive ? 'bg-[var(--accent-soft)]' : ''}`}>
                  <Link
                    href={landingItem.href}
                    aria-current={groupActive ? 'page' : undefined}
                    onClick={() => handleNavigate(landingItem)}
                    className={`flex min-h-11 flex-1 items-center px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] ${groupActive ? 'text-[var(--accent-strong)]' : 'text-[var(--text-strong)] hover:bg-[var(--surface-muted)]'}`}
                  >
                    {group.label || group.title}
                  </Link>
                  <button
                    type="button"
                    aria-label={`${backendOpen ? '收起' : '展开'}${group.label || group.title}`}
                    aria-expanded={backendOpen}
                    aria-controls="backend-capabilities-nav"
                    onClick={() => setBackendOpen((open) => !open)}
                    className="grid min-h-11 w-11 shrink-0 cursor-pointer place-items-center border-l border-[var(--line)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]"
                  >
                    <span aria-hidden="true" className={`transition ${backendOpen ? 'rotate-180' : ''}`}>⌄</span>
                  </button>
                </div>
                <div id="backend-capabilities-nav" hidden={!backendOpen}>
                  {links}
                </div>
              </div>
            );
          })() : links}
        </div>
        );
      })}
    </nav>
  );
}
