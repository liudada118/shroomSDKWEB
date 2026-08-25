'use client';

import { FormEvent, useMemo, useState } from 'react';

const navItems = [
  { label: '选择产品', href: '#products' },
  { label: '产品能力', href: '#capabilities' },
  { label: 'SDK 下载', href: '#downloads' },
  { label: '快速开始', href: '#quick-start' },
  { label: '开发工具', href: '#tools' },
  { label: '文档中心', href: '#docs' },
];

const productFamilies = [
  {
    id: 'matrix',
    label: '矩阵压力传感器',
    code: 'MATRIX SERIES',
    description: '适用于压力分布、接触区域与动态载荷采集。',
    channels: '多通道矩阵',
    resources: ['规格书', 'SDK', '网页测试', 'Mapping JSON'],
  },
  {
    id: 'glove',
    label: '智能手套',
    code: 'GLOVE SERIES',
    description: '适用于手部压力、触觉交互与动作研究场景。',
    channels: '柔性点阵',
    resources: ['规格书', 'SDK', '示例工程', 'Mapping JSON'],
  },
  {
    id: 'module',
    label: '通用采集模块',
    code: 'DAQ SERIES',
    description: '面向定制传感器与实验室原型的通用采集接入。',
    channels: '可配置通道',
    resources: ['协议说明', 'SDK', '串口工具', '示例工程'],
  },
];

const capabilities = [
  {
    index: '01',
    tag: 'DEVICE',
    title: '统一设备接入',
    description: '将 USB 串口驱动、设备发现与连接状态封装为一致接口，减少不同系统间的适配工作。',
    meta: ['串口通信', '设备发现', '异常重连'],
  },
  {
    index: '02',
    tag: 'DATA',
    title: '稳定数据解析',
    description: '从原始字节流到结构化传感帧，提供校验、缓存和回调机制，快速进入业务开发。',
    meta: ['协议解析', '数据校验', '实时回调'],
  },
  {
    index: '03',
    tag: 'MAPPING',
    title: 'Mapping 配置',
    description: '把线序与传感点位映射为 JSON 配置，统一硬件布局与前端展示的数据坐标。',
    meta: ['点位映射', 'JSON 导出', '配置复用'],
  },
  {
    index: '04',
    tag: 'VISUAL',
    title: '可视化调试',
    description: '在浏览器中实时查看压力与通道数据，先验证设备与协议，再进入正式集成。',
    meta: ['实时曲线', '压力热图', 'CSV 下载'],
  },
];

const platforms = [
  {
    id: 'windows',
    label: 'Windows',
    badge: 'W',
    eyebrow: '桌面端',
    title: 'Windows SDK',
    description: '覆盖 Windows 10+，并为 Windows 7 部署环境保留独立兼容包。',
    compatibility: 'Windows 7 / 10 / 11',
    packageName: 'EXE · SDK · 示例工程',
    command: 'shroom-sdk-windows.zip',
  },
  {
    id: 'macos',
    label: 'macOS',
    badge: 'M',
    eyebrow: '桌面端',
    title: 'macOS SDK',
    description: '面向 Apple Silicon 与 Intel 开发环境，提供统一设备访问层。',
    compatibility: 'Apple Silicon / Intel',
    packageName: 'PKG · SDK · 示例工程',
    command: 'shroom-sdk-macos.zip',
  },
  {
    id: 'linux',
    label: 'Linux',
    badge: 'L',
    eyebrow: '嵌入式 / 桌面端',
    title: 'Linux SDK',
    description: '适合工作站、边缘设备与自动化测试环境，支持脚本化集成。',
    compatibility: 'x64 / ARM64',
    packageName: 'TAR.GZ · SDK · 示例工程',
    command: 'shroom-sdk-linux.tar.gz',
  },
  {
    id: 'browser',
    label: '浏览器',
    badge: 'B',
    eyebrow: 'Web 测试',
    title: 'Browser SDK',
    description: '无需安装完整客户端，在 Chrome 或 Edge 中完成设备连接与数据验证。',
    compatibility: 'Chrome / Edge',
    packageName: 'NPM · DEMO · API',
    command: 'npm install @shroom/sdk',
  },
];

