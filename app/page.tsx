'use client';

import { ReactNode, useMemo, useState } from 'react';
import Link from 'next/link';
import { useDownload, useLicenseRequest } from './DownloadProvider';
import SdkInstall from './SdkInstall';
import { DESKTOP_PLATFORMS, SDK_VARIANTS, SERIAL_DRIVERS, SDK_SOURCE_URL } from './downloads';

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
    title: '一步拿到产品数据',
    description: '手套与手垫调用 readProduct()，直接收到产品数据。串口连接、产品协议和点位映射由 SDK 处理。',
    meta: ['readProduct()', '产品数据回调', 'Node.js / 浏览器'],
  },
  {
    index: '02',
    tag: 'DATA',
    title: '稳定数据解析',
    description: '将连续字节流解析为结构化数据，校验帧长，通过回调交给你的应用。',
    meta: ['协议解析', '帧长锁定', '实时回调'],
  },
  {
    index: '03',
    tag: 'RECORDING',
    title: '数据采集',
    description: '调用开始、停止和下载三个函数，按标签保存采集记录。SDK 自动存入 SQLite，需要时导出 CSV 或 JSONL。',
    meta: ['开始 / 停止采集', 'SQLite 存储', 'CSV / JSONL 下载'],
  },
  {
    index: '04',
    tag: 'VISUAL',
    title: '压力热图渲染',
    description: '浏览器内置手套五指、指腹、手掌分区视图与手垫热力图；指定数据源即可自动更新，也保留通用点阵、热斑和网格。',
    meta: ['三种画法', '可换配色', '按帧节流'],
  },
];

const heroCode = `import { readProduct } from 'shroom-sdk/quick-flow';

// 完成驱动、依赖和 SDK 授权后调用
let device; // 保留连接，结束使用时 await device.close()
try {
  device = await readProduct({
    product: 'glove', side: 'left', // 按实物选择左右手
    path: 'COM3', // 改为实际串口
    onData: data => console.log(data.fingers, data.palm),
    onError: error => console.error('运行异常', error),
  });
} catch (error) {
  console.error('取数失败', error); // 连接或配置错误
}`;


