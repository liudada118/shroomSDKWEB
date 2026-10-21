'use client';

import { ReactNode, useMemo, useState } from 'react';
import Link from 'next/link';
import { useDownload } from './DownloadProvider';
import { DESKTOP_PLATFORMS, SDK_VARIANTS, SERIAL_DRIVERS } from './downloads';

// 手套体验站独立部署，不属于当前站点布局。
const GLOVE_LAB_URL = 'https://glove.jq-industries.io/';

// resources 里每一项都得有真实去处。之前是按下标硬编码 href（0→#docs、1→#downloads…），
// 结果「规格书」「Mapping JSON」这种还没有的东西也被指到一个页面上，点进去发现没有。
// 现在没有的就不列，列出来的都点得到。
const productFamilies = [
  {
    id: 'matrix',
    label: '矩阵压力传感器',
    code: 'MATRIX SERIES',
    description: '适用于压力分布、接触区域与动态载荷采集。',
    channels: '多通道矩阵',
    resources: [
      { label: '统一 SDK', href: '#downloads' },
      { label: '网页测试台', href: '/lab.html', external: true },
      { label: 'Shroom 上位机', href: '#desktop-downloads' },
      { label: '接入示例', href: '/docs/quick-start' },
    ],
  },
  {
    id: 'glove',
    label: '智能手套',
    code: 'GLOVE SERIES',
    description: '适用于手部压力、触觉交互与动作研究场景。',
    channels: '柔性点阵 · 双手',
    resources: [
      { label: '手套体验站', href: GLOVE_LAB_URL, external: true },
      { label: '统一 SDK', href: '#downloads' },
      { label: 'Shroom 上位机', href: '#desktop-downloads' },
      { label: '接入示例', href: '/docs/quick-start' },
    ],
  },
  {
    id: 'module',
    label: '通用采集模块',
    code: 'DAQ SERIES',
    description: '面向定制传感器与实验室原型的通用采集接入。',
    channels: '可配置通道',
    resources: [
      { label: '统一 SDK', href: '#downloads' },
      { label: '网页测试台', href: '/lab.html', external: true },
      { label: '协议与排错', href: '/docs/readme' },
      { label: '接入示例', href: '/docs/quick-start' },
    ],
  },
];

// 能力按实际语言与交付模块说明，与 sdk/AI-CONTEXT.md 保持一致。
const capabilities = [
  {
    index: '01',
    tag: 'DEVICE',
    title: '统一设备接入',
    description: '浏览器、Node 和 Python 支持基础串口直连；Node / 浏览器提供手套和手部检测垫快速方案，串联 WS、分区展示、标签录制与下载。',
    meta: ['串口直连', 'HTTP / WebSocket', '浏览器 / Node / Python'],
  },
  {
    index: '02',
    tag: 'DATA',
    title: '稳定数据解析',
    description: '从字节流切出一帧一帧并解码成统一结构。分隔符撞车切出的脏帧由帧长锁定挡掉，画面不会在方阵和横线之间闪。',
    meta: ['协议解析', '帧长锁定', '实时回调'],
  },
  {
    index: '03',
    tag: 'MOCK',
    title: '没有硬件也能开发',
    description: 'Shroom.mock() 生成的模拟设备与真实设备接口完全一致。界面先写完，设备到了改一行就切过去。',
    meta: ['模拟数据源', '接口一致', '先写界面后接设备'],
  },
  {
    index: '04',
    tag: 'VISUAL',
    title: '压力热图渲染',
    description: '浏览器内置手套五指、指腹、手掌分区视图与手垫热力图；指定数据源即可自动更新，也保留通用点阵、热斑和网格。',
    meta: ['三种画法', '可换配色', '按帧节流'],
  },
];

const skillSteps = [
  {
    number: '01',
    title: '把上下文发给 AI',
    description: '复制 AI-CONTEXT.md 全文，或把 SDK 文件夹放进项目让 AI 先读它。',
  },
  {
    number: '02',
    title: '描述设备与目标',
    description: '说明产品型号、数据用途和技术栈，不需要从零翻阅全部接口文档。',
  },
  {
    number: '03',
    title: '生成并验证接入',
    description: '由 AI 生成连接、读取和展示代码，没有设备就先用 Shroom.mock() 跑通。',
  },
];

