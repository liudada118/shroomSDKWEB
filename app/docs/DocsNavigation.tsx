'use client';

import Link from 'next/link';
import { docsForRoute, getDocDefinition, type DocDefinition } from './structure';
import DocOutline from './DocOutline';
import type { DocOutlineItem } from './doc-position';

/** Show the complete quick workflow first; basic references live on their own pages. */
export default function DocsNavigation({ pathname, items, onNavigate }: {
  pathname: string;
  onNavigate: () => void;
  items: DocOutlineItem[];
}) {
  const backend = getDocDefinition('backend')!;
  const quickActive = pathname === '/docs/quick-start';
  const basicActive = pathname === '/docs/custom';
  const showReferenceNavigation = pathname.startsWith('/docs/') && !quickActive;
  const basicReferences = docsForRoute('custom').filter((doc) => doc.slug !== 'custom');
  const guides = docsForRoute('guides');
  const listed = [...basicReferences, ...guides].some((doc) => pathname === `/docs/${doc.slug}`);

  /** Render a document link and expand only the current article's section outline. */
  function docLink(doc: DocDefinition) {
    const active = pathname === `/docs/${doc.slug}`;
    return (
      <li key={doc.slug}>
        <Link href={`/docs/${doc.slug}`} onClick={onNavigate} aria-current={active ? 'page' : undefined} className="docs-menu-link">
          {doc.slug === 'backend' ? '后端 · 串口 / 通讯 / 存储' : doc.slug === 'frontend-communication' ? '前端 · 通讯' : doc.slug === 'rendering' ? '前端 · 渲染' : doc.navLabel}
        </Link>
        {active && <DocOutline items={items} onNavigate={onNavigate} />}
      </li>
    );
  }

  return (
    <nav aria-label="文档分类导航" className="docs-navigation">
      <Link href="/" onClick={onNavigate} className="docs-quick-link">← 开发首页</Link>
      <Link href="/docs" onClick={onNavigate} aria-current={pathname === '/docs' ? 'page' : undefined} className="docs-menu-link">文档概览</Link>
      <div className="docs-menu-group" data-doc-route="quick">
        <Link href="/docs/quick-start" onClick={onNavigate} aria-current={quickActive ? 'page' : undefined} className="docs-menu-link docs-route-entry">
          快速接入文档
        </Link>
        {quickActive && <DocOutline items={items} onNavigate={onNavigate} collapsible={false} />}
      </div>
      <div className="docs-menu-group docs-basic-entry" data-doc-route="basic">
        <Link href="/docs/custom" onClick={onNavigate} aria-current={basicActive ? 'page' : undefined} className="docs-menu-link docs-route-entry">
          基础文档 <span aria-hidden="true">→</span>
        </Link>
        {!showReferenceNavigation && <p className="docs-menu-caption">串口、解析、通讯与自定义开发，进入独立页面查看。</p>}
        {basicActive && <DocOutline items={items} onNavigate={onNavigate} />}
        {showReferenceNavigation && <>
          <ul>{basicReferences.map(docLink)}</ul>
          {pathname !== '/docs/backend' && <ul className="docs-menu-chapters">
            {backend.chapters?.map((chapter) => (
              <li key={chapter.id}>
                <Link href={`/docs/backend#${chapter.id}`} onClick={onNavigate} className="docs-menu-link">后端 · {chapter.label}</Link>
              </li>
            ))}
          </ul>}
        </>}
      </div>
      {showReferenceNavigation && <div className="docs-menu-group">
        <p className="docs-menu-caption">辅助指南</p>
        <ul>{guides.map(docLink)}</ul>
      </div>}
      {showReferenceNavigation && !basicActive && !listed && items.length > 0 && <div className="docs-menu-group">
        <p className="docs-menu-caption">本页功能</p>
        <DocOutline items={items} onNavigate={onNavigate} />
      </div>}
      <div className="docs-menu-help">
        <Link href="/#downloads" onClick={onNavigate} className="docs-menu-link">获取 SDK</Link>
        <Link href="/knowledge" onClick={onNavigate} className="docs-menu-link">AI 知识问答 <span aria-hidden="true">↗</span></Link>
      </div>
    </nav>
  );
}