// 页面上所有代码块都由这里染色，示例只写一份，不会出现几处 API 对不上的情况
const CODE_TOKEN = /(\/\/[^\n]*)|('[^']*')|\b(import|from|const|let|try|catch)\b|\b(await)\b|\b([A-Za-z_$][\w$]*)(?=\()/g;
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
  const requestLicense = useLicenseRequest();

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
            <h1 className="home-hero-title">一步拿到<span>产品数据。</span></h1>
            <p className="home-hero-description">调用 <code>readProduct()</code>，直接收到解析好的产品数据。串口连接、协议解析和点位映射，SDK 帮你处理。</p>
            <div className="home-actions">
              <Link href="/docs/quick-start" className="home-button home-button-primary">查看一步取数 <span aria-hidden="true">→</span></Link>
              <a href="#downloads" className="home-button home-button-secondary">下载 SDK</a>
            </div>
            <p className="home-hero-note">先完成驱动、依赖和授权准备。手套与手垫支持此接口；Python 查看独立指南。</p>
            <a href="#desktop-downloads" className="home-text-link">只需查看和调试数据？获取上位机 <span aria-hidden="true">→</span></a>
          </div>
          <div className="home-code-preview">
            <div className="home-code-header">
              <span>一个函数，持续收到产品数据 · Node.js</span>
              <button type="button" onClick={copyCode} aria-label="复制设备接入示例">{copyStatus === 'copied' ? '已复制' : copyStatus === 'error' ? '复制失败' : '复制代码'}</button>
            </div>
            <pre><code>{highlight(heroCode)}</code></pre>
            <div className="home-code-caption" role="status" aria-live="polite">{copyStatus === 'error' ? '无法写入剪贴板，请手动选择代码并复制。' : copyStatus === 'copied' ? '代码已复制 · 串口和左右手按实际设备修改' : '串口按实际设备修改 · 数据通过 onData() 进入应用'}</div>
          </div>
        </div>
        <div className="home-process-strip">
          <ol className="home-container" aria-label="设备集成主路径">
            {['安装驱动与 SDK', '完成授权', '调用 readProduct()', '收到产品数据'].map((step, index) => (
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

      <section id="downloads" className="scroll-mt-24 border-y border-[#e4e7ec] bg-[#f8fafc] py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[#2563eb]">SDK 与软件资源</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">SDK 按语言选择，上位机按平台下载。</h2>
              <p className="mt-5 leading-7 text-[#667085]">开发自己的应用，选择 SDK；直接查看和调试设备，选择上位机。</p>
            </div>
            <Link href="/docs" className="home-text-link shrink-0">已下载？进入文档中心 <span aria-hidden="true">→</span></Link>
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
                  <span className="rounded-md border border-[#e4e7ec] px-2.5 py-1 font-mono text-xs text-[#667085]">v{variant.sdkVersion} · {variant.sdkLanguage === 'node' ? 'npm' : 'ZIP'}</span>
                </div>
                <h3 id={`${variant.source}-title`} className="mt-5 text-2xl font-semibold tracking-tight">{variant.sdkLanguage === 'node' ? 'JavaScript / TypeScript' : variant.label} SDK</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-[#344054]">{variant.description}</p>
                <p className="mt-4 flex-1 text-sm leading-7 text-[#667085]">{variant.details}</p>
                <p className="mt-5 border-t border-[#eaecf0] pt-4 text-xs leading-6 text-[#667085]">{variant.contents}</p>
                {variant.sdkLanguage === 'node' && <div className="mt-4"><SdkInstall /></div>}
                <div className="mt-5 flex flex-col gap-2 xl:flex-row xl:items-center xl:gap-4">
                  <button type="button" onClick={() => openGate(variant)} className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] ${variant.sdkLanguage === 'node' ? 'border border-[#d0d5dd] bg-white text-[#344054] hover:bg-[#f8fafc]' : 'bg-[#2563eb] text-white hover:bg-[#175cd3]'}`}>{variant.sdkLanguage === 'node' ? '下载安装包' : '下载 Python SDK'}</button>
                  <Link href={variant.guideHref} className="inline-flex min-h-11 items-center justify-center rounded-lg px-2 text-sm font-semibold text-[#175cd3] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">{variant.label} 使用指南 <span aria-hidden="true" className="ml-1">→</span></Link>
                  <a href={SDK_SOURCE_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg px-2 text-sm text-[#475467] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">查看源码 ↗</a>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d0d5dd] bg-white px-5 py-4">
            <p className="text-sm leading-6 text-[#475467]">SDK 可直接安装和下载。连接真实设备前，需要 Shroom SDK 产品密钥。</p>
            <button type="button" onClick={requestLicense} className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-4 py-2 text-sm font-semibold text-[#175cd3] hover:bg-[#eff4ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">申请 SDK 密钥 →</button>
          </div>

          <div id="desktop-downloads" className="mt-12 scroll-mt-24">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[10px] font-semibold tracking-[0.15em] text-[#2563eb]">SHROOM DESKTOP</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Shroom 上位机</h3>
              </div>
              <p className="max-w-xl text-xs leading-6 text-[#667085]">按使用上位机的电脑系统选择安装包。</p>
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

      <section id="docs" className="home-docs-section scroll-mt-24 bg-white" aria-labelledby="home-docs-title">
        <div className="home-container">
          <div className="home-assist-heading">
            <div>
              <p className="home-eyebrow">下载之后 · 开始接入</p>
              <h2 id="home-docs-title">文档中心</h2>
              <p>先用一个函数拿到产品数据。需要网页传输、采集或下载时，再继续后续调用。</p>
            </div>
            <Link href="/docs" className="home-button home-button-primary">进入文档中心 <span aria-hidden="true">→</span></Link>
          </div>
          <div className="home-docs-links">
            <Link id="quick-start" href="/docs/quick-start" className="home-docs-link scroll-mt-24">
              <span className="home-eyebrow">JAVASCRIPT / TYPESCRIPT</span>
              <h3>一步拿数据</h3>
              <p>调用 readProduct()，通过 onData 接收产品数据。</p>
              <span className="home-docs-action">开始接入 <span aria-hidden="true">→</span></span>
            </Link>
            <Link id="skill" href="/docs/ai-context" className="home-docs-link scroll-mt-24">
              <span className="home-eyebrow">AI 接入指南</span>
              <h3>让 AI 帮你接入</h3>
              <p>先完成取数，再按需扩展采集与下载。</p>
              <span className="home-docs-action">查看并复制给 AI <span aria-hidden="true">→</span></span>
            </Link>
            <Link href="/docs/backend?language=python" className="home-docs-link">
              <span className="home-eyebrow">PYTHON</span>
              <h3>Python 接入</h3>
              <p>基础串口与逐帧读取；不提供五步函数。</p>
              <span className="home-docs-action">查看 Python 指南 <span aria-hidden="true">→</span></span>
            </Link>
          </div>
          <p className="home-docs-extension">需要保存数据？继续查看 <Link href="/docs/quick-start#flow-ws">创建 WS → 开始采集 → 停止采集 → 下载 <span aria-hidden="true">→</span></Link></p>
          <nav id="tools" className="home-docs-tools scroll-mt-24" aria-label="辅助开发工具">
            <span>辅助工具</span>
            <a id="web-lab" href="/lab.html" target="_blank" rel="noreferrer" className="home-text-link scroll-mt-24">网页测试台 <span aria-hidden="true">↗</span></a>
            <a href={GLOVE_LAB_URL} target="_blank" rel="noreferrer" className="home-text-link">手套体验站 <span aria-hidden="true">↗</span></a>
            <Link href="/docs/ai-guide" className="home-text-link">如何向 AI 描述需求 <span aria-hidden="true">→</span></Link>
          </nav>
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
