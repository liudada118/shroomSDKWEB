import Link from 'next/link';
import DocCodeBlock from './components/doc-code-block';
import DocsHeader from './components/docs-header';
import DocsNavigation from './components/docs-navigation';
import { SDK_DOWNLOAD, SDK_VERSION } from './docs-data';

const installCode = `# 在解压后的 shroom-sdk 目录
npm install

# 无硬件验证协议解析与内存存储
npm run backend:serial-demo -- --mock`;

const serialCode = `// backend-demo.cjs
const { ShroomSensorSDK } = require('./backend')

async function main() {
  const sdk = new ShroomSensorSDK()
  const result = await sdk.connectSerial({
    mode: 'manual',
    sensorType: 'hand0205',
    channels: { left: 'COM3', right: 'COM4' },
  })

  const session = result.session ?? result.sessions[0]
  session.on('frame', (frame) => {
    console.log(frame.channel, frame.stats)
  })

  console.log(sdk.getSerialState())
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})`;

const captureCode = `const capture = sdk.startCapture(session, {
  name: 'glove-test',
  frequencyMode: 'custom', // serial = 保存每个有效串口帧
  frequencyHz: 60,
  dataField: 'matrixData',
  batchSize: 200,
  flushIntervalMs: 250,
  minFreeBytes: 2 * 1024 * 1024 * 1024,
})

session.on('captureFlush', ({ count }) => console.log('落盘', count))
session.on('captureError', ({ error }) => console.error(error.code, error.message))

const stopped = sdk.stopCapture(session)
console.log(stopped.stats.storedFrames)`;

const storageCode = `const {
  ShroomSensorSDK,
  MemoryCaptureStore,
} = require('./backend')

// SQLite：不传 store，默认写入 db/sdk_capture.db
const diskSdk = new ShroomSensorSDK({ dbPath: 'D:/sensor-data/sdk.db' })

// 内存：适合 Demo、测试和临时数据
const memorySdk = new ShroomSensorSDK({ store: new MemoryCaptureStore() })

const captures = diskSdk.listCaptures({ sensorType: 'hand0205', limit: 20 })
const frames = captures[0]
  ? diskSdk.getCaptureFrames({
      captureId: captures[0].id,
      channel: 'left',
      limit: 1000,
    })
  : []`;

const replayCode = `const player = sdk.createReplay({
  captureId: 12,
  channel: 'left',
  speed: 1,
  loop: false,
  applyAlgorithms: true,
})

player.on('frame', (frame) => render(frame.data))
player.on('end', () => console.log('回放结束'))

player.play()
player.pause()
player.seek(100)
player.step(1)
player.setSpeed(2)
player.setLoop(true)`;

const csvCode = `const { ShroomSensorSDK } = require('./backend')

async function main() {
  const sdk = new ShroomSensorSDK({ dbPath: 'D:/sensor-data/sdk.db' })
  const output = await sdk.exportCsv({
    captureId: 12,
    channel: 'left',
    fromTimestamp: 1_000,
    toTimestamp: 5_000,
    language: 'zh',
    outputPath: 'D:/sensor-data/glove-left.csv',
  })

  console.log(output.files, output.rows)
  await sdk.close()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})`;

const algorithmCode = `const {
  ShroomSensorSDK,
  createPressureStatsAlgorithm,
} = require('./backend')

const sdk = new ShroomSensorSDK()

sdk.registerAlgorithm(
  'pressureStats',
  createPressureStatsAlgorithm({ threshold: 10 }),
)

sdk.registerAlgorithm('centerOfPressure', (data, { frame }) => {
  const width = frame.matrix?.width || 16
  let weight = 0, x = 0, y = 0
  data.forEach((value, index) => {
    weight += value
    x += (index % width) * value
    y += Math.floor(index / width) * value
  })
  return weight ? { x: x / weight, y: y / weight } : { x: 0, y: 0 }
})`;

const bridgeCode = `// 已有 Shroom.mock() / Web / Node Device 时
const {
  attachCoreDevice,
  backendFrameToCoreFrame,
  MemoryCaptureStore,
} = require('./backend')

const session = attachCoreDevice(device, {
  store: new MemoryCaptureStore(),
  sensorType: 'matrix',
  channel: 'sit',
})

session.startCapture({ name: 'device-test', frequencyMode: 'serial' })

// 回放结果恢复为现有 Heatmap 可直接使用的 Core Frame
const coreFrame = backendFrameToCoreFrame(replayFrame)
heatmap.render(coreFrame)`;

