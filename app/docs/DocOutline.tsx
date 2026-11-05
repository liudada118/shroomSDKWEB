'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { BACKEND_LANGUAGE_EVENT, backendLanguageFromSearch } from './backend-language';
import { groupDocOutline, type DocOutlineItem } from './doc-position';
import { useActiveDocHeading } from './use-active-doc-heading';

function subscribeLanguage(update: () => void) {
  window.addEventListener(BACKEND_LANGUAGE_EVENT, update);
  window.addEventListener('popstate', update);
  return () => {
    window.removeEventListener(BACKEND_LANGUAGE_EVENT, update);
    window.removeEventListener('popstate', update);
  };
}

const readLanguage = () => backendLanguageFromSearch(window.location.search);

/** Quick workflows stay fully visible; reference APIs retain optional chapter folding. */
export default function DocOutline({ items, onNavigate, collapsible = true }: {
  items: DocOutlineItem[];
  onNavigate: () => void;
  collapsible?: boolean;
}) {
  const searchParams = useSearchParams();
  const initialLanguage = backendLanguageFromSearch(searchParams?.toString() ?? '');
  const language = useSyncExternalStore(subscribeLanguage, readLanguage, () => initialLanguage);
  const groups = groupDocOutline(items, language);
  const visibleItems = groups.flatMap((group) => [group.heading, ...group.children]);
  const activeId = useActiveDocHeading(visibleItems.map((item) => item.id));
  const outlineRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = outlineRef.current;
    // 外层文档目录收起时，不用隐藏链接的零坐标调整侧栏位置。
    if (!nav || nav.closest('details:not([open])') || !nav.getClientRects().length) return;
    const link = nav?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!link) return;
    const section = link.closest('details');
    // 所有章节默认展开；滚动跟随时尊重用户手动收起的状态。
    const visibleTarget = section && !section.open ? section.querySelector<HTMLElement>('summary') : link;
    if (!visibleTarget) return;
    const sidebar = nav?.closest<HTMLElement>('#sdk-sidebar');
    if (!sidebar?.getClientRects().length) return;
    const bounds = sidebar.getBoundingClientRect();
    const target = visibleTarget.getBoundingClientRect();
    if (target.top < bounds.top || target.bottom > bounds.bottom) {
      sidebar.scrollTop += target.top - bounds.top - sidebar.clientHeight / 3;
    }
  }, [activeId]);

  function anchor(item: DocOutlineItem, nested = false) {
    return <a href={`#${item.id}`} onClick={onNavigate} aria-current={activeId === item.id ? 'location' : undefined}
      className={`docs-outline-link ${nested ? 'docs-outline-api' : ''}`}>
      <span>{item.description ?? item.text}</span>
      {item.description && <span className="docs-outline-signature">{item.text}</span>}
    </a>;
  }

  return <nav ref={outlineRef} aria-label="本页功能目录" className="docs-outline">
    <p className="docs-outline-caption">本页章节</p>
    <ul>
      {groups.map((group) => <li key={group.heading.id}>
        {group.children.length && collapsible ? <details open className="docs-outline-group">
          <summary>
            {anchor(group.heading)}
            <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m7 5 5 5-5 5" /></svg>
          </summary>
          <ul>{group.children.map((item) => <li key={item.id}>{anchor(item, true)}</li>)}</ul>
        </details> : <>
          {anchor(group.heading)}
          {group.children.length > 0 && <ul>{group.children.map((item) => <li key={item.id}>{anchor(item, true)}</li>)}</ul>}
        </>}
      </li>)}
    </ul>
  </nav>;
}
