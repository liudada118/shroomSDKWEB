import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CopyRawButton from '../CopyRawButton';
import BackendGuide, { BackendGuideToolbar } from '../BackendGuide';
import { docPages, getDoc } from '../generated';
import { docBreadcrumbs, getDocDefinition } from '../structure';
import sdkPackage from '../../../sdk/package.json';
import ProductWorkspace from '../ProductWorkspace';

export function generateStaticParams() {
  return docPages.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
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

  if (doc.slug === 'quick-start') {
    // 调用流程由 SDK 共享生成器提供，接入准备和字段参考各有独立面板。
    return <ProductWorkspace />;
  }

  const content = (
    <div className="docs-grid">
      <div className="docs-main">
        <nav aria-label="文档面包屑" className="docs-breadcrumb">
          <Link href="/docs">文档中心</Link>
          {breadcrumbs.map((crumb) => <span key={crumb.href}><span aria-hidden="true">/</span><Link href={crumb.href}>{crumb.label}</Link></span>)}
          <span aria-hidden="true">/</span>
          <span aria-current="page">{definition?.navLabel ?? doc.label}</span>
        </nav>
        <header className="docs-page-header">
          <div className="docs-title-row">
            <h1>{doc.title}</h1>
            <span className="docs-version">{doc.forAi ? 'AI 接入参考' : `v${sdkPackage.version}`}</span>
          </div>
          <p className="docs-page-description">{doc.summary}</p>
          {doc.forAi && <Link href="/docs/skills" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#175cd3] hover:underline">下载可安装的 Shroom SDK Skill →</Link>}
          <div className="docs-page-meta">
            <span>{doc.forAi ? 'AI 接入指南' : definition?.apiReference ? 'API 参考' : '开发指南'}</span>
            <span className="docs-source">sdk/{doc.file}</span>
            {doc.slug !== 'backend' && <CopyRawButton raw={doc.raw} label={doc.forAi ? '复制全文给 AI' : '复制全文'} />}
          </div>
        </header>
        {doc.slug === 'backend' && <BackendGuideToolbar />}
        {/* HTML comes exclusively from repository Markdown rendered at build time. */}
        <article className="doc-body docs-article" dangerouslySetInnerHTML={{ __html: doc.html }} />
        {doc.slug === 'quick-start' ? <section aria-label="基础文档入口" className="docs-related">
          <h2>基础文档</h2>
          <p className="mt-2 text-sm leading-7 text-[#667085]">需要接新设备、调整串口协议或自定义展示时，进入独立的基础文档页面继续查阅。</p>
          <div className="docs-related-links"><Link href="/docs/custom"><span>打开基础文档</span><span aria-hidden="true">→</span></Link></div>
        </section> : others.length > 0 && <section aria-label="同类文档" className="docs-related">
          <h2>继续阅读</h2>
          <div className="docs-related-links">
            {others.map((page) => <Link key={page.slug} href={`/docs/${page.slug}`}>
              <span>{page.label}</span><span aria-hidden="true">→</span>
            </Link>)}
          </div>
        </section>}
      </div>
    </div>
  );

  return <div className="docs-page">{doc.slug === 'backend'
    ? <BackendGuide key={initialLanguage} raw={doc.raw} initialLanguage={initialLanguage}>{content}</BackendGuide>
    : content}</div>;
}
