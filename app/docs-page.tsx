import type { ReactNode } from 'react';
import Link from 'next/link';
import CodeSamples from './components/code-samples';
import DocsHeader from './components/docs-header';
import DocsNavigation from './components/docs-navigation';
import MockDemo from './components/mock-demo';
import { SDK_DOWNLOAD, SDK_VERSION } from './docs-data';

const frameCode = `interface Frame {
  raw: Uint8Array
  values: Float32Array
  rows: number
  cols: number
  min: number
  max: number
  avg: number
  area: number
  center: { x: number; y: number }
  timestamp: number
}`;

const frameFields = [
  ['raw', 'Uint8Array', '原始 ADC 字节，默认每个点为 0 到 255。'],
  ['values', 'Float32Array', '按 raw / fullScale 计算；默认 fullScale=255 时通常为 0 到 1，当前实现不截断。'],
  ['rows / cols', 'number', '矩阵行列数，非方阵建议显式配置。'],
  ['min / max / avg', 'number', '当前帧归一化值的最小、最大和平均值。'],
  ['area', 'number', '超过 threshold 的有效点数量。'],
  ['center', '{ x, y }', '按压力权重计算的归一化重心坐标。'],
  ['timestamp', 'number', '生成 Frame 时的 Date.now() 毫秒时间戳。'],
] as const;

const capabilities = [
  ['Web Serial 读取', '在 Chrome 或 Edge 中由用户选择串口，接收字节流。'],
  ['Node 串口读取', '通过 serialport 枚举和打开串口，适合 Node 或 Electron。'],
  ['统一 Frame', 'Web、Node 和 Mock 都通过 onFrame 返回相同的核心数据结构。'],
  ['Mock 数据源', '没有硬件时产生 32 × 32 等可配置矩阵，先开发业务层。'],
  ['基础可视化', '浏览器 Canvas heatmap 与 Node 终端 ASCII 渲染。'],
  ['切帧与解码', '支持自定义分隔符、帧长锁定、阈值和矩阵尺寸。'],
  ['本地后端采集', 'Node 后端子入口提供增强串口、限频采集、批量 flush 与稳定错误状态。'],
  ['存储与回放', '支持 SQLite / 内存存储、可控回放、CSV 导出和同步算法通道。'],
] as const;

const webMethods = [
  ['Shroom.connect(options?)', 'Promise<Device>', '请求串口权限并打开浏览器设备。'],
  ['Shroom.mock(options?)', 'Device', '创建定时输出 Frame 的模拟数据源。'],
  ['Shroom.createHeatmap(target, options?)', 'Heatmap', '为 Canvas 或选择器创建热力图渲染器。'],
  ['Shroom.isSupported()', 'boolean', '检查当前浏览器是否提供 Web Serial。'],
] as const;

const nodeMethods = [
  ['Shroom.connect(options?)', 'Promise<Device>', '打开指定串口；未传 path 时当前实现取列表中的第一个端口。'],
  ['Shroom.listPorts()', 'Promise<PortInfo[]>', '列出 serialport 可见的串口设备。'],
  ['Shroom.mock(options?)', 'Device', '在 Node 中创建模拟 Frame 数据源。'],
  ['Shroom.renderAscii(frame, options?)', 'string', '将 Frame 转换为终端字符热力图。'],
] as const;

const sharedDeviceMethods = [
  ['device.onFrame(handler)', '() => void', '订阅 Frame，并返回取消订阅函数。'],
  ['device.close()', 'Promise<void>', '关闭串口或 Mock 定时器并释放资源。'],
] as const;

const heatmapMethods = [
  ['heatmap.render(frame)', 'void', '把当前 Frame 绘制到 Canvas。'],
  ['heatmap.setOptions(options)', 'void', '更新 mode、colormap、gain、smooth 等显示选项。'],
  ['heatmap.resize()', 'void', '按当前 Canvas 尺寸刷新内部像素尺寸。'],
  ['heatmap.clear()', 'void', '清空当前 Canvas。'],
] as const;