const workflow = [
  { number: '01', title: '安装驱动与 SDK', description: '确认已购型号、左右手与技术栈，安装对应系统串口驱动，再下载 SDK 并安装依赖。' },
  { number: '02', title: '连接真实产品', description: '已支持的手套与手垫使用产品接口，协议和点位映射由 SDK 处理。' },
  { number: '03', title: '接入自己的程序', description: '订阅结构化产品数据，理解原始值、分区和矩阵，再接入业务处理。' },
  { number: '04', title: '验证连接与释放', description: '按指南处理连接异常、取消订阅和设备关闭，再按需要增加展示或录制。' },
];

// planned 为 true 的卡片渲染成不可点的灰态。宁可写「规划中」，
// 也不要挂一个指回本页的假链接 —— 那种链接点下去毫无反应，比明说没做更糟。
const tools = [
  {
    label: 'QUICK FLOW',
    title: '展示与采集示例',
    description: '先启动本机 Node 数据服务，再填写 WS 端口，一次跑通实时展示、标签录制与文件下载。',
    action: '打开完整示例',
    accent: 'bg-[#eff6ff] text-[#175cd3]',
    href: '/quick-start.html',
    external: true,
  },
  {
    label: 'WEB LAB',
    title: '网页测试台',
    description: '先安装系统串口驱动，再用 Chrome / Edge 连接设备，实时查看压力热图与原始数据。',
    action: '打开测试台',
    accent: 'bg-[#eff6ff] text-[#175cd3]',
    href: '/lab.html',
    external: true,
  },
  {
    label: 'GLOVE LAB',
    title: '触觉手套体验站',
    description: '双手触觉手套的完整采集端：力值热图与 3D 手部映射、陀螺仪、采集任务与回放、CSV 导出。独立部署，浏览器直连手套。',
    action: '打开手套体验站',
    accent: 'bg-[#f0f9ff] text-[#0369a1]',
    href: GLOVE_LAB_URL,
    external: true,
  },
  {
    label: 'AI SKILL',
    title: 'Shroom SDK Skill',
    description: '一份写给 AI 的上下文文件，让它掌握 SDK 的接口和能力边界，直接辅助生成接入代码。',
    action: '查看并复制给 AI',
    accent: 'bg-[#faf5ff] text-[#7e22ce]',
    href: '/docs/ai-context',
  },
  {
    label: 'MAPPING',
    title: '点位映射生成器',
    description: '导入点位表与线序信息，自动生成可复用的 Mapping JSON 配置。',
    action: '规划中',
    accent: 'bg-[#f0fdf4] text-[#15803d]',
    planned: true,
  },
  {
    label: 'ENGINEERING',
    title: '工程验证工具',
    description: '力学校定、公式推导、疲劳测试与温湿度耐受性测试。标定相关能力不随公开 SDK 发放。',
    action: '规划中',
    accent: 'bg-[#fff7ed] text-[#c2410c]',
    planned: true,
  },
];

const heroCode = `import { Shroom } from './node/index.js';
import { activateLicenseFromEnv } from './node/license-env.js';

// 先设置 SHROOM_LICENSE_KEY；辅助模块自动保存并复用本机安装标识。
await activateLicenseFromEnv();

const device = await Shroom.connectGlove({
  path: 'COM3', // 改为系统中实际识别的端口
  side: 'left', // 按实物确认左右手，右手使用 right
  // 已完成协议解析和映射，直接接入业务；ADC 不是物理压力单位。
  onData: (data) => console.log(data.fingers, data.palm),
  onError: (error) => console.error(error.code, error.message),
});
// 这是核心调用片段；完整错误恢复、断线与退出处理见接入教程。`;

const quickStartCode = `${heroCode}

// 结束使用时释放设备
process.once('SIGINT', async () => {
  await device.close();
});`;


// 页面上所有代码块都由这里染色，示例只写一份，不会出现几处 API 对不上的情况
const CODE_TOKEN = /(\/\/[^\n]*)|('[^']*')|\b(import|from|const)\b|\b(await)\b|\b([A-Za-z_$][\w$]*)(?=\()/g;
const TOKEN_CLASS = ['text-[#64748b]', 'text-[#86efac]', 'text-[#7dd3fc]', 'text-[#c4b5fd]', 'text-[#fde68a]'];

