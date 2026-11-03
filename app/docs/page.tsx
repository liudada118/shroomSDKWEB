import type { Metadata } from 'next';
import Link from 'next/link';
import { getDocDefinition, type DocDefinition } from './structure';

export const metadata: Metadata = {
  title: '文档中心｜Shroom Developer',
  description: '从选择 SDK、读取真实产品数据到接入自有应用，按需查阅展示、采集、自定义接口与排错说明。',
  alternates: { canonical: '/docs' },
};

/** Present an article with a Chinese task description and a stable deep link. */
function DocEntry({ doc }: { doc: DocDefinition }) {
  return (
    <Link href={`/docs/${doc.slug}`} className="group flex min-h-20 items-start justify-between gap-4 rounded-lg px-4 py-4 transition-colors hover:bg-[#eff4ff] focus-visible:outline-2 focus-visible:outline-[#2563eb]">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-[#344054] group-hover:text-[#175cd3]">{doc.navLabel}</h3>
        <p className="mt-1.5 text-sm leading-6 text-[#667085]">{doc.summary}</p>
      </div>
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-[#667085] group-hover:text-[#175cd3]">→</span>
    </Link>
  );
}

/** Lead with device integration; keep optional workflows and references secondary. */
export default function DocsIndex() {
  const basic = getDocDefinition('custom')!;
  return (
    <div className="docs-page docs-grid">
      <div className="docs-main">
        <nav aria-label="文档面包屑" className="docs-breadcrumb">
          <Link href="/">开发首页</Link><span aria-hidden="true">/</span><span aria-current="page">文档中心</span>
        </nav>
        <header className="docs-page-header">
          <div className="docs-title-row"><h1>文档中心</h1><span className="docs-version">SDK 文档</span></div>
          <p className="docs-page-description">把已购设备接入自己的应用，按顺序调用取数、WS、采集与下载接口。</p>
        </header>

        <section id="quick" aria-labelledby="quick-title" className="docs-start-panel scroll-mt-24">
          <p className="docs-start-eyebrow">推荐起点</p>
          <h2 id="quick-title">从取数到下载，五步调用</h2>
          <p className="mt-3 text-sm leading-7 text-[#475467]">Node.js 读取设备并创建 WS，网页控制采集与下载。协议与点位映射由 SDK 处理。</p>
          <Link href="/docs/quick-start?tab=guide" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#175cd3] hover:underline">首次使用：驱动、依赖与授权准备 →</Link>
          <div className="docs-start-actions">
            <Link href="/docs/quick-start" className="inline-flex min-h-11 items-center justify-center gap-3 rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#175cd3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">
              查看调用流程 <span aria-hidden="true">→</span>
            </Link>
            <Link href="/#downloads" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#175cd3] hover:underline">获取 SDK</Link>
          </div>
          <ol aria-label="快速接入步骤" className="docs-start-steps">
            {[
              { id: 'flow-read', label: '取数', description: '调用产品函数，在 onData 接收数据。' },
              { id: 'flow-ws', label: '创建 WS', description: 'Node 创建服务，网页连接一次。' },
              { id: 'flow-start', label: '开始采集', description: '传入标签，开始保存记录。' },
              { id: 'flow-stop', label: '停止采集', description: '等待写入完成，取得记录 ID。' },
              { id: 'flow-download', label: '下载', description: '下载本次记录的 CSV 或 JSONL。' },
            ].map(task => <li key={task.id}>
              <h3><Link href={`/docs/quick-start#${task.id}`} className="hover:text-[#175cd3] hover:underline">{task.label}</Link></h3>
              <p>{task.description}</p>
            </li>)}
          </ol>
          <p className="docs-support-note">浏览器 JavaScript 与 Node.js 均提供手套和手垫产品示例；Python 提供通用串口与矩阵解析，尚无整包手套专用协议。<Link href="/docs/backend?language=python" className="font-semibold text-[#175cd3] hover:underline">查看 Python 用法 →</Link></p>
        </section>

        <section id="custom" aria-labelledby="custom-title" className="docs-reference-section scroll-mt-24">
          <span id="backend" className="scroll-mt-24" /><span id="frontend" className="scroll-mt-24" />
          <h2 id="custom-title">基础与自定义参考</h2>
          <p className="mt-2 text-sm leading-7 text-[#667085]">接入新协议、配置点位映射或查阅底层接口时，从这里进入。</p>
          <div className="mt-4">
            <DocEntry doc={basic} />
          </div>
        </section>

        <section id="guides" aria-labelledby="support-title" className="docs-reference-section scroll-mt-24">
          <h2 id="support-title">遇到问题时</h2>
          <p className="mt-2 text-sm leading-7 text-[#667085]">先查连接与数据排错说明，也可以使用 AI 辅助定位文档。</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href="/docs/readme" className="inline-flex min-h-11 items-center justify-between rounded-lg border border-[#e4e7ec] px-4 py-3 text-sm font-semibold text-[#344054] transition-colors hover:bg-[#f8fafc] focus-visible:outline-2 focus-visible:outline-[#2563eb]">排错与 API 说明 <span aria-hidden="true">→</span></Link>
            <Link href="/knowledge" className="inline-flex min-h-11 items-center justify-between rounded-lg border border-[#e4e7ec] px-4 py-3 text-sm font-semibold text-[#344054] transition-colors hover:bg-[#f8fafc] focus-visible:outline-2 focus-visible:outline-[#2563eb]">AI 文档助手 <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </div>
    </div>
  );
}
