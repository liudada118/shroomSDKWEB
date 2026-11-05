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
  const showReferenceNavigation = pathname.startsWith('/docs/') && !quickActive && !['/docs/products', '/docs/skills'].includes(pathname);
  const basicReferences = docsForRoute('custom').filter((doc) => doc.slug !== 'custom');
  const guides = docsForRoute('guides');
  const listed = [...basicReferences, ...guides].some((doc) => pathname === `/docs/${doc.slug}`);

  /** 当前文档行折叠整份目录，其他文档保留跳转入口。 */
  function docLink(doc: DocDefinition) {
    const active = pathname === `/docs/${doc.slug}`;
    const label = doc.slug === 'backend' ? '后端 · 串口 / 通讯 / 存储' : doc.slug === 'frontend-communication' ? '前端 · 通讯' : doc.slug === 'rendering' ? '前端 · 渲染' : doc.navLabel;
    return (
      <li key={doc.slug}>
        {active && items.length > 0 ? <details open className="docs-document-group">
          <summary className="docs-menu-link" aria-current="page">
            {label}
            <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m7 5 5 5-5 5" /></svg>
          </summary>
          <DocOutline items={items} onNavigate={onNavigate} />
        </details> : <Link href={`/docs/${doc.slug}`} onClick={onNavigate} aria-current={active ? 'page' : undefined} className="docs-menu-link">
          {label}
        </Link>}
      </li>
    );
  }

  return (
    <nav aria-label="文档分类导航" className="docs-navigation">
      <Link href="/" onClick={onNavigate} className="docs-quick-link">← 开发首页</Link>
      <Link href="/docs" onClick={onNavigate} aria-current={pathname === '/docs' ? 'page' : undefined} className="docs-menu-link">文档概览</Link>
      <ul className="docs-menu-group" data-doc-route="quick" aria-label="接入与产品资料">
        <li>
          <Link href="/docs/quick-start" onClick={onNavigate} aria-current={quickActive ? 'page' : undefined} className="docs-menu-link">
            快速接入文档 <span aria-hidden="true">→</span>
          </Link>
          {quickActive && <DocOutline items={items} onNavigate={onNavigate} collapsible={false} />}
        </li>
        <li><Link href="/docs/products" onClick={onNavigate} aria-current={pathname === '/docs/products' ? 'page' : undefined} className="docs-menu-link">产品接口参考 <span aria-hidden="true">→</span></Link></li>
        <li><Link href="/docs/skills" onClick={onNavigate} aria-current={pathname === '/docs/skills' ? 'page' : undefined} className="docs-menu-link">用 Skill 快速接入 <span aria-hidden="true">→</span></Link></li>
      </ul>
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