const optionRows = [
  ['baudRate', '1_000_000', 'Web / Node 串口波特率。'],
  ['rows + cols', '自动推断', '自定义矩阵必须同时传入 rows 和 cols。'],
  ['fullScale', '255', '将 raw 转换为 values 时使用的满量程；应覆盖输入范围，当前实现不截断。'],
  ['threshold', '0.02', '计算 area 时使用的归一化阈值。'],
  ['delimiter', 'AA 55 03 99', '切分连续串口字节流的帧分隔符。'],
  ['minLength / maxLength', '8 / 8192', '允许的帧载荷长度范围。'],
  ['lockLength', 'true', '连续 3 帧长度一致后锁定；另一长度连续 12 帧时自动重锁。'],
] as const;

const compatibility = [
  ['Chrome / Edge', '已提供 Web Serial 接入', 'Web Serial、HTTPS 或 localhost、用户点击授权。'],
  ['Safari / Firefox', '真实串口不可用', '可运行 Mock，但当前不能通过网页连接真实串口。'],
  ['Node / Electron', '已提供 serialport 接入', 'Node 18+、ESM、安装 serialport 12。'],
  ['Node 后端子入口', '已提供本地采集链', 'CommonJS；运行 npm install；SQLite 需要可用的 better-sqlite3 原生模块。'],
  ['file:// 页面', '仅 Mock', 'ES Module 和真实 Web Serial 应通过本地服务器运行。'],
] as const;

const packageContents = [
  ['web/', 'Web Serial、Canvas heatmap 与浏览器示例'],
  ['node/', 'serialport 适配器、端口枚举与 ASCII 渲染'],
  ['core/', 'Frame、切帧器、Mock 与颜色映射'],
  ['backend/', '增强串口、采集、SQLite / 内存存储、回放、CSV、算法与类型声明'],
  ['types.d.ts + */index.d.ts', 'Web、Node、Core 与 Backend 子入口分别提供类型声明'],
  ['web/index.html', '可运行的浏览器 Mock 与设备示例'],
  ['README.md', '接入说明、参数说明和故障排查'],
] as const;

const limits = [
  ['数据语义', 'values 是相对 ADC 归一化值，不是 kPa、N 等物理压力单位。'],
  ['轻量 Core 默认协议范围', '默认一个字节对应一个传感点，仅按分隔符切帧，不含 CRC 或完整协议族；Node 后端另有多字节 ADC、手套组包与 Mapping Profile。'],
  ['轻量连接生命周期', 'Web / Node 轻量入口没有自动重连、连接状态事件或串口写命令；Node 后端子入口提供状态、写入、重试与显式重扫。'],
  ['产品工具链', '当前 ZIP 仍不含通用 Mapping 生成器、物理量标定、完整报告引擎、上位机安装包和安装式 Skill。'],
] as const;

const troubleshooting = [
  ['浏览器没有连接入口', '确认使用 Chrome 或 Edge，并通过 HTTPS 或 localhost 打开页面。'],
  ['浏览器不弹串口选择', '把 Shroom.connect() 放进用户点击回调，不要在页面加载时调用。'],
  ['Node 无法打开串口', '安装 serialport，核对串口 path、占用状态和系统权限。'],
  ['矩阵形状不正确', '同时传入 rows 与 cols；只传一个参数不会覆盖自动推断。'],
  ['一直收不到 Frame', '核对 baudRate、delimiter、帧长和设备实际输出格式。'],
  ['系统看不到 USB 串口', '部分 Windows 设备需 CH341SER 驱动，Linux 还需正确的串口组权限。'],
] as const;

function InlineCode({ children }: { children: ReactNode }) {
  return <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[0.86em] text-[var(--accent-strong)]">{children}</code>;
}

function SectionHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--text-strong)] sm:text-[2rem]">{title}</h2>
      <div className="mt-4 text-[15px] leading-7 text-[var(--text-muted)]">{children}</div>
    </div>
  );
}

