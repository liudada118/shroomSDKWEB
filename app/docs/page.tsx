import type { Metadata } from 'next';
import Link from 'next/link';
import DocHeader from './DocHeader';
import { docPages } from './generated';

export const metadata: Metadata = {
  title: '文档中心｜Shroom Developer',
  description: 'Shroom SDK 的完整说明、给 AI 的上下文，以及不写代码也能用 AI 开发的操作指南。',
  alternates: { canonical: '/docs' },
};

export default function DocsIndex() {
  return (
    <main className="min-h-screen bg-white text-[#101828]">
      <DocHeader />

      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <p className="text-sm font-semibold text-[#2563eb]">文档与示例</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
          三份文档，覆盖从第一次连接到交付。
        </h1>
        <p className="mt-5 max-w-2xl leading-7 text-[#667085]">
          内容与下载的 SDK 压缩包完全一致，构建时从 <code className="rounded bg-[#f2f4f7] px-1.5 py-0.5 font-mono text-[13px] text-[#b54708]">sdk/</code>{' '}
          目录同步生成，不会出现网页和压缩包对不上的情况。
        </p>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {docPages.map((doc, index) => (
            <Link
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              className="group flex flex-col rounded-2xl border border-[#e4e7ec] p-7 transition hover:border-[#84adff] hover:shadow-[0_14px_40px_rgba(16,24,40,0.06)]"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#2563eb]">
                  {doc.forAi ? 'FOR AI' : 'GUIDE'}
                </span>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f7] text-sm text-[#667085] transition group-hover:bg-[#eff4ff] group-hover:text-[#175cd3]">
                  →
                </span>
              </div>
              <p className="mt-10 font-mono text-xs text-[#98a2b3]">0{index + 1}</p>
              <h2 className="mt-3 text-lg font-semibold">{doc.label}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-[#667085]">{doc.summary}</p>
              <p className="mt-5 font-mono text-[11px] text-[#98a2b3]">
                {doc.file} · {doc.toc.length} 个小节
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-[#84adff] bg-[#f8fafc] p-7 sm:p-9">
          <h2 className="text-xl font-semibold tracking-[-0.02em]">不知道从哪份开始？</h2>
          <dl className="mt-6 grid gap-5 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-semibold text-[#175cd3]">你自己写代码</dt>
              <dd className="mt-2 text-sm leading-6 text-[#667085]">
                看 <Link href="/docs/readme" className="font-semibold text-[#175cd3] hover:underline">SDK 说明与排错</Link>，
                连不上设备时那张排错表最有用。
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-[#175cd3]">让 AI 写代码</dt>
              <dd className="mt-2 text-sm leading-6 text-[#667085]">
                把 <Link href="/docs/ai-context" className="font-semibold text-[#175cd3] hover:underline">给 AI 的上下文</Link>{' '}
                整篇复制给 AI，再描述你要做的东西。
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-[#175cd3]">不会编程</dt>
              <dd className="mt-2 text-sm leading-6 text-[#667085]">
                看 <Link href="/docs/ai-guide" className="font-semibold text-[#175cd3] hover:underline">怎么用 AI 来开发</Link>，
                从解压开始一步步照做。
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </main>
  );
}