const capabilities = [
  ['串口', 'SerialManager / connectSerial()', '已纳入预览', '枚举、自动/手动连接、波特率识别、重试、写入、重扫与稳定错误码。'],
  ['采集', 'CaptureController / startCapture()', '已纳入预览', '按通道限频、批量事务、定时 flush、停止 flush 与磁盘余量保护。'],
  ['存储', 'CaptureStore / MemoryCaptureStore', '已纳入预览', 'SQLite WAL 或内存存储，统一查询、分页、计数和级联删除接口。'],
  ['回放', 'ReplayService / ReplayPlayer', '已纳入预览', '按真实时间戳播放，支持暂停、定位、逐帧、倍速、循环与算法重算。'],
  ['CSV', 'CsvExporter / exportCsv()', '已纳入预览', '按采集、通道与时间过滤，保留数据、统计、原始帧与算法结果。'],
  ['简单算法通道', 'AlgorithmChannel / registerAlgorithm()', '已纳入预览', '同步算法按注册顺序执行，单个算法失败默认不会中断串口链路。'],
] as const;

const serialFeatures = [
  ['端口识别', '支持 WCH、CH34 与 USB Vendor 1A86 特征筛选。'],
  ['连接策略', '手动指定通道，或枚举端口后自动识别波特率并稳定连接。'],
  ['状态', '记录 online、lastDataAt、goodFrames、badFrames、dataQuality 与 lastError。'],
  ['故障恢复', '连接阶段支持重试；断流会进入 stale，可由业务调用 rescanSerial()，不会后台无限重连。'],
  ['错误码', 'PORT_BUSY、PORT_NOT_FOUND、BAUD_FAIL、CONN_BUSY 等稳定错误分类。'],
] as const;

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[0.86em] text-[var(--accent-strong)]">{children}</code>;
}

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-[var(--text-strong)] sm:text-[2rem]">{title}</h2>
      <div className="mt-4 text-[15px] leading-7 text-[var(--text-muted)]">{children}</div>
    </div>
  );
}

function DocsSidebar() {
  return (
    <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto border-r border-[var(--line)] bg-[var(--surface)] px-4 py-8 lg:block">
      <DocsNavigation page="backend" />
    </aside>
  );
}

