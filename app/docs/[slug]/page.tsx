import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CopyRawButton from '../CopyRawButton';
import BackendGuide from '../BackendGuide';
import { docPages, getDoc } from '../generated';
import { docBreadcrumbs, getDocDefinition } from '../structure';
import sdkPackage from '../../../sdk/package.json';

export function generateStaticParams() {
  return docPages.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return { title: '文档未找到｜Shroom Developer' };
  return {
    title: `${doc.label}｜Shroom Developer 文档`,
    description: doc.summary,
    alternates: { canonical: `/docs/${doc.slug}` },
  };
}

export default async function DocDetail({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ language?: string | string[] }>;
}) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  const definition = getDocDefinition(doc.slug);
  const breadcrumbs = docBreadcrumbs(doc.slug);
  const others = docPages.filter((page) => page.slug !== doc.slug
    && !getDocDefinition(page.slug)?.hidden
    && getDocDefinition(page.slug)?.area === definition?.area).slice(0, 3);
  const initialLanguage = doc.slug === 'backend' && (await searchParams).language === 'python' ? 'python' : 'node';
  const contents = (
    <ul className="space-y-1 text-sm">
      {doc.toc.map((item) => (
        <li key={item.id} data-sdk-language={item.language} className={item.level === 3 ? 'pl-3' : ''}>
          <a href={`#${item.id}`} className={`block rounded py-1.5 leading-6 [overflow-wrap:anywhere] transition hover:text-[#175cd3] focus-visible:outline-2 focus-visible:outline-[#2563eb] ${item.level === 3 ? 'text-[13px] text-[#667085]' : 'text-[#475467]'}`}>
            {item.description ? (
              <>
                <span className="block font-medium">{item.description}</span>
                <span className="mt-0.5 block font-mono text-xs leading-5 text-[#667085]">{item.text}</span>
              </>
            ) : item.text}
          </a>
        </li>
      ))}
    </ul>
  );

  const body = (
    <>
      <details className="mt-8 rounded-xl border border-[#e4e7ec] bg-[#f9fafb] px-4 xl:hidden">
        <summary className="cursor-pointer py-4 text-sm font-semibold text-[#344054]">本页目录</summary>
        <nav aria-label="本页目录" className="mb-4 max-h-72 overflow-y-auto">{contents}</nav>
      </details>
      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_200px]">
        {/* 内容来自本仓库 sdk/ 下自己写的 Markdown，构建时渲染，没有外部输入 */}
        <article className="doc-body min-w-0" dangerouslySetInnerHTML={{ __html: doc.html }} />
        <aside className="hidden xl:block">
          <nav aria-label="本页目录" className="sticky top-24 max-h-[calc(100dvh-120px)] overflow-y-auto border-l border-[#eaecf0] pl-5 pr-2">
            <p className="mb-4 text-xs font-semibold text-[#667085]">本页目录</p>
            {contents}
          </nav>
        </aside>
      </div>
    </>
  );

  return (
      <div className="mx-auto max-w-7xl scroll-mt-[72px] px-5 pb-12 pt-24 sm:px-8 sm:pb-16 lg:px-10">
        <nav aria-label="文档面包屑" className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
          <Link href="/docs" className="text-[#175cd3] hover:underline">
            文档中心
          </Link>
          {breadcrumbs.map((crumb) => <span key={crumb.href} className="inline-flex items-center gap-2"><span aria-hidden="true" className="text-[#98a2b3]">/</span><Link href={crumb.href} className="text-[#667085] hover:text-[#175cd3] hover:underline">{crumb.label}</Link></span>)}
          <span aria-hidden="true" className="text-[#98a2b3]">/</span>
          <span aria-current="page" className="font-medium text-[#344054]">{definition?.navLabel ?? doc.label}</span>
        </nav>

        <div className="mt-6 flex flex-col gap-6 border-b border-[#eaecf0] pb-9 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#2563eb]">
              {doc.forAi ? 'SDK SKILL' : definition?.apiReference ? `SDK ${sdkPackage.version} · API REFERENCE` : doc.label}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{doc.title}</h1>
            <p className="mt-4 leading-7 text-[#667085]">{doc.summary}</p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2">
            {doc.slug !== 'backend' && <CopyRawButton raw={doc.raw} label={doc.forAi ? '复制全文给 AI' : '复制全文'} />}
            <span className="font-mono text-[11px] text-[#98a2b3]">
              sdk/{doc.file} · 约 {Math.round(doc.raw.length / 100) / 10}k 字
            </span>
          </div>
        </div>

        {doc.slug === 'backend'
          ? <BackendGuide key={initialLanguage} raw={doc.raw} initialLanguage={initialLanguage}>{body}</BackendGuide>
          : body}

        {others.length > 0 && <section aria-label="同类文档" className="mt-16 border-t border-[#eaecf0] pt-9">
          <h2 className="text-lg font-semibold text-[#344054]">继续阅读</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {others.map((page) => (
            <Link
              key={page.slug}
              href={`/docs/${page.slug}`}
              className="group rounded-2xl border border-[#e4e7ec] p-6 transition hover:border-[#84adff] hover:shadow-[0_14px_40px_rgba(16,24,40,0.06)]"
            >
              <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#2563eb]">
                {docBreadcrumbs(page.slug).map((crumb) => crumb.label).join(' / ')}
              </p>
              <h2 className="mt-3 text-base font-semibold">{page.label}</h2>
              <p className="mt-2 text-sm leading-6 text-[#667085]">{page.summary}</p>
            </Link>
          ))}
          </div>
        </section>}
      </div>
  );
}
