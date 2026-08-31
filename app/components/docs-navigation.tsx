'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { docsNavigation, pageTableOfContents, type DocNavItem, type DocsPageId } from '../docs-data';

const expandableItems = docsNavigation
  .flatMap((group) => group.items)
  .filter((item) => item.children?.length);

export default function DocsNavigation({
  compact = false,
  instance = 'sidebar',
  onNavigate,
  page = 'sdk',
}: {
  compact?: boolean;
  instance?: 'sidebar' | 'mobile' | 'toc';
  onNavigate?: () => void;
  page?: DocsPageId;
}) {
  const instanceId = `${page}-${instance}`;
  const itemsForPage = pageTableOfContents[page];
  const [activeAnchor, setActiveAnchor] = useState(page === 'backend' ? '#overview' : '#top');
  const [backendOpen, setBackendOpen] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(() => Object.fromEntries(
    expandableItems.map((item) => [item.anchor, false]),
  ));

  function handleNavigate(item: (typeof itemsForPage)[number]) {
    if (item.page !== page) return;
    const branchAnchor = item.parentAnchor || (item.children?.length ? item.anchor : undefined);
    if (branchAnchor) {
      setExpandedItems((current) => current[branchAnchor] ? current : { ...current, [branchAnchor]: true });
    }
    window.requestAnimationFrame(() => {
      onNavigate?.();
      document.getElementById(item.anchor.slice(1))?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    let animationFrame = 0;
    const syncHash = () => {
      if (!window.location.hash) return;
      const item = itemsForPage.find((entry) => entry.anchor === window.location.hash);
      if (!item) return;
      setActiveAnchor(item.anchor);
      if (item.page === 'backend') setBackendOpen(true);
      const branchAnchor = item.parentAnchor || (item.children?.length ? item.anchor : undefined);
      if (branchAnchor) {
        setExpandedItems((current) => current[branchAnchor] ? current : { ...current, [branchAnchor]: true });
      }
    };

    const elements = itemsForPage
      .map((item) => document.getElementById(item.anchor.slice(1)))
      .filter((element): element is HTMLElement => Boolean(element))
      .sort((first, second) => {
        if (first === second) return 0;
        return first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });

    const updateFromScroll = () => {
      animationFrame = 0;
      if (!elements.length) return;

      const activationLine = 112;
      let current = elements[0];
      for (const element of elements) {
        if (element.getBoundingClientRect().top <= activationLine) current = element;
        else break;
      }

      const atPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (atPageEnd) current = elements[elements.length - 1];
      setActiveAnchor(`#${current.id}`);
    };

    const scheduleScrollSync = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateFromScroll);
    };

    const handleHashChange = () => {
      syncHash();
      scheduleScrollSync();
    };

    syncHash();
    scheduleScrollSync();
    window.addEventListener('scroll', scheduleScrollSync, { passive: true });
    window.addEventListener('resize', scheduleScrollSync);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('scroll', scheduleScrollSync);
      window.removeEventListener('resize', scheduleScrollSync);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [itemsForPage]);

  function renderNavigationItem(item: DocNavItem) {
    const active = item.page === page && activeAnchor === item.anchor;
    const children = item.children || [];
    const childActive = children.some((child) => child.page === page && activeAnchor === child.anchor);

    if (!children.length) {
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
    }

    const open = expandedItems[item.anchor] ?? false;
    const controlsId = `docs-subnav-${item.anchor.slice(1)}-${instanceId}`;
    return (
      <div key={item.href}>
        <div className={`flex min-h-11 overflow-hidden rounded-lg border-l-2 ${active || childActive ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-transparent'}`}>
          <Link
            href={item.href}
            aria-current={active ? 'location' : undefined}
            onClick={() => handleNavigate(item)}
            className={`flex min-h-11 flex-1 items-center px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] ${active || childActive ? 'text-[var(--accent-strong)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'}`}
          >
            {item.label}
          </Link>
          <button
            type="button"
            aria-label={`${open ? '收起' : '展开'}${item.label}分类`}
            aria-expanded={open}
            aria-controls={controlsId}
            onClick={() => setExpandedItems((current) => ({ ...current, [item.anchor]: !open }))}
            className="grid min-h-11 w-11 shrink-0 cursor-pointer place-items-center border-l border-[var(--line)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]"
          >
            <span aria-hidden="true" className={`transition ${open ? 'rotate-180' : ''}`}>⌄</span>
          </button>
        </div>
        <div id={controlsId} hidden={!open} className="ml-4 border-l border-[var(--line)] pl-2">
          {children.map((child) => {
            const activeChild = child.page === page && activeAnchor === child.anchor;
            return (
              <Link
                key={child.href}
                href={child.href}
                aria-current={activeChild ? 'location' : undefined}
                onClick={() => handleNavigate(child)}
                className={`flex min-h-11 items-center rounded-r-lg px-3 py-2 text-[13px] font-medium leading-5 transition ${activeChild ? 'bg-[var(--surface-muted)] font-semibold text-[var(--accent-strong)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'}`}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <nav className="space-y-3 text-sm text-[var(--text-muted)]" aria-label="本页目录">
        {itemsForPage.map((item) => {
          const active = activeAnchor === item.anchor;
          const branchActive = item.children?.some((child) => child.anchor === activeAnchor);
          const nested = Boolean(item.parentAnchor);
          return (
            <Link
              key={item.href}
              className={`block border-l leading-5 transition ${nested ? 'ml-3 py-1 pl-3 text-[13px]' : 'pl-3'} ${active ? 'border-[var(--accent)] font-semibold text-[var(--accent-strong)]' : branchActive ? 'border-transparent font-semibold text-[var(--text-strong)]' : 'border-transparent hover:text-[var(--accent-strong)]'}`}
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
        const groupControlsId = `docs-group-${group.title === '后端与串口' ? 'backend' : group.title}-${instanceId}`;
        const links = (
          <div className="mt-2 space-y-1">
            {group.items.map(renderNavigationItem)}
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
                    aria-controls={groupControlsId}
                    onClick={() => setBackendOpen((open) => !open)}
                    className="grid min-h-11 w-11 shrink-0 cursor-pointer place-items-center border-l border-[var(--line)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]"
                  >
                    <span aria-hidden="true" className={`transition ${backendOpen ? 'rotate-180' : ''}`}>⌄</span>
                  </button>
                </div>
                <div id={groupControlsId} hidden={!backendOpen}>
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