const workflow = [
  {
    number: '01',
    title: '选择环境',
    description: '下载与你的操作系统和运行架构匹配的 SDK。',
  },
  {
    number: '02',
    title: '连接设备',
    description: '通过统一接口发现串口设备并建立稳定连接。',
  },
  {
    number: '03',
    title: '加载 Mapping',
    description: '导入 JSON 点位映射，让通道数据对应真实布局。',
  },
  {
    number: '04',
    title: '构建应用',
    description: '订阅实时数据，并接入你的可视化或业务逻辑。',
  },
];

const tools = [
  {
    label: 'WEB LAB',
    title: '网页测试台',
    description: '在 Chrome / Edge 中连接设备，实时查看通道、压力热图与原始数据。',
    action: '打开测试台',
    accent: 'bg-[#eff6ff] text-[#175cd3]',
  },
  {
    label: 'MAPPING',
    title: '点位映射生成器',
    description: '导入点位表与线序信息，自动生成可复用的 Mapping JSON 配置。',
    action: '生成 Mapping',
    accent: 'bg-[#f0fdf4] text-[#15803d]',
  },
  {
    label: 'AI SKILL',
    title: 'AI 开发 Skill',
    description: '让 AI 理解串口协议与 SDK 接口，辅助生成采集、解析和展示代码。',
    action: '查看使用方式',
    accent: 'bg-[#faf5ff] text-[#7e22ce]',
  },
  {
    label: 'ENGINEERING',
    title: '工程验证工具',
    description: '集中提供力学校定、公式推导、疲劳测试与温湿度耐受性测试入口。',
    action: '浏览全部工具',
    accent: 'bg-[#fff7ed] text-[#c2410c]',
  },
];

const resources = [
  { type: 'GUIDE', title: '5 分钟快速开始', description: '完成安装、连接设备并读取第一帧数据。' },
  { type: 'REFERENCE', title: 'SDK API 参考', description: '按模块查阅设备、数据与 Mapping 接口。' },
  { type: 'EXAMPLE', title: '示例项目', description: '从最小 Demo 到完整可视化应用的参考实现。' },
];