function CodeBlock({ label, children }: { label: string; children: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#24344e] bg-[#09111f]">
      <div className="border-b border-white/10 px-5 py-3 font-mono text-[11px] text-[#8fa2bb]">{label}</div>
      <div className="overflow-x-auto p-5 sm:p-6">
        <pre className="min-w-[560px] font-mono text-[13px] leading-7 text-[#d7e2f0]"><code>{children}</code></pre>
      </div>
    </div>
  );
}

function MethodTable({ title, methods }: {
  title: string;
  methods: ReadonlyArray<readonly [string, string, string]>;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-[var(--text-strong)]">{title}</h3>
      <div className="mt-4 space-y-2">
        {methods.map(([signature, returns, description]) => (
          <div key={signature} className="rounded-lg bg-[var(--surface-muted)] p-4">
            <div className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:justify-between lg:gap-5">
              <code className="font-mono text-[13px] font-semibold text-[var(--accent-strong)]">{signature}</code>
              <code className="font-mono text-[11px] text-[var(--text-subtle)]">{returns}</code>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocsSidebar() {
  return (
    <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto border-r border-[var(--line)] bg-[var(--surface)] px-4 py-8 lg:block">
      <DocsNavigation />
    </aside>
  );
}

export default function DocsPage() {
  return (
    <main className="min-h-[100dvh] bg-[var(--page)] text-[var(--text)]">
      <a className="skip-link" href="#top">跳到主要内容</a>
      <DocsHeader />

      <div className="mx-auto grid max-w-[1500px] pt-16 lg:grid-cols-[248px_minmax(0,1fr)] 2xl:grid-cols-[248px_minmax(0,1fr)_220px]">
        <DocsSidebar />

        <article className="min-w-0 px-5 py-10 sm:px-8 sm:py-14 lg:px-10 xl:px-14">
          <div className="mx-auto max-w-4xl">
            <section id="top" tabIndex={-1} className="scroll-mt-24">
              <p className="text-sm text-[var(--text-muted)]">SDK 文档 / 概览</p>
              <h1 className="mt-4 max-w-3xl text-[clamp(2.35rem,5vw,3.75rem)] font-semibold leading-[1.06] tracking-[-0.055em] text-[var(--text-strong)]">
                Shroom Sensor SDK
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--text-muted)]">
                从串口字节流获得统一 Core Frame，再按需进入本地采集、存储、回放和导出链路。浏览器、Node/Electron 和 Mock 的连接适配器按运行环境选择。
              </p>

              <dl className="mt-8 grid gap-x-8 gap-y-5 border-y border-[var(--line)] py-6 sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-xs text-[var(--text-subtle)]">当前版本</dt><dd className="mt-1 font-mono text-sm font-semibold text-[var(--text-strong)]">{SDK_VERSION}</dd></div>
                <div><dt className="text-xs text-[var(--text-subtle)]">发布状态</dt><dd className="mt-1 text-sm font-semibold text-[var(--text-strong)]">技术预览</dd></div>
                <div><dt className="text-xs text-[var(--text-subtle)]">Node</dt><dd className="mt-1 font-mono text-sm font-semibold text-[var(--text-strong)]">18+ / ESM</dd></div>
                <div><dt className="text-xs text-[var(--text-subtle)]">Web Serial 入口</dt><dd className="mt-1 text-sm font-semibold text-[var(--text-strong)]">Chrome / Edge</dd></div>
              </dl>

              <div className="mt-7 border-l-4 border-[var(--warning-border)] bg-[var(--warning-soft)] px-5 py-4 text-sm leading-6 text-[var(--warning-text)]">
                <strong>数据边界：</strong>默认 <InlineCode>fullScale=255</InlineCode> 时，<InlineCode>values</InlineCode> 通常是 0 到 1 的相对 ADC 值，不代表 kPa、N 等物理单位。自定义满量程时当前实现不会截断，物理量仍需设备标定与换算。
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#quick-start" className="inline-flex min-h-11 items-center rounded-lg bg-[var(--accent-fill)] px-4 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-fill-hover)]">开始接入</a>
                <a href={SDK_DOWNLOAD} download className="inline-flex min-h-11 items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text-strong)] transition hover:border-[var(--focus)] hover:text-[var(--accent-strong)]">下载 ZIP</a>
                <a href="#frame" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--accent-strong)] hover:underline">查看 Frame 合同</a>
              </div>
            </section>

            <section id="products" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading title="先选择接入方式">
                同一套业务代码从 <InlineCode>device.onFrame()</InlineCode> 获取数据。不同入口只负责如何产生 Device。
              </SectionHeading>

              <div className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                {[
                  ['没有硬件', 'Mock', '先写热力图、业务界面或算法，不需要驱动和串口权限。', '#quick-start-mock'],
                  ['在网页中连接设备', 'Web Serial', '使用 Chrome 或 Edge，由用户点击授权串口。', '#quick-start-web'],
                  ['在应用或服务中连接', 'Node / Electron', '通过 serialport 读取设备，并可输出终端 ASCII 热力图。', '#quick-start-node'],
                  ['采集、存储与回放', 'Node Backend', '在本地 Node / Electron 进程中使用增强串口、SQLite、回放、CSV 和算法通道。', '/docs/backend#overview'],
                ].map(([title, runtime, description, href]) => (
                  <div key={title} className="grid gap-4 py-6 md:grid-cols-[170px_1fr_auto] md:items-center">
                    <div><h3 className="font-semibold text-[var(--text-strong)]">{title}</h3><p className="mt-1 font-mono text-xs text-[var(--accent-strong)]">{runtime}</p></div>
                    <p className="text-sm leading-6 text-[var(--text-muted)]">{description}</p>
                    {href.startsWith('/') ? (
                      <Link href={href} className="text-sm font-semibold text-[var(--accent-strong)] hover:underline">查看用法</Link>
                    ) : (
                      <a href={href} className="text-sm font-semibold text-[var(--accent-strong)] hover:underline">查看用法</a>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section id="quick-start" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading title="快速开始">
                下载包不是已发布的 npm 包。解压后先启动本地示例，再按运行环境选择代码。
              </SectionHeading>

              <ol className="mt-8 grid gap-6 sm:grid-cols-3">
                <li className="border-l-2 border-[var(--accent)] pl-4"><p className="text-sm font-semibold text-[var(--text-strong)]">下载并解压</p><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">获得 shroom-sdk 目录。</p></li>
                <li className="border-l-2 border-[var(--line)] pl-4"><p className="text-sm font-semibold text-[var(--text-strong)]">启动本地示例</p><p className="mt-2 font-mono text-sm text-[var(--accent-strong)]">node start.mjs</p></li>
                <li className="border-l-2 border-[var(--line)] pl-4"><p className="text-sm font-semibold text-[var(--text-strong)]">先验证第一帧</p><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">先用 Mock，再替换为真实连接。</p></li>
              </ol>

              <p className="mt-7 rounded-lg bg-[var(--surface-muted)] px-5 py-4 text-sm leading-6 text-[var(--text-muted)]">
                下方是核心 API 片段，不是独立 HTML 页面。完整浏览器示例运行 <InlineCode>node start.mjs</InlineCode>，完整终端 Mock 示例运行 <InlineCode>node node/demo.js</InlineCode>。
              </p>

              <CodeSamples />
            </section>

            <section id="capabilities" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading title="当前 SDK 已提供">
                以下能力都存在于当前下载 ZIP。路线图能力不会混在本节中。
              </SectionHeading>

              <dl className="mt-8 grid gap-x-10 md:grid-cols-2">
                {capabilities.map(([title, description]) => (
                  <div key={title} className="border-t border-[var(--line)] py-5">
                    <dt className="font-semibold text-[var(--text-strong)]">{title}</dt>
                    <dd className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 rounded-lg bg-[var(--surface-muted)] px-5 py-4 text-sm leading-6 text-[var(--text-muted)]">
                轻量层聚焦“连接数据源、获得 Core Frame、完成基础可视化”；Node 后端层继续提供采集、存储、回放、CSV 与同步算法。通用 Mapping 生成器、物理量标定和完整报告引擎仍属于后续工具链。
              </p>
            </section>

            <section id="web-lab" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading title="先用 Mock 验证数据流">
                下方只演示 Frame 的矩阵、统计值与显示增益。它不会请求串口，也不会把静态数字标成真实遥测。
              </SectionHeading>
              <MockDemo />
            </section>

            <section id="frame" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading title="一个 Frame 贯穿所有接入方式">
                无论数据来自 Web Serial、Node 串口还是 Mock，业务层都围绕下面的数据结构工作。
              </SectionHeading>

              <div className="mt-8 grid gap-7 xl:grid-cols-[0.92fr_1.08fr]">
                <CodeBlock label="Frame">{frameCode}</CodeBlock>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead><tr className="text-xs text-[var(--text-subtle)]"><th className="pb-3 pr-4 font-semibold">字段</th><th className="pb-3 pr-4 font-semibold">类型</th><th className="pb-3 font-semibold">含义</th></tr></thead>
                    <tbody>
                      {frameFields.map(([field, type, description]) => (
                        <tr key={field} className="border-t border-[var(--line)] align-top">
                          <td className="py-3 pr-4 font-mono text-xs font-semibold text-[var(--accent-strong)]">{field}</td>
                          <td className="py-3 pr-4 font-mono text-xs text-[var(--text-subtle)]">{type}</td>
                          <td className="py-3 leading-6 text-[var(--text-muted)]">{description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-7 border-l-4 border-[var(--accent)] bg-[var(--accent-soft)] px-5 py-4 text-sm leading-6 text-[var(--text)]">
                默认协议假设一个字节对应一个传感点。方阵可自动推断尺寸；其他矩阵应同时提供 <InlineCode>rows</InlineCode> 和 <InlineCode>cols</InlineCode>。不同字节宽度、CRC 或私有包格式需要单独适配。
              </div>
            </section>

            <section id="downloads" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading title="运行环境、兼容性与下载">
                Core、Frame 和 Mock 不绑定操作系统；真正访问串口时，仍需满足对应运行环境的能力、驱动和权限要求。
              </SectionHeading>

              <div className="mt-8 overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead><tr className="bg-[var(--surface-muted)] text-xs text-[var(--text-subtle)]"><th className="rounded-l-lg px-4 py-3 font-semibold">环境</th><th className="px-4 py-3 font-semibold">当前支持</th><th className="rounded-r-lg px-4 py-3 font-semibold">前置条件</th></tr></thead>
                  <tbody>
                    {compatibility.map(([runtime, support, condition]) => (
                      <tr key={runtime} className="border-b border-[var(--line)] align-top">
                        <td className="px-4 py-4 font-semibold text-[var(--text-strong)]">{runtime}</td>
                        <td className="px-4 py-4 text-[var(--accent-strong)]">{support}</td>
                        <td className="px-4 py-4 leading-6 text-[var(--text-muted)]">{condition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-5 text-sm leading-6 text-[var(--text-muted)]">
                这里表示仓库已经提供对应接入代码与运行要求，不代表所有操作系统、浏览器版本、芯片和设备组合都已完成真机兼容验证。正式发布前仍需补齐兼容矩阵。
              </p>

              <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_0.92fr]">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-strong)]">下载包内容</h3>
                  <dl className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                    {packageContents.map(([path, description]) => (
                      <div key={path} className="grid gap-1 py-3 sm:grid-cols-[130px_1fr]">
                        <dt className="font-mono text-xs font-semibold text-[var(--accent-strong)]">{path}</dt>
                        <dd className="text-sm leading-6 text-[var(--text-muted)]">{description}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
                  <p className="text-xs font-semibold text-[var(--text-subtle)]">Shroom SDK</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">v{SDK_VERSION} 技术预览</p>
                  <dl className="mt-6 space-y-3 text-sm">
                    <div className="flex justify-between gap-5"><dt className="text-[var(--text-muted)]">格式</dt><dd className="font-mono text-[var(--text-strong)]">ZIP</dd></div>
                    <div className="flex justify-between gap-5"><dt className="text-[var(--text-muted)]">大小</dt><dd className="font-mono text-[var(--text-strong)]">173,550 bytes</dd></div>
                    <div className="flex justify-between gap-5"><dt className="text-[var(--text-muted)]">许可</dt><dd className="font-mono text-[var(--warning-text)]">UNLICENSED</dd></div>
                  </dl>
                  <a href={SDK_DOWNLOAD} download className="mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--accent-fill)] px-4 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-fill-hover)]">下载 shroom-sdk.zip</a>
                  <p className="mt-4 break-all font-mono text-[10px] leading-5 text-[var(--text-subtle)]">SHA-256 DC804F0037C7C002C33099E3400DB6222C90A623327A13CBCA11BB090FD0BB9B</p>
                  <p className="mt-4 text-xs leading-5 text-[var(--warning-text)]">当前包未声明可公开复用的许可证。对外分发或商用前，请先确认授权范围。</p>
                </div>
              </div>
            </section>

            <section id="docs" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading title="API 参考">
                当前统一的是 Frame 与 Device 订阅模型。Web 和 Node facade 的连接参数、工具方法与诊断字段并不完全相同。
              </SectionHeading>

              <div className="mt-9 grid gap-10 xl:grid-cols-2">
                <MethodTable title="Web facade" methods={webMethods} />
                <MethodTable title="Node facade" methods={nodeMethods} />
              </div>

              <div className="mt-10 grid gap-10 border-t border-[var(--line)] pt-9 xl:grid-cols-2">
                <MethodTable title="Device 共同方法" methods={sharedDeviceMethods} />
                <MethodTable title="Heatmap 实例方法" methods={heatmapMethods} />
              </div>

              <p className="mt-7 rounded-lg bg-[var(--surface-muted)] px-5 py-4 text-sm leading-6 text-[var(--text-muted)]">
                诊断字段并不完全统一：浏览器串口 Device 提供 <InlineCode>bytesReceived</InlineCode>、<InlineCode>frameCount</InlineCode>、<InlineCode>droppedCount</InlineCode> 和 <InlineCode>frameLength</InlineCode>；Node 串口 Device 当前只提供 <InlineCode>droppedCount</InlineCode>；Mock Device 不提供这些串口诊断字段。
              </p>

              <p className="mt-4 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-5 py-4 text-sm leading-6 text-[var(--text)]">
                Node 后端类、采集参数和 Frame 适配器请查看 <Link href="/docs/backend#overview" className="font-semibold text-[var(--accent-strong)] hover:underline">后端与串口文档</Link>。该入口拥有独立的 <InlineCode>backend/index.d.ts</InlineCode>，不会改变 Web facade。
              </p>

              <div className="mt-10">
                <h3 className="text-lg font-semibold text-[var(--text-strong)]">连接与解码选项</h3>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead><tr className="text-xs text-[var(--text-subtle)]"><th className="pb-3 pr-4 font-semibold">选项</th><th className="pb-3 pr-4 font-semibold">默认值</th><th className="pb-3 font-semibold">说明</th></tr></thead>
                    <tbody>
                      {optionRows.map(([option, defaultValue, description]) => (
                        <tr key={option} className="border-t border-[var(--line)] align-top">
                          <td className="py-3 pr-4 font-mono text-xs font-semibold text-[var(--accent-strong)]">{option}</td>
                          <td className="py-3 pr-4 font-mono text-xs text-[var(--text-subtle)]">{defaultValue}</td>
                          <td className="py-3 leading-6 text-[var(--text-muted)]">{description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-9 rounded-lg bg-[var(--surface-muted)] px-5 py-4 text-sm leading-6 text-[var(--text-muted)]">
                Web、Node、Core 与 Backend 子入口已分别映射到独立类型声明；后端根入口的 84 个运行时导出也已纳入 TypeScript 导出契约测试。
              </div>
            </section>

            <section id="tools" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading title="已知限制与故障排查">
                文档先说明当前做不到什么，再给出第一次接入最常见的检查路径。
              </SectionHeading>

              <dl className="mt-8 grid gap-x-10 md:grid-cols-2">
                {limits.map(([title, description]) => (
                  <div key={title} className="border-t border-[var(--line)] py-5">
                    <dt className="font-semibold text-[var(--text-strong)]">{title}</dt>
                    <dd className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</dd>
                  </div>
                ))}
              </dl>

              <h3 className="mt-10 text-lg font-semibold text-[var(--text-strong)]">常见问题</h3>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead><tr className="bg-[var(--surface-muted)] text-xs text-[var(--text-subtle)]"><th className="rounded-l-lg px-4 py-3 font-semibold">现象</th><th className="rounded-r-lg px-4 py-3 font-semibold">优先检查</th></tr></thead>
                  <tbody>
                    {troubleshooting.map(([issue, check]) => (
                      <tr key={issue} className="border-b border-[var(--line)] align-top">
                        <td className="px-4 py-4 font-semibold text-[var(--text-strong)]">{issue}</td>
                        <td className="px-4 py-4 leading-6 text-[var(--text-muted)]">{check}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="skill" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading title="AI 辅助接入与 Shroom Skill">
                现在可以把真实 SDK 资料交给 Codex。安装式 Skill 与版本化 AI 问答仍在规划中。
              </SectionHeading>

              <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <div className="border-l-4 border-[var(--accent)] pl-5">
                  <p className="text-xs font-semibold text-[var(--accent-strong)]">当前可用</p>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">提供真实上下文</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">把 README、对应运行时入口、设备矩阵和目标展示方式一起提供给 Codex，再要求先用 Mock 验证。</p>
                  <div className="mt-5 space-y-2 font-mono text-xs text-[var(--text-strong)]">
                    <p>README.md</p>
                    <p>web/index.js 或 node/index.js</p>
                    <p>index.d.ts</p>
                    <p>目标 rows / cols / baudRate</p>
                  </div>
                </div>

                <div className="border-l-4 border-[var(--line)] pl-5">
                  <p className="text-xs font-semibold text-[var(--text-subtle)]">规划中，当前 ZIP 不包含</p>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">可安装的 Shroom Skill</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">计划把任务边界、API 差异、Frame 合同、协议说明、排错规则和可执行示例整理为版本化 Skill。</p>
                  <div className="mt-5 space-y-2 font-mono text-xs text-[var(--text-muted)]">
                    <p>SKILL.md</p>
                    <p>references/api.md</p>
                    <p>references/frame.md</p>
                    <p>examples/</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-lg bg-[var(--surface-muted)] px-5 py-4 text-sm leading-6 text-[var(--text-muted)]">
                同样属于规划中的还有通用产品 Profile 生成流程、Mapping Schema / 生成器、物理量标定、npm 正式发布、上位机安装包、曲线组件与完整报告引擎。采集、回放和 CSV 已进入 Node 后端预览。
              </div>
            </section>

            <footer className="mt-20 border-t border-[var(--line)] py-10 text-sm text-[var(--text-muted)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p>Shroom SDK 文档 · 当前事实源为本仓库 <InlineCode>sdk/</InlineCode></p>
                <div className="flex flex-wrap gap-5"><Link href="/" className="hover:text-[var(--accent-strong)]">返回展示首页</Link><a href="#top" className="hover:text-[var(--accent-strong)]">返回顶部</a><a href={SDK_DOWNLOAD} download className="font-semibold text-[var(--accent-strong)]">下载 SDK</a></div>
              </div>
            </footer>
          </div>
        </article>

        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto border-l border-[var(--line)] px-6 py-9 2xl:block">
          <p className="text-xs font-semibold text-[var(--text-strong)]">本页内容</p>
          <div className="mt-4"><DocsNavigation compact /></div>
          <div className="mt-8 border-t border-[var(--line)] pt-5 text-xs leading-5 text-[var(--text-subtle)]">
            <p>版本 {SDK_VERSION}</p>
            <p className="mt-1">技术预览</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
