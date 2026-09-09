import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CopyRawButton from '../CopyRawButton';
import DocHeader from '../DocHeader';
import { docPages, getDoc } from '../generated';

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

export default async function DocDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  const others = docPages.filter((page) => page.slug !== doc.slug);

  return (
    <main className="min-h-screen bg-white text-[#101828]">
      <DocHeader />

      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold">
          <Link href="/docs" className="text-[#175cd3] hover:underline">
            ← 返回文档中心
          </Link>
          <span className="text-[#d0d5dd]">·</span>
          <Link href="/" className="text-[#667085] transition hover:text-[#175cd3] hover:underline">
            返回首页
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-6 border-b border-[#eaecf0] pb-9 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#2563eb]">
              {doc.forAi ? 'FOR AI' : 'GUIDE'}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{doc.title}</h1>
            <p className="mt-4 leading-7 text-[#667085]">{doc.summary}</p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2">
            <CopyRawButton raw={doc.raw} label={doc.forAi ? '复制全文给 AI' : '复制全文'} />
            <span className="font-mono text-[11px] text-[#98a2b3]">
              sdk/{doc.file} · 约 {Math.round(doc.raw.length / 100) / 10}k 字
            </span>
          </div>
        </div>

        <div className="mt-10 grid gap-12 lg:grid-cols-[220px_1fr]">
          {/* 目录在窄屏上没有足够宽度，直接不显示，正文本身有标题层级 */}
          <nav className="hidden lg:block" aria-label="本页目录">
            <div className="sticky top-[96px] max-h-[calc(100vh-140px)] overflow-y-auto pr-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">本页目录</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {doc.toc.map((item) => (
                  <li key={item.id} className={item.level === 3 ? 'pl-3' : ''}>
                    <a
                      href={`#${item.id}`}
                      className={`block leading-6 transition hover:text-[#175cd3] ${
                        item.level === 3 ? 'text-[13px] text-[#98a2b3]' : 'text-[#475467]'
                      }`}
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* 内容来自本仓库 sdk/ 下自己写的 Markdown，构建时渲染，没有外部输入 */}
          <article className="doc-body min-w-0" dangerouslySetInnerHTML={{ __html: doc.html }} />
        </div>

        <div className="mt-16 grid gap-4 border-t border-[#eaecf0] pt-9 sm:grid-cols-2">
          {others.map((page) => (
            <Link
              key={page.slug}
              href={`/docs/${page.slug}`}
              className="group rounded-2xl border border-[#e4e7ec] p-6 transition hover:border-[#84adff] hover:shadow-[0_14px_40px_rgba(16,24,40,0.06)]"
            >
              <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#2563eb]">
                {page.forAi ? 'FOR AI' : 'GUIDE'}
              </p>
              <h2 className="mt-3 text-base font-semibold">{page.label}</h2>
              <p className="mt-2 text-sm leading-6 text-[#667085]">{page.summary}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