const heroCode = `import { Shroom } from '@shroom/sdk'

const device = await Shroom.connect()

device.on('pressure', (frame) => {
  heatmap.render(frame.values)
})`;

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState('matrix');
  const [activePlatform, setActivePlatform] = useState('windows');
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selectedPlatform = useMemo(
    () => platforms.find((platform) => platform.id === activePlatform) ?? platforms[0],
    [activePlatform],
  );
  const selectedProduct = useMemo(
    () => productFamilies.find((product) => product.id === activeProduct) ?? productFamilies[0],
    [activeProduct],
  );

  async function copyCode() {
    await navigator.clipboard?.writeText(heroCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function submitTrial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-white text-[#101828]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#eaecf0] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <a href="#top" className="flex items-center gap-3" aria-label="Shroom Developer 首页">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#2563eb] text-sm font-black text-white shadow-[0_8px_22px_rgba(37,99,235,0.28)]">
              S
            </span>
            <span className="text-[15px] font-bold tracking-[-0.02em]">
              Shroom <span className="font-medium text-[#667085]">Developer</span>
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-medium text-[#475467] lg:flex" aria-label="主导航">
            {navItems.map((item) => (
              <a key={item.href} className="transition hover:text-[#175cd3]" href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <a
              href="#docs"
              className="hidden rounded-lg border border-[#d0d5dd] bg-white px-4 py-2 text-sm font-semibold text-[#344054] shadow-sm transition hover:border-[#84adff] hover:text-[#175cd3] sm:inline-flex"
            >
              查看文档
            </a>
            <a
              href="#downloads"
              className="hidden rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#175cd3] sm:inline-flex"
            >
              获取 SDK
            </a>
            <button
              type="button"
              aria-label="打开导航"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              className="grid h-10 w-10 place-items-center rounded-lg border border-[#d0d5dd] lg:hidden"
            >
              <span className="flex w-4 flex-col gap-1.5" aria-hidden="true">
                <span className="h-px w-full bg-[#344054]" />
                <span className="h-px w-full bg-[#344054]" />
                <span className="h-px w-full bg-[#344054]" />
              </span>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-t border-[#eaecf0] bg-white px-5 py-4 shadow-lg lg:hidden" aria-label="移动端导航">
            <div className="mx-auto grid max-w-7xl gap-1">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-3 text-sm font-medium text-[#344054] hover:bg-[#f2f4f7]"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      <section id="top" className="relative scroll-mt-24 overflow-hidden bg-white pt-[72px]">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-70" />
        <div className="pointer-events-none absolute left-1/2 top-[-420px] h-[760px] w-[1100px] -translate-x-1/2 rounded-full bg-[#e9f2ff] blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-20 sm:px-8 sm:pt-24 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:pb-28 lg:pt-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#b2ccff] bg-[#eff4ff] px-3 py-1.5 text-xs font-semibold text-[#175cd3]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2e90fa] shadow-[0_0_0_4px_rgba(46,144,250,0.12)]" />
              Shroom SDK 开发者套件
            </div>
            <h1 className="max-w-3xl text-[clamp(2.75rem,6vw,5rem)] font-semibold leading-[1.02] tracking-[-0.06em] text-[#101828]">
              让硬件数据，
              <span className="text-[#2563eb]">更快抵达应用。</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-[#667085] sm:text-lg">
              从串口采集、数据映射到可视化调试，一套 SDK 覆盖 Windows、macOS、Linux 与浏览器，帮助团队快速完成二次开发。
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#products"
                className="inline-flex items-center justify-center rounded-xl bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5 hover:bg-[#175cd3]"
              >
                选择我的产品 <span aria-hidden="true" className="ml-2">→</span>
              </a>
              <a
                href="#trial"
                className="inline-flex items-center justify-center rounded-xl border border-[#d0d5dd] bg-white px-5 py-3 text-sm font-semibold text-[#344054] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f9fafb]"
              >
                在线测试设备
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium text-[#667085]">
              <span className="flex items-center gap-2"><span className="text-[#12b76a]">●</span> 统一跨平台 API</span>
              <span className="flex items-center gap-2"><span className="text-[#12b76a]">●</span> 完整示例工程</span>
              <span className="flex items-center gap-2"><span className="text-[#12b76a]">●</span> 7 天试用密钥</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px]">
            <div className="absolute -inset-5 rounded-[32px] bg-gradient-to-br from-[#dbeafe] via-[#eef2ff] to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-[#d9e2f2] bg-[#0b1220] shadow-[0_30px_70px_rgba(16,24,40,0.18)]">
              <div className="flex h-12 items-center justify-between border-b border-white/10 px-5">
                <div className="flex gap-2" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#fb7185]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
                </div>
                <span className="font-mono text-[11px] text-[#94a3b8]">quick-start.ts</span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="rounded-md border border-white/10 px-2.5 py-1 font-mono text-[10px] text-[#cbd5e1] transition hover:bg-white/10"
                >
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
              <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-7 text-[#cbd5e1] sm:p-8 sm:text-sm">
                <code><span className="text-[#7dd3fc]">import</span> {'{ Shroom }'} <span className="text-[#7dd3fc]">from</span> <span className="text-[#86efac]">&apos;@shroom/sdk&apos;</span>{'\n\n'}<span className="text-[#7dd3fc]">const</span> device = <span className="text-[#c4b5fd]">await</span> Shroom.<span className="text-[#fde68a]">connect</span>(){'\n\n'}device.<span className="text-[#fde68a]">on</span>(<span className="text-[#86efac]">&apos;pressure&apos;</span>, (frame) =&gt; {'{'}{'\n'}  heatmap.<span className="text-[#fde68a]">render</span>(frame.values){'\n'}{'}'})</code>
              </pre>
              <div className="grid grid-cols-3 border-t border-white/10 bg-white/[0.03] px-6 py-4 text-xs text-[#94a3b8] sm:px-8">
                <span>连接设备</span>
                <span className="text-center">解析数据</span>
                <span className="text-right">实时回调</span>
              </div>
            </div>
            <div className="absolute -bottom-8 -left-8 hidden rounded-xl border border-[#d0d5dd] bg-white p-4 shadow-[0_18px_45px_rgba(16,24,40,0.12)] sm:block">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#ecfdf3] text-sm font-bold text-[#039855]">✓</span>
                <div>
                  <p className="text-xs font-semibold text-[#344054]">Device connected</p>
                  <p className="mt-0.5 font-mono text-[10px] text-[#98a2b3]">CH340 · 115200 baud</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#eaecf0] bg-[#f8fafc]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <p className="text-sm font-medium text-[#667085]">一次接入，覆盖你的开发环境</p>
          <div className="flex flex-wrap gap-2.5">
            {platforms.map((platform) => (
              <span key={platform.id} className="flex items-center gap-2 rounded-lg border border-[#e4e7ec] bg-white px-3.5 py-2 text-xs font-semibold text-[#475467] shadow-sm">
                <span className="grid h-5 w-5 place-items-center rounded bg-[#f2f4f7] text-[9px] text-[#667085]">{platform.badge}</span>
                {platform.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="products" className="scroll-mt-24 bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div className="max-w-xl">
              <p className="text-sm font-semibold text-[#2563eb]">第一步 · 选择产品</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">先找到设备，再加载专属资源。</h2>
              <p className="mt-5 leading-7 text-[#667085]">选择已购买的产品系列，页面将集中展示对应规格书、驱动、SDK、示例和测试工具。</p>
            </div>
            <label className="relative block">
              <span className="sr-only">搜索产品型号</span>
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#98a2b3]">⌕</span>
              <input
                type="search"
                placeholder="输入产品型号或序列号（结构预留）"
                className="h-12 w-full rounded-xl border border-[#d0d5dd] bg-white pl-11 pr-4 text-sm outline-none transition placeholder:text-[#98a2b3] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]"
              />
            </label>
          </div>

          <div className="mt-10 grid gap-3 lg:grid-cols-3">
            {productFamilies.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setActiveProduct(product.id)}
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
                <p className="mt-2 text-sm text-[#98a2b3]">{selectedProduct.channels} · 选择具体型号后可继续筛选版本</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {selectedProduct.resources.map((resource, index) => (
                  <a
                    key={resource}
                    href={index === 1 ? '#downloads' : index === 2 ? '#quick-start' : '#docs'}
                    className="rounded-xl border border-white/10 bg-white/[0.05] p-4 transition hover:border-[#2e90fa] hover:bg-white/10"
                  >
                    <span className="font-mono text-[9px] text-[#667085]">0{index + 1}</span>
                    <p className="mt-3 text-xs font-semibold text-[#e2e8f0]">{resource}</p>
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
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">从设备接入到应用上线，路径更短。</h2>
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
              <p className="text-sm font-semibold text-[#2563eb]">跨平台下载</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">选择环境，立即开始。</h2>
              <p className="mt-5 leading-7 text-[#667085]">每个版本都包含 SDK、快速开始指南和可直接运行的示例工程。</p>
            </div>
            <p className="text-xs text-[#98a2b3]">版本号与下载文件将在发布时由后台接入</p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[260px_1fr]">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => setActivePlatform(platform.id)}
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
                <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#2563eb]">{selectedPlatform.eyebrow}</p>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{selectedPlatform.title}</h3>
                <p className="mt-4 max-w-xl text-sm leading-7 text-[#667085]">{selectedPlatform.description}</p>
                <div className="mt-7 grid max-w-xl gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#eaecf0] bg-[#f9fafb] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">兼容环境</p>
                    <p className="mt-2 text-sm font-semibold text-[#344054]">{selectedPlatform.compatibility}</p>
                  </div>
                  <div className="rounded-xl border border-[#eaecf0] bg-[#f9fafb] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">资源内容</p>
                    <p className="mt-2 text-sm font-semibold text-[#344054]">{selectedPlatform.packageName}</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-col items-start gap-4 pt-8 sm:flex-row sm:items-center">
                  <a href="#trial" className="rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#175cd3]">
                    获取 {selectedPlatform.label} 版本
                  </a>
                  <code className="rounded-md bg-[#f2f4f7] px-3 py-2 font-mono text-[11px] text-[#475467]">{selectedPlatform.command}</code>
                </div>
              </div>
            </article>
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[#fedf89] bg-[#fffaeb] px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[#7a2e0e]"><span className="font-semibold">Windows 串口驱动：</span>部署前可先安装 CH341SER 通用驱动并确认设备端口。</p>
            <a href="#docs" className="shrink-0 font-semibold text-[#b54708] hover:underline">查看驱动说明 →</a>
          </div>
        </div>
      </section>

      <section id="quick-start" className="scroll-mt-24 bg-[#0b1220] py-24 text-white sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#84adff]">快速开始</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">四步完成第一次数据读取。</h2>
            <p className="mt-5 leading-7 text-[#98a2b3]">流程、示例和调试入口保持一致，降低不同技术栈之间的学习成本。</p>
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
                <div className="flex items-center gap-2 text-xs font-medium text-[#98a2b3]"><span className="h-2 w-2 rounded-full bg-[#12b76a]" /> device-demo.ts</div>
                <span className="font-mono text-[10px] text-[#667085]">TypeScript</span>
              </div>
              <pre className="overflow-x-auto p-6 font-mono text-[12px] leading-7 text-[#cbd5e1] sm:p-8 sm:text-[13px]">
                <code><span className="text-[#64748b]">// 1. 初始化 SDK</span>{'\n'}<span className="text-[#7dd3fc]">const</span> sdk = <span className="text-[#c4b5fd]">await</span> Shroom.<span className="text-[#fde68a]">create</span>({'{'}{'\n'}  license: process.env.SHROOM_KEY{'\n'}{'}'}){'\n\n'}<span className="text-[#64748b]">// 2. 自动发现并连接设备</span>{'\n'}<span className="text-[#7dd3fc]">const</span> device = <span className="text-[#c4b5fd]">await</span> sdk.devices.<span className="text-[#fde68a]">connectFirst</span>(){'\n\n'}<span className="text-[#64748b]">// 3. 加载点位映射</span>{'\n'}<span className="text-[#c4b5fd]">await</span> device.<span className="text-[#fde68a]">loadMapping</span>(<span className="text-[#86efac]">&apos;./mapping.json&apos;</span>){'\n\n'}<span className="text-[#64748b]">// 4. 订阅实时数据</span>{'\n'}device.<span className="text-[#fde68a]">onFrame</span>((frame) =&gt; {'{'}{'\n'}  console.<span className="text-[#fde68a]">log</span>(frame.points){'\n'}{'}'})</code>
              </pre>
              <div className="border-t border-white/10 bg-[#0d1524] px-6 py-4 font-mono text-[11px] text-[#86efac] sm:px-8">
                ✓ Connected · 256 channels · 60 FPS
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="relative overflow-hidden rounded-[28px] bg-[#2563eb] px-7 py-12 text-white shadow-[0_28px_70px_rgba(37,99,235,0.25)] sm:px-12 sm:py-16 lg:px-16">
            <div className="lab-grid pointer-events-none absolute inset-0 opacity-35" />
            <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-[#dbeafe]">SHROOM WEB LAB</p>
                <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">不用安装，先在网页里验证设备。</h2>
                <p className="mt-5 max-w-xl text-sm leading-7 text-[#dbeafe] sm:text-base">使用 Chrome 或 Edge 连接设备，检查串口数据、Mapping 与可视化结果，让客户在正式开发前快速完成验证。</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a href="#trial" className="rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#175cd3] shadow-sm transition hover:bg-[#eff6ff]">打开网页测试台</a>
                  <a href="#docs" className="rounded-lg border border-white/30 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-white/10">查看浏览器兼容说明</a>
                </div>
              </div>

              <div className="rounded-2xl border border-white/20 bg-[#0b2356]/65 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-xs font-semibold">实时压力分布</span>
                  <span className="flex items-center gap-2 font-mono text-[10px] text-[#bfdbfe]"><span className="h-1.5 w-1.5 rounded-full bg-[#6ee7b7]" /> LIVE</span>
                </div>
                <div className="mt-5 grid grid-cols-8 gap-1.5" aria-label="压力热图示意">
                  {Array.from({ length: 40 }).map((_, index) => (
                    <span
                      key={index}
                      className={`aspect-square rounded-[4px] ${index % 11 === 0 ? 'bg-[#fbbf24]' : index % 7 === 0 ? 'bg-[#38bdf8]' : index % 5 === 0 ? 'bg-[#60a5fa]' : 'bg-white/10'}`}
                    />
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center font-mono text-[10px] text-[#bfdbfe]">
                  <span className="rounded-md bg-white/10 px-2 py-2">256 CH</span>
                  <span className="rounded-md bg-white/10 px-2 py-2">60 FPS</span>
                  <span className="rounded-md bg-white/10 px-2 py-2">8.4 ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="tools" className="scroll-mt-24 border-y border-[#e4e7ec] bg-[#f8fafc] py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#2563eb]">开发者工具箱</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">SDK 之外，工程所需也准备好了。</h2>
            <p className="mt-5 leading-7 text-[#667085]">围绕配置、调试、验证和二次开发提供配套工具，减少团队间反复交接。</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {tools.map((tool) => (
              <article key={tool.title} className="rounded-2xl border border-[#e4e7ec] bg-white p-7 transition hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(16,24,40,0.07)] sm:p-8">
                <span className={`inline-flex rounded-md px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.12em] ${tool.accent}`}>{tool.label}</span>
                <h3 className="mt-6 text-xl font-semibold tracking-[-0.03em]">{tool.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#667085]">{tool.description}</p>
                <a href="#trial" className="mt-7 inline-flex text-sm font-semibold text-[#175cd3] hover:underline">{tool.action} <span className="ml-2">→</span></a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="docs" className="scroll-mt-24 bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[#2563eb]">文档与示例</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">从第一个 Demo 到完整应用。</h2>
              <p className="mt-5 leading-7 text-[#667085]">用清晰的入门路径、API 说明和示例代码，帮助团队快速形成可交付成果。</p>
            </div>
            <a href="#trial" className="text-sm font-semibold text-[#175cd3] hover:underline">进入完整文档中心 →</a>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {resources.map((resource, index) => (
              <a key={resource.title} href="#trial" className="group rounded-2xl border border-[#e4e7ec] p-7 transition hover:border-[#84adff] hover:shadow-[0_14px_40px_rgba(16,24,40,0.06)]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#2563eb]">{resource.type}</span>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f7] text-sm text-[#667085] transition group-hover:bg-[#eff4ff] group-hover:text-[#175cd3]">↗</span>
                </div>
                <p className="mt-12 font-mono text-xs text-[#98a2b3]">0{index + 1}</p>
                <h3 className="mt-3 text-lg font-semibold">{resource.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#667085]">{resource.description}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="trial" className="scroll-mt-24 bg-[#0b1220] py-24 text-white sm:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:px-10">
          <div>
            <p className="text-sm font-semibold text-[#84adff]">7 天试用密钥</p>
            <h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">准备好连接你的第一台设备了吗？</h2>
            <p className="mt-5 max-w-lg leading-7 text-[#98a2b3]">留下联系信息，我们将发送试用密钥、对应系统的 SDK 与快速开始资料。</p>
            <div className="mt-8 grid gap-4 text-sm text-[#cbd5e1] sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <span className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#12326b] text-xs text-[#84adff]">✓</span>完整 SDK 与示例</span>
              <span className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#12326b] text-xs text-[#84adff]">✓</span>网页测试台权限</span>
              <span className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#12326b] text-xs text-[#84adff]">✓</span>Mapping 配置工具</span>
              <span className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#12326b] text-xs text-[#84adff]">✓</span>接入问题支持</span>
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

      <footer className="border-t border-[#e4e7ec] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#2563eb] text-xs font-black text-white">S</span>
            <div>
              <p className="text-sm font-bold">Shroom Developer</p>
              <p className="mt-0.5 text-[11px] text-[#98a2b3]">Build with sensor data.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-[#667085]">
            <a href="#capabilities" className="hover:text-[#175cd3]">产品能力</a>
            <a href="#downloads" className="hover:text-[#175cd3]">SDK 下载</a>
            <a href="#docs" className="hover:text-[#175cd3]">文档中心</a>
            <a href="#trial" className="hover:text-[#175cd3]">技术支持</a>
          </div>
          <p className="text-[11px] text-[#98a2b3]">© 2026 Shroom. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