export default function BackendDocsPage() {
  return (
    <main className="min-h-[100dvh] bg-[var(--page)] text-[var(--text)]">
      <a className="skip-link" href="#overview">跳到主要内容</a>
      <DocsHeader page="backend" />

      <div className="mx-auto grid max-w-[1500px] pt-16 lg:grid-cols-[248px_minmax(0,1fr)] 2xl:grid-cols-[248px_minmax(0,1fr)_220px]">
        <DocsSidebar />

        <article className="min-w-0 px-5 py-10 sm:px-8 sm:py-14 lg:px-10 xl:px-14">
          <div className="mx-auto max-w-4xl">
            <section id="overview" tabIndex={-1} className="scroll-mt-24">
              <p className="text-sm text-[var(--text-muted)]"><Link href="/docs" className="hover:text-[var(--accent-strong)] hover:underline">SDK 文档</Link> / 后端与串口</p>
              <h1 className="mt-4 max-w-3xl text-[clamp(2.35rem,5vw,3.75rem)] font-semibold leading-[1.06] tracking-[-0.055em] text-[var(--text-strong)]">
                本地 Node 后端能力
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--text-muted)]">
                把串口 Frame 延伸为可采集、可存储、可回放、可导出的本地数据链。它运行在 Node / Electron / 上位机进程，不运行在网页或托管 Worker 中。
              </p>

              <dl className="mt-8 grid gap-x-8 gap-y-5 border-y border-[var(--line)] py-6 sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-xs text-[var(--text-subtle)]">下载包版本</dt><dd className="mt-1 font-mono text-sm font-semibold text-[var(--text-strong)]">{SDK_VERSION}</dd></div>
                <div><dt className="text-xs text-[var(--text-subtle)]">运行环境</dt><dd className="mt-1 text-sm font-semibold text-[var(--text-strong)]">本地 Node / Electron</dd></div>
                <div><dt className="text-xs text-[var(--text-subtle)]">模块格式</dt><dd className="mt-1 font-mono text-sm font-semibold text-[var(--text-strong)]">CommonJS 子入口</dd></div>
                <div><dt className="text-xs text-[var(--text-subtle)]">测试状态</dt><dd className="mt-1 text-sm font-semibold text-[var(--text-strong)]">124 项通过</dd></div>
              </dl>

              <div className="mt-7 border-l-4 border-[var(--warning-border)] bg-[var(--warning-soft)] px-5 py-4 text-sm leading-6 text-[var(--warning-text)]">
                <strong>不是云端后端：</strong>这些模块会访问 COM 口、SQLite 和本地文件系统。网站只提供文档和 ZIP 下载，不会在服务器上替你打开串口。包内的 <InlineCode>BackendSdkClient</InlineCode> 也只是连接另一个已运行 HTTP/WS 服务的客户端，不包含服务端实现。
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href={SDK_DOWNLOAD} download className="inline-flex min-h-11 items-center rounded-lg bg-[var(--accent-fill)] px-4 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-fill-hover)]">下载含后端能力的 ZIP</a>
                <a href="#serial" className="inline-flex min-h-11 items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text-strong)] transition hover:border-[var(--focus)] hover:text-[var(--accent-strong)]">查看串口接入</a>
              </div>

              <div className="mt-10 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
                <p className="text-xs font-semibold text-[var(--text-subtle)]">统一数据链</p>
                <ol className="mt-5 grid gap-3 text-sm font-semibold text-[var(--text-strong)] sm:grid-cols-2 lg:grid-cols-4" aria-label="后端数据流">
                  {['串口与协议', 'Mapping / 清零', '算法与 Frame', '采集与存储', '回放与 CSV'].map((step, index) => (
                    <li key={step} className="flex min-h-16 items-center gap-3 rounded-xl bg-[var(--surface-muted)] px-4"><span className="font-mono text-xs text-[var(--accent-strong)]">0{index + 1}</span>{step}</li>
                  ))}
                </ol>
              </div>

              <div className="mt-10 overflow-x-auto">
                <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
                  <caption className="mb-3 text-left text-sm font-semibold text-[var(--text-strong)]">当前下载包中的后端能力</caption>
                  <thead><tr className="bg-[var(--surface-muted)] text-xs text-[var(--text-subtle)]"><th scope="col" className="rounded-l-lg px-4 py-3">能力</th><th scope="col" className="px-4 py-3">SDK 入口</th><th scope="col" className="px-4 py-3">状态</th><th scope="col" className="rounded-r-lg px-4 py-3">说明</th></tr></thead>
                  <tbody>{capabilities.map(([name, entry, status, description]) => <tr key={name} className="border-b border-[var(--line)]"><th scope="row" className="border-b border-[var(--line)] px-4 py-4 font-semibold text-[var(--text-strong)]">{name}</th><td className="border-b border-[var(--line)] px-4 py-4 font-mono text-xs text-[var(--accent-strong)]">{entry}</td><td className="border-b border-[var(--line)] px-4 py-4 font-semibold text-[var(--success-text)]">{status}</td><td className="border-b border-[var(--line)] px-4 py-4 leading-6 text-[var(--text-muted)]">{description}</td></tr>)}</tbody>
                </table>
              </div>

              <div className="mt-10"><DocCodeBlock label="PowerShell / Terminal" code={installCode} /></div>
              <div className="mt-6"><DocCodeBlock label="集成片段 · Core Device → Backend Frame" code={bridgeCode} /></div>
              <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">Core Device 桥接的 <InlineCode>values</InlineCode> 是 0–1 归一化值，并在后端帧中标记 <InlineCode>valueScale: &apos;normalized-0-1&apos;</InlineCode>；为原始 ADC 编写的算法阈值不能直接照搬。</p>
            </section>

            <section id="serial" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading eyebrow="01 · Serial" title="串口管理不止是 open()">
                增强串口链负责端口筛选、波特率识别、连接锁、重试、断流状态、重扫、写串口和错误归一化。真实产品首次接入建议先手动指定端口，协议稳定后再启用自动连接。
              </SectionHeading>
              <dl className="mt-8 grid gap-x-10 md:grid-cols-2">{serialFeatures.map(([title, description]) => <div key={title} className="border-t border-[var(--line)] py-5"><dt className="font-semibold text-[var(--text-strong)]">{title}</dt><dd className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</dd></div>)}</dl>
              <div className="mt-6"><DocCodeBlock label="backend-demo.cjs · 手动连接" code={serialCode} /></div>
              <p className="mt-5 rounded-lg bg-[var(--surface-muted)] px-5 py-4 text-sm leading-6 text-[var(--text-muted)]">自动化测试使用 Fake Port；COM3、COM4 等真实端口仍需在目标 Windows / Linux 设备上验证。不要让主项目和本地 SDK 同时占用同一个串口。</p>
            </section>

            <section id="capture" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading eyebrow="02 · Capture" title="采集按通道限频并批量落盘">
                <InlineCode>serial</InlineCode> 模式保存每个有效帧；<InlineCode>custom</InlineCode> 模式按 1 到 200 Hz 采样。每个通道拥有独立采样时钟，停止采集和关闭会话前都会 flush 剩余批次。
              </SectionHeading>
              <div className="mt-8"><DocCodeBlock label="接续串口示例 · 采集片段" code={captureCode} /></div>
            </section>

            <section id="storage" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading eyebrow="03 · Storage" title="SQLite 与内存存储使用同一套接口">
                默认 <InlineCode>CaptureStore</InlineCode> 使用 SQLite WAL，并支持事务批写、分页、计数、时间/通道过滤和级联删除。测试或临时任务可以注入 <InlineCode>MemoryCaptureStore</InlineCode>，无需原生数据库依赖。
              </SectionHeading>
              <div className="mt-8"><DocCodeBlock label="backend-demo.cjs · 存储" code={storageCode} /></div>
              <p className="mt-5 border-l-4 border-[var(--warning-border)] bg-[var(--warning-soft)] px-5 py-4 text-sm leading-6 text-[var(--warning-text)]"><strong>SQLite 依赖：</strong><InlineCode>better-sqlite3</InlineCode> 是可选原生模块。安装失败时仍可使用内存存储，但不能实例化 <InlineCode>CaptureStore</InlineCode>。</p>
            </section>

            <section id="replay" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading eyebrow="04 · Replay" title="回放沿用采集帧的真实时间间隔">
                <InlineCode>ReplayPlayer</InlineCode> 提供播放、暂停、定位、逐帧、倍速和循环。启用 <InlineCode>applyAlgorithms</InlineCode> 后，历史帧会重新经过当前算法通道。
              </SectionHeading>
              <div className="mt-8"><DocCodeBlock label="接续存储示例 · 回放片段" code={replayCode} /></div>
              <p className="mt-5 rounded-lg bg-[var(--surface-muted)] px-5 py-4 text-sm leading-6 text-[var(--text-muted)]">回放对象使用 Backend Frame。由轻量 Device 采集的帧可通过 <InlineCode>backendFrameToCoreFrame()</InlineCode> 恢复为 <InlineCode>Uint8Array / Float32Array</InlineCode>，继续交给现有 Heatmap。</p>
            </section>

            <section id="csv" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading eyebrow="05 · CSV" title="从同一份存储按条件导出">
                支持按 capture、sensorType、channel 和时间区间筛选。数组与对象使用 JSON 字符串写入，不会改变传感点顺序；中英文表头可选。
              </SectionHeading>
              <div className="mt-8"><DocCodeBlock label="backend-demo.cjs · CSV 导出" code={csvCode} /></div>
            </section>

            <section id="algorithms" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading eyebrow="06 · Algorithms" title="简单算法位于 Frame 与采集之间">
                算法按注册顺序执行，结果写入 <InlineCode>frame.algorithmResults</InlineCode>。默认错误策略会隔离失败算法并继续串口链路，也可以切换为严格抛错模式。
              </SectionHeading>
              <div className="mt-8"><DocCodeBlock label="backend-demo.cjs · 同步算法通道" code={algorithmCode} /></div>
              <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">算法注册前先确认 <InlineCode>frame.valueScale</InlineCode>：串口 Profile 可能给出原始 ADC，Core Device 桥接固定标记为 <InlineCode>normalized-0-1</InlineCode>。</p>
              <div className="mt-5 border-l-4 border-[var(--warning-border)] bg-[var(--warning-soft)] px-5 py-4 text-sm leading-6 text-[var(--warning-text)]"><strong>运行边界：</strong>handler 必须同步、短耗时并返回可 JSON 序列化结果。Python 服务、GPU 推理和大模型调用应放在独立进程，通过队列或客户端对接，避免阻塞串口事件循环。</div>
            </section>
          </div>
        </article>

        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto border-l border-[var(--line)] px-5 py-8 2xl:block">
          <p className="mb-4 text-xs font-semibold text-[var(--text-subtle)]">本页目录</p>
          <DocsNavigation page="backend" compact />
        </aside>
      </div>

      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10"><div><p className="text-sm font-bold text-[var(--text-strong)]">Shroom Backend Preview</p><p className="mt-1 text-xs text-[var(--text-muted)]">本地 Node 能力，不是托管云服务。</p></div><nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--text-muted)]" aria-label="页脚导航"><Link href="/" className="hover:text-[var(--accent-strong)]">展示首页</Link><Link href="/sdk-overview" className="hover:text-[var(--accent-strong)]">SDK 功能页</Link><Link href="/docs" className="hover:text-[var(--accent-strong)]">基础文档</Link></nav><p className="text-xs text-[var(--text-muted)]">© 2026 Shroom</p></div>
      </footer>
    </main>
  );
}
