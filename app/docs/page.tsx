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
          <p className="docs-page-description">把已购设备接入自己的应用。从最小例程开始，需要哪项能力，再查对应说明。</p>
        </header>

        <section id="quick" aria-labelledby="quick-title" className="docs-start-panel scroll-mt-24">
          <p className="docs-start-eyebrow">推荐起点</p>
          <h2 id="quick-title">集成已购设备</h2>
          <p className="mt-3 text-sm leading-7 text-[#475467]">先读取真实产品数据，再接入自己的程序。展示、录制和下载按需选用。</p>
          <div className="docs-start-actions">
            <Link href="/docs/quick-start" className="inline-flex min-h-11 items-center justify-center gap-3 rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#175cd3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">
              开始集成设备 <span aria-hidden="true">→</span>
            </Link>
            <Link href="/#downloads" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#175cd3] hover:underline">获取 SDK</Link>
          </div>
          <ol aria-label="设备集成步骤" className="docs-start-steps">
            {[
              { id: 'workspace-config', label: '确认产品', description: '按实物选择手套手侧，确认开发环境和驱动。' },
              { id: 'workspace-run', label: '运行完整示例', description: '获取 SDK 和可运行示例，照命令激活、连接并验证首帧。' },
              { id: 'workspace-code', label: '接入自己的应用', description: '对照中文注释和产品字段，把数据回调接入业务。' },
            ].map(task => <li key={task.id}>
              <h3><Link href={`/docs/quick-start#${task.id}`} className="hover:text-[#175cd3] hover:underline">{task.label}</Link></h3>
              <p>{task.description}</p>
            </li>)}
          </ol>
          <p className="docs-support-note">浏览器 JavaScript 与 Node.js 均提供手套和手垫产品示例；Python 提供通用串口与矩阵解析，尚无整包手套专用协议。<Link href="/docs/backend?language=python" className="font-semibold text-[#175cd3] hover:underline">查看 Python 用法 →</Link></p>
          <details className="docs-reference-section">
            <summary className="cursor-pointer text-sm font-semibold text-[#344054]">按需扩展：网页展示、采集与下载</summary>
            <p className="mt-3 text-sm leading-7 text-[#667085]">这条完整流程使用 Node.js 与浏览器，适合需要实时画面或采集文件的任务。</p>
            <ol aria-label="快速接入步骤" className="mt-4 flex list-inside list-decimal flex-wrap gap-x-6 gap-y-2 text-sm text-[#344054]">
              <li>产品取数</li><li>启动 WS</li><li>前端渲染</li><li>数据采集（开始 / 停止）</li><li>按 ID 下载</li>
            </ol>
            <Link href="/docs/quick-start#extensions" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#175cd3] hover:underline">查看展示与采集完整流程 →</Link>
          </details>
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