function highlight(code: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of code.matchAll(CODE_TOKEN)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(code.slice(last, start));
    const group = [1, 2, 3, 4, 5].find((index) => match[index] !== undefined) ?? 1;
    nodes.push(
      <span key={key++} className={TOKEN_CLASS[group - 1]}>
        {match[0]}
      </span>,
    );
    last = start + match[0].length;
  }
  if (last < code.length) nodes.push(code.slice(last));
  return nodes;
}

export default function Home() {
  const [activeProduct, setActiveProduct] = useState('matrix');
  const [activePlatform, setActivePlatform] = useState('windows');
  const [productQuery, setProductQuery] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const openGate = useDownload();

  const selectedPlatform = useMemo(
    () => DESKTOP_PLATFORMS.find((platform) => platform.id === activePlatform) ?? DESKTOP_PLATFORMS[0],
    [activePlatform],
  );
  const selectedProduct = useMemo(
    () => productFamilies.find((product) => product.id === activeProduct) ?? productFamilies[0],
    [activeProduct],
  );
  const matchedProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return productFamilies;
    return productFamilies.filter((product) =>
      `${product.label} ${product.code} ${product.description}`.toLowerCase().includes(q),
    );
  }, [productQuery]);

  async function copyCode() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(heroCode);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
    window.setTimeout(() => setCopyStatus('idle'), 2400);
  }


  return (
    <div className="home-page">
      <section id="top" className="home-hero scroll-mt-24">
        <div className="home-container">
          <section id="serial-drivers" className="home-driver-prerequisite scroll-mt-24" aria-labelledby="driver-prerequisite-title">
            <div>
              <p id="driver-prerequisite-title" className="home-driver-prerequisite-title">连接设备前，先安装串口驱动</p>
              <p className="home-driver-prerequisite-description">缺少可用驱动时，系统无法识别对应的 USB 串口，SDK 和上位机都无法读取设备。</p>
              <Link href="/docs/drivers" className="home-driver-prerequisite-guide">安装后重插设备并重启采集程序 · 查看安装指南 <span aria-hidden="true">→</span></Link>
            </div>
            <div className="home-driver-prerequisite-actions">
              {SERIAL_DRIVERS.map((driver) => (
                <a key={driver.id} href={driver.url} target="_blank" rel="noreferrer" className="home-button home-button-secondary">
                  {driver.label} 驱动 <span className="home-driver-format">{driver.format}</span><span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </section>
        </div>
        <div className="home-container home-hero-grid">
          <div className="home-hero-copy">
            <p className="home-eyebrow">SHROOM · 设备开发支持</p>
            <h1 className="home-hero-title">把设备数据，<span>接入你的应用。</span></h1>
            <p className="home-hero-description">选择已购设备与技术栈，用产品接口获取结构化数据，再接入自己的程序。</p>
            <div className="home-actions">
              <Link href="/docs/quick-start" className="home-button home-button-primary">开始集成设备 <span aria-hidden="true">→</span></Link>
              <a href="#downloads" className="home-button home-button-secondary">下载 SDK</a>
            </div>
            <p className="home-hero-note">手套与手垫提供产品级接口；Python 能力见对应指南。</p>
            <a href="#desktop-downloads" className="home-text-link">只需查看和调试数据？获取上位机 <span aria-hidden="true">→</span></a>
          </div>
          <div className="home-code-preview">
            <div className="home-code-header">
              <span>Node.js · 左手手套示例</span>
              <button type="button" onClick={copyCode} aria-label="复制设备接入示例">{copyStatus === 'copied' ? '已复制' : copyStatus === 'error' ? '复制失败' : '复制代码'}</button>
            </div>
            <pre><code>{highlight(heroCode)}</code></pre>
            <div className="home-code-caption" role="status" aria-live="polite">{copyStatus === 'error' ? '无法写入剪贴板，请手动选择代码并复制。' : copyStatus === 'copied' ? '代码已复制 · 串口和左右手按实际设备修改' : '串口按实际设备修改 · 数据通过 onData() 进入应用'}</div>
          </div>
        </div>
        <div className="home-process-strip">
          <ol className="home-container" aria-label="设备集成主路径">
            {['选择设备', '安装驱动与 SDK', '读取产品数据', '接入自己的应用'].map((step, index) => (
              <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>
            ))}
          </ol>
        </div>
      </section>

      <section id="products" className="scroll-mt-24 bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div className="max-w-xl">
              <p className="text-sm font-semibold text-[#2563eb]">第一步 · 选择产品</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">选择已购设备，找到接入资料。</h2>
              <p className="mt-5 leading-7 text-[#667085]">按产品系列查找 SDK、接入示例和诊断工具；具体型号与环境支持以对应指南为准。</p>
            </div>
            <label className="relative block">
              <span className="sr-only">搜索产品系列</span>
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#98a2b3]">⌕</span>
              <input
                type="search"
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
                placeholder="搜索产品系列，如 手套 / 矩阵 / DAQ"
                className="h-12 w-full rounded-xl border border-[#d0d5dd] bg-white pl-11 pr-4 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]"
              />
            </label>
          </div>

          {matchedProducts.length === 0 ? (
            <p className="mt-10 rounded-xl border border-[#eaecf0] bg-[#f9fafb] px-5 py-4 text-sm text-[#667085]">
              没有匹配「{productQuery}」的产品系列。清空搜索框可以看到全部三个系列。
            </p>
          ) : null}

          <div className="mt-10 grid gap-3 lg:grid-cols-3">
            {matchedProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setActiveProduct(product.id)}
                aria-pressed={activeProduct === product.id}
                className={`rounded-2xl border p-5 text-left transition ${activeProduct === product.id ? 'border-[#84adff] bg-[#eff4ff] shadow-[0_12px_30px_rgba(37,99,235,0.08)]' : 'border-[#e4e7ec] bg-white hover:border-[#b2ccff]'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl font-mono text-xs font-bold ${activeProduct === product.id ? 'bg-[#2563eb] text-white' : 'bg-[#f2f4f7] text-[#667085]'}`}>{product.label.slice(0, 1)}</span>
                  <span className="font-mono text-[9px] font-semibold tracking-[0.14em] text-[#98a2b3]">{product.code}</span>
                </div>
                <h3 className="mt-6 text-base font-semibold">{product.label}</h3>
                <p className="mt-2 text-xs leading-6 text-[#667085]">{product.description}</p>
              </button>
            ))}
          </div>

          <div className="relative mt-5 overflow-hidden rounded-2xl border border-[#d0d5dd] bg-[#0b1220] p-6 text-white sm:p-8">
            <div className="download-grid pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-15" />
            <div className="relative grid gap-7 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
              <div>
                <p className="font-mono text-[10px] tracking-[0.14em] text-[#84adff]">已选择 · {selectedProduct.code}</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{selectedProduct.label}</h3>
                <p className="mt-2 text-sm text-[#98a2b3]">{selectedProduct.channels} · 产品系列资源入口</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {selectedProduct.resources.map((resource, index) => (
                  <a
                    key={resource.label}
                    href={resource.href}
                    {...(resource.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                    className="rounded-xl border border-white/10 bg-white/[0.05] p-4 transition hover:border-[#2e90fa] hover:bg-white/10"
                  >
                    <span className="font-mono text-[9px] text-[#667085]">0{index + 1}</span>
                    <p className="mt-3 text-xs font-semibold text-[#e2e8f0]">
                      {resource.label}
                      {resource.external ? <span className="ml-1 text-[#84adff]">↗</span> : null}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="scroll-mt-24 border-t border-[#e4e7ec] bg-[#f8fafc] py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#2563eb]">SDK 能力中心</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">SDK 帮你处理哪些工作</h2>
            <p className="mt-5 max-w-xl leading-7 text-[#667085]">把重复的底层工作交给 SDK，让开发者专注于数据呈现、业务规则和产品体验。</p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {capabilities.map((capability) => (
              <article key={capability.index} className="group relative overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-[#b2ccff] hover:shadow-[0_18px_50px_rgba(16,24,40,0.08)] sm:p-8">
                <div className="flex items-start justify-between gap-5">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eff4ff] font-mono text-xs font-bold text-[#2563eb]">{capability.index}</span>
                  <span className="font-mono text-[10px] tracking-[0.14em] text-[#98a2b3]">{capability.tag}</span>
                </div>
                <h3 className="mt-7 text-xl font-semibold tracking-[-0.03em]">{capability.title}</h3>
                <p className="mt-3 max-w-lg text-sm leading-7 text-[#667085]">{capability.description}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {capability.meta.map((item) => (
                    <span key={item} className="rounded-md bg-[#f2f4f7] px-2.5 py-1.5 text-[11px] font-medium text-[#475467]">{item}</span>
                  ))}
                </div>
                <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-[#2563eb] transition-all duration-500 group-hover:w-full" />
              </article>
            ))}
          </div>

        </div>
      </section>

      <section id="skill" className="home-assist-section scroll-mt-24">
        <div className="home-container">
          <div className="home-assist-heading">
            <div>
              <p className="home-eyebrow">可选辅助 · SDK SKILL</p>
              <h2>让 AI 理解你的 SDK 上下文</h2>
              <p>将 SDK 中的 AI-CONTEXT.md 提供给 AI，辅助编写接入代码；生成结果仍需按指南验证。</p>
            </div>
            <Link href="/docs/ai-context" className="home-button home-button-secondary">查看 SDK Skill <span aria-hidden="true">→</span></Link>
          </div>
          <ol className="home-assist-steps">
            {skillSteps.map((step) => <li key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}
          </ol>
        </div>
      </section>

      <section id="downloads" className="scroll-mt-24 border-y border-[#e4e7ec] bg-[#f8fafc] py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[#2563eb]">SDK 与软件资源</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">SDK 按语言选择，上位机按平台下载。</h2>
              <p className="mt-5 leading-7 text-[#667085]">先按项目语言选择 SDK；只需要设备调试和数据查看时，再选择对应系统的上位机。</p>
            </div>
            <p className="text-xs text-[#98a2b3]">
              SDK 与 Windows / macOS / Linux 上位机均可下载，请按语言与平台选择
            </p>
          </div>

          <section id="serial-driver-details" className="home-driver-panel scroll-mt-24" aria-labelledby="serial-drivers-title">
            <div className="home-driver-intro">
              <p className="home-eyebrow">连接真实设备前</p>
              <h3 id="serial-drivers-title">先安装串口驱动</h3>
              <p>驱动是读取真实串口的前置条件。缺少匹配的驱动时，系统可能无法识别设备，SDK 和上位机都无法读取该串口。</p>
              <Link href="/docs/drivers" className="home-text-link">查看安装与串口排查指南 <span aria-hidden="true">→</span></Link>
            </div>
            <div className="home-driver-downloads">
              {SERIAL_DRIVERS.map((driver) => (
                <div key={driver.id}>
                  <a href={driver.url} target="_blank" rel="noreferrer" className="home-button home-button-secondary">下载 {driver.label} 串口驱动 <span className="home-driver-format">{driver.format}</span><span aria-hidden="true">↗</span></a>
                  <p>{driver.installNote}</p>
                </div>
              ))}
            </div>
            <ol className="home-driver-steps" aria-label="找不到串口时的处理顺序">
              <li>插入设备，检查系统串口列表</li>
              <li>无串口时，安装对应系统驱动</li>
              <li>重插设备并重启采集程序</li>
              <li>重新查询端口，再连接 SDK</li>
            </ol>
          </section>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {SDK_VARIANTS.map((variant) => (
              <article key={variant.source} aria-labelledby={`${variant.source}-title`} className="flex min-w-0 flex-col rounded-2xl border border-[#d0d5dd] bg-white p-6 sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#eff4ff] font-mono text-base font-bold text-[#175cd3]" aria-hidden="true">{variant.sdkLanguage === 'python' ? 'PY' : 'JS'}</span>
                  <span className="rounded-md border border-[#e4e7ec] px-2.5 py-1 font-mono text-xs text-[#667085]">v{variant.sdkVersion} · ZIP</span>
                </div>
                <h3 id={`${variant.source}-title`} className="mt-5 text-2xl font-semibold tracking-tight">{variant.label} SDK</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-[#344054]">{variant.description}</p>
                <p className="mt-4 flex-1 text-sm leading-7 text-[#667085]">{variant.details}</p>
                <p className="mt-5 border-t border-[#eaecf0] pt-4 text-xs leading-6 text-[#667085]">{variant.contents}</p>
                <div className="mt-5 flex flex-col gap-2 xl:flex-row xl:items-center xl:gap-4">
                  <button type="button" onClick={() => openGate(variant)} className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#175cd3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">下载 {variant.label} SDK</button>
                  <Link href={variant.guideHref} className="inline-flex min-h-11 items-center justify-center rounded-lg px-2 text-sm font-semibold text-[#175cd3] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">{variant.label} 使用指南 <span aria-hidden="true" className="ml-1">→</span></Link>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-4 text-sm leading-7 text-[#667085]">下载包包含源码、示例和 AI 接入指南，不包含上位机。Node.js 与 Python 的产品能力不同，请先查看对应指南中的环境与支持范围。</p>

          <div id="desktop-downloads" className="mt-12 scroll-mt-24">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[10px] font-semibold tracking-[0.15em] text-[#2563eb]">SHROOM DESKTOP</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Shroom 上位机与驱动</h3>
              </div>
              <p className="max-w-xl text-xs leading-6 text-[#667085]">按运行设备采集程序的电脑系统选择驱动；SDK 与上位机共用系统串口驱动。</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
            <div className="grid content-start grid-cols-2 gap-2 lg:grid-cols-1">
              {DESKTOP_PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => setActivePlatform(platform.id)}
                  aria-pressed={activePlatform === platform.id}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-semibold transition ${activePlatform === platform.id ? 'border-[#84adff] bg-white text-[#175cd3] shadow-sm' : 'border-transparent text-[#667085] hover:bg-white'}`}
                >
                  <span className={`grid h-8 w-8 place-items-center rounded-lg text-[11px] ${activePlatform === platform.id ? 'bg-[#eff4ff] text-[#2563eb]' : 'bg-[#eaecf0] text-[#667085]'}`}>
                    {platform.badge}
                  </span>
                  {platform.label}
                </button>
              ))}
            </div>

            <article className="relative min-h-[330px] overflow-hidden rounded-2xl border border-[#d0d5dd] bg-white p-7 shadow-[0_14px_40px_rgba(16,24,40,0.06)] sm:p-10">
              <div className="download-grid pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-60" />
              <div className="relative flex h-full flex-col">
                <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#2563eb]">SHROOM 上位机</p>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{selectedPlatform.label} 上位机</h3>
                <p className="mt-4 max-w-xl text-sm leading-7 text-[#667085]">{selectedPlatform.description}</p>
                <div className="mt-7 grid max-w-xl gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#eaecf0] bg-[#f9fafb] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">兼容环境</p>
                    <p className="mt-2 text-sm font-semibold text-[#344054]">{selectedPlatform.compatibility}</p>
                  </div>
                  <div className="rounded-xl border border-[#eaecf0] bg-[#f9fafb] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                      版本与体积
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#344054]">
                      v{selectedPlatform.version} · {selectedPlatform.sizeLabel} · {selectedPlatform.format}
                    </p>
                  </div>
                </div>

                <div className="mt-auto flex flex-col items-start gap-4 pt-8 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => openGate(selectedPlatform.target)}
                    className="rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#175cd3]"
                  >
                    下载 {selectedPlatform.label} 上位机 · {selectedPlatform.sizeLabel}
                  </button>
                  <a
                    href="/lab.html"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-[#175cd3] hover:underline"
                  >
                    先用网页测试台看数据 →
                  </a>
                </div>

                <p className="mt-5 rounded-lg border border-[#eaecf0] bg-white px-4 py-3 text-xs leading-6 text-[#667085]">
                  <span className="font-semibold text-[#344054]">安装提示：</span>{selectedPlatform.installNote}
                </p>
              </div>
            </article>
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[#fedf89] bg-[#fffaeb] px-5 py-4 text-sm sm:flex-row sm:items-start sm:justify-between">
            <p className="text-[#7a2e0e]">
              <span className="font-semibold">{selectedPlatform.label} 驱动与权限：</span>
              {selectedPlatform.driverNote}
            </p>
            <Link href="/docs/drivers" className="shrink-0 font-semibold text-[#b54708] hover:underline">查看驱动安装与排查 →</Link>
          </div>
        </div>
      </section>

      <section id="quick-start" className="scroll-mt-24 bg-[#0b1220] py-24 text-white sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#84adff]">标准集成路径</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">先完成产品取数，再接入自己的程序。</h2>
            <p className="mt-5 leading-7 text-[#98a2b3]">下面以 Node.js 手套接口为例。产品协议与映射由 SDK 处理，网页展示和文件录制按任务选用。</p>
            <Link href="/docs/quick-start" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#84adff] hover:underline">查看完整安装与接入指南 →</Link>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <ol className="grid gap-3">
              {workflow.map((step, index) => (
                <li key={step.number} className={`rounded-xl border p-5 ${index === 0 ? 'border-[#2e90fa] bg-[#102a56]' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="flex gap-4">
                    <span className={`font-mono text-xs font-bold ${index === 0 ? 'text-[#84adff]' : 'text-[#667085]'}`}>{step.number}</span>
                    <div>
                      <h3 className="text-sm font-semibold">{step.title}</h3>
                      <p className="mt-1.5 text-xs leading-6 text-[#98a2b3]">{step.description}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#070c14] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2 text-xs font-medium text-[#98a2b3]"><span className="h-2 w-2 rounded-full bg-[#12b76a]" /> device.mjs</div>
                <span className="font-mono text-[10px] text-[#667085]">Node.js</span>
              </div>
              <pre className="overflow-x-auto p-6 font-mono text-[12px] leading-7 text-[#cbd5e1] sm:p-8 sm:text-[13px]">
                <code>{highlight(quickStartCode)}</code>
              </pre>
              <div className="border-t border-white/10 bg-[#0d1524] px-6 py-4 font-mono text-[11px] text-[#86efac] sm:px-8">
                示例代码 · 实际端口、数据与运行结果以设备为准
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="web-lab" className="home-lab-section scroll-mt-24">
        <div className="home-container">
          <div className="home-assist-heading">
            <div>
              <p className="home-eyebrow">设备与环境诊断</p>
              <h2>用网页测试台检查设备数据</h2>
              <p>在支持 Web Serial 的 Chrome / Edge 中连接串口。安装、连接或无数据时，都可以进入诊断。</p>
            </div>
            <a href="/lab.html" target="_blank" rel="noreferrer" className="home-button home-button-secondary">打开测试台 <span aria-hidden="true">↗</span></a>
          </div>
          <details className="home-lab-preview">
            <summary>在本页展开测试台</summary>
            <iframe src="/lab.html" title="Shroom 网页测试台" allow="serial" loading="lazy" className="block h-[620px] w-full border-0 sm:h-[760px]" />
          </details>
        </div>
      </section>

      <section id="tools" className="scroll-mt-24 border-y border-[#e4e7ec] bg-[#f8fafc] py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#2563eb]">开发者工具箱</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">按任务选择展示、诊断与辅助工具。</h2>
            <p className="mt-5 leading-7 text-[#667085]">基础集成无需使用全部工具。诊断可随时进入，展示、采集和 AI 辅助按需选择；未开放工具单独标注。</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {tools.map((tool) => (
              <article
                key={tool.title}
                className={`rounded-2xl border p-7 transition sm:p-8 ${
                  tool.planned
                    ? 'border-dashed border-[#d0d5dd] bg-[#fcfcfd]'
                    : 'border-[#e4e7ec] bg-white hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(16,24,40,0.07)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-md px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.12em] ${tool.accent}`}>{tool.label}</span>
                  {tool.planned && (
                    <span className="inline-flex rounded-md bg-[#f2f4f7] px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-[#98a2b3]">
                      未开放
                    </span>
                  )}
                </div>
                <h3 className={`mt-6 text-xl font-semibold tracking-[-0.03em] ${tool.planned ? 'text-[#667085]' : ''}`}>{tool.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#667085]">{tool.description}</p>
                {tool.planned ? (
                  <span className="mt-7 inline-flex text-sm font-semibold text-[#98a2b3]">{tool.action}</span>
                ) : (
                  <a
                    href={tool.href}
                    {...(tool.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                    className="mt-7 inline-flex text-sm font-semibold text-[#175cd3] hover:underline"
                  >
                    {tool.action} <span className="ml-2">→</span>
                  </a>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="docs" className="scroll-mt-24 bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">文档中心</h2>
            <p className="mt-5 leading-7 text-[#667085]">从最小产品取数示例开始，把数据接入自己的程序。需要网页展示、采集文件或新协议适配时，再查看对应扩展；Python 使用独立基础指南。</p>
            <Link href="/docs" className="mt-7 inline-flex min-h-11 items-center rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#175cd3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">进入文档中心 <span aria-hidden="true" className="ml-2">→</span></Link>
          </div>
        </div>
      </section>

      {/* 试用密钥申请：SDK 已改为点击直接下载，这块先下线，等正式发放流程接好再启用
      <section id="trial" className="scroll-mt-24 bg-[#0b1220] py-24 text-white sm:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:px-10">
          <div>
            <p className="text-sm font-semibold text-[#84adff]">7 天试用密钥</p>
            <h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">准备好连接你的第一台设备了吗？</h2>
            <p className="mt-5 max-w-lg leading-7 text-[#98a2b3]">留下联系信息，我们将发送统一 SDK、Shroom Skill、对应系统的上位机与快速开始资料。</p>
            <div className="mt-8 grid gap-4 text-sm text-[#cbd5e1] sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <span className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#12326b] text-xs text-[#84adff]">✓</span>统一 SDK 与 Skill</span>
              <span className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#12326b] text-xs text-[#84adff]">✓</span>网页测试台权限</span>
              <span className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#12326b] text-xs text-[#84adff]">✓</span>Mapping 配置工具</span>
              <span className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#12326b] text-xs text-[#84adff]">✓</span>对应系统的上位机</span>
            </div>
          </div>

          <form onSubmit={submitTrial} className="rounded-2xl border border-white/10 bg-white p-6 text-[#101828] shadow-2xl sm:p-8">
            {submitted ? (
              <div className="grid min-h-[360px] place-items-center text-center">
                <div>
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#ecfdf3] text-xl font-bold text-[#039855]">✓</span>
                  <h3 className="mt-5 text-xl font-semibold">申请信息已记录</h3>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#667085]">这是页面结构演示，接入真实接口后即可自动发送试用密钥与下载资料。</p>
                  <button type="button" onClick={() => setSubmitted(false)} className="mt-6 text-sm font-semibold text-[#175cd3] hover:underline">返回表单</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#2563eb]">TRIAL ACCESS</p>
                    <h3 className="mt-2 text-xl font-semibold">申请开发者试用</h3>
                  </div>
                  <span className="rounded-full bg-[#ecfdf3] px-3 py-1.5 text-[10px] font-semibold text-[#027a48]">7 DAYS</span>
                </div>
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <label className="grid gap-2 text-xs font-semibold text-[#344054]">
                    姓名
                    <input required name="name" autoComplete="name" placeholder="怎么称呼你" className="h-11 rounded-lg border border-[#d0d5dd] px-3.5 text-sm font-normal outline-none transition placeholder:text-[#98a2b3] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]" />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold text-[#344054]">
                    手机号
                    <input required name="phone" autoComplete="tel" placeholder="用于接入沟通" className="h-11 rounded-lg border border-[#d0d5dd] px-3.5 text-sm font-normal outline-none transition placeholder:text-[#98a2b3] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]" />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold text-[#344054] sm:col-span-2">
                    邮箱
                    <input required type="email" name="email" autoComplete="email" placeholder="用于接收 SDK 与密钥" className="h-11 rounded-lg border border-[#d0d5dd] px-3.5 text-sm font-normal outline-none transition placeholder:text-[#98a2b3] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]" />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold text-[#344054] sm:col-span-2">
                    所在公司 / 学校 / 机构
                    <input required name="organization" autoComplete="organization" placeholder="请输入机构名称" className="h-11 rounded-lg border border-[#d0d5dd] px-3.5 text-sm font-normal outline-none transition placeholder:text-[#98a2b3] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]" />
                  </label>
                </div>
                <button type="submit" className="mt-6 w-full rounded-lg bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#175cd3]">申请 7 天试用密钥</button>
                <p className="mt-3 text-center text-[11px] leading-5 text-[#98a2b3]">提交即表示你同意我们仅将信息用于 SDK 试用与技术支持联系。</p>
              </>
            )}
          </form>
        </div>
      </section>
      */}

    </div>
  );
}
