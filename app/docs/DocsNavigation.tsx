import Link from 'next/link';
import { docAreas, docsFor, getDocDefinition, type DocDefinition } from './structure';

export default function DocsNavigation({ pathname, onNavigate }: {
  pathname: string;
  onNavigate: () => void;
}) {
  const backend = getDocDefinition('backend')!;
  function docLink(doc: DocDefinition) {
    const active = pathname === `/docs/${doc.slug}`;
    return (
      <li key={doc.slug}>
        <Link href={`/docs/${doc.slug}`} onClick={onNavigate} aria-current={active ? 'page' : undefined}
          className={`flex min-h-10 items-center rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[#2563eb] ${doc.slug === 'backend' ? 'font-semibold' : ''} ${active ? 'bg-[#eaf1ff] font-semibold text-[#175cd3]' : 'text-[#475467] hover:bg-[#eef0f3] hover:text-[#101828]'}`}>
          {doc.navLabel}
        </Link>
      </li>
    );
  }

  return (
    <nav aria-label="文档分类导航" className="space-y-5">
      <div className="space-y-1">
        <Link href="/#quick-start" onClick={onNavigate} className="flex min-h-10 items-center px-3 text-sm text-[#667085] hover:text-[#175cd3]">
          ← 快速接入
        </Link>
        <Link href="/docs" onClick={onNavigate} aria-current={pathname === '/docs' ? 'page' : undefined}
          className={`flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold ${pathname === '/docs' ? 'bg-[#eaf1ff] text-[#175cd3]' : 'text-[#344054] hover:bg-[#eef0f3]'}`}>
          文档概览
        </Link>
      </div>
      {docAreas.map((area) => (
        <div key={area.id}>
          {area.id === 'backend' ? (
            <>
              <ul className="mb-2">{docLink(backend)}</ul>
              <ul className="ml-3 space-y-0.5 border-l border-[#d0d5dd] pl-2">
                {backend.chapters?.map((chapter) => (
                  <li key={chapter.id}>
                    {pathname === '/docs/backend' ? (
                      <a href={`#${chapter.id}`} onClick={onNavigate} className="flex min-h-10 items-center rounded-lg px-3 text-sm text-[#475467] hover:bg-[#eef0f3] hover:text-[#101828]">{chapter.label}</a>
                    ) : (
                      <Link href={`/docs/backend#${chapter.id}`} onClick={onNavigate} className="flex min-h-10 items-center rounded-lg px-3 text-sm text-[#475467] hover:bg-[#eef0f3] hover:text-[#101828]">{chapter.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="mb-2 px-3 text-sm font-semibold text-[#344054]">{area.label}</p>
              <ul className="ml-3 space-y-0.5 border-l border-[#d0d5dd] pl-2">{docsFor(area.id).map(docLink)}</ul>
            </>
          )}
        </div>
      ))}
      <Link href="/knowledge" onClick={onNavigate} className="flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-[#475467] hover:bg-[#eef0f3] hover:text-[#175cd3]">
        AI 知识问答
      </Link>
    </nav>
  );
}
