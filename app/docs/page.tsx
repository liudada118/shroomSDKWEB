import type { Metadata } from 'next';
import Link from 'next/link';
import { docAreas, docsFor, getDocDefinition, type DocDefinition } from './structure';

export const metadata: Metadata = {
  title: '文档中心｜Shroom Developer',
  description: '按后端与前端查阅 Shroom SDK 文档：Python、Node.js、串口、HTTP/WebSocket 通讯、数据存储和热力图渲染。',
  alternates: { canonical: '/docs' },
};

function DocEntry({ doc }: { doc: DocDefinition }) {
  return (
    <Link href={`/docs/${doc.slug}`} className="group flex min-h-20 items-start justify-between gap-4 rounded-lg px-4 py-4 transition-colors hover:bg-[#eff4ff] focus-visible:outline-2 focus-visible:outline-[#2563eb]">
      <div className="min-w-0">
        <h4 className="text-base font-semibold text-[#344054] group-hover:text-[#175cd3]">{doc.navLabel}</h4>
        <p className="mt-1.5 text-sm leading-6 text-[#667085]">{doc.summary}</p>
      </div>
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-[#667085] group-hover:text-[#175cd3]">→</span>
    </Link>
  );
}

export default function DocsIndex() {
  const backend = getDocDefinition('backend')!;
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:px-8 lg:px-10 lg:pt-16">
      <Link href="/#quick-start" className="inline-flex min-h-11 items-center text-sm font-medium text-[#175cd3] hover:underline">← 返回快速接入</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#101828] sm:text-4xl">文档中心</h1>
      <p className="mt-4 max-w-2xl leading-7 text-[#667085]">先选择后端或前端。后端在同一篇文档中切换语言，前端按通讯与渲染查阅。</p>
      <nav aria-label="文档分类快捷入口" className="mt-7 flex flex-wrap gap-2">
        {docAreas.map((area) => <a key={area.id} href={`#${area.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-[#d0d5dd] px-4 text-sm font-medium text-[#344054] hover:border-[#84adff] hover:bg-[#eff4ff] hover:text-[#175cd3]">{area.label}</a>)}
      </nav>
      <section id="backend" aria-labelledby="backend-title" className="mt-12 scroll-mt-24 border-t border-[#e4e7ec] pt-8">
        <h2 id="backend-title" className="text-2xl font-semibold tracking-tight text-[#101828]">后端</h2>
        <p className="mt-2 text-sm leading-6 text-[#667085]">{docAreas[0].description}</p>
        <div className="mt-6 rounded-xl border border-[#e4e7ec] bg-[#f8fafc] p-4 sm:p-6">
          <Link href="/docs/backend" className="inline-flex min-h-11 items-center gap-3 text-base font-semibold text-[#175cd3] hover:underline">进入后端文档 <span aria-hidden="true">→</span></Link>
          <p className="mt-2 text-sm leading-6 text-[#667085]">安装、参数配置、读取数据与保存示例，跟随所选语言一起切换。</p>
          <nav aria-label="后端章节" className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#e4e7ec] pt-4">
            {backend.chapters?.map((chapter) => <Link key={chapter.id} href={`/docs/backend#${chapter.id}`} className="inline-flex min-h-10 items-center text-sm font-medium text-[#344054] hover:text-[#175cd3] hover:underline">{chapter.label}</Link>)}
          </nav>
        </div>
      </section>
      <section id="frontend" aria-labelledby="frontend-title" className="mt-10 scroll-mt-24 border-t border-[#e4e7ec] pt-8">
        <h2 id="frontend-title" className="text-2xl font-semibold tracking-tight text-[#101828]">前端</h2>
        <p className="mt-2 text-sm leading-6 text-[#667085]">{docAreas[1].description}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {docsFor('frontend').map((doc) => <DocEntry key={doc.slug} doc={doc} />)}
        </div>
      </section>
      <section id="guides" aria-labelledby="guides-title" className="mt-10 scroll-mt-24 border-t border-[#e4e7ec] pt-8">
        <h2 id="guides-title" className="text-2xl font-semibold tracking-tight text-[#101828]">辅助指南</h2>
        <p className="mt-2 text-sm leading-6 text-[#667085]">{docAreas[2].description}</p>
        <div className="mt-5 grid gap-2 md:grid-cols-2">
          {docsFor('guides').map((doc) => <DocEntry key={doc.slug} doc={doc} />)}
        </div>
        <Link href="/knowledge" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[#eff4ff] px-4 py-3 text-sm font-semibold text-[#175cd3] hover:bg-[#dbeafe]">找不到答案？问 AI 知识助手 →</Link>
      </section>
    </div>
  );
}
