'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const SDK_DOWNLOAD = '/shroom-sdk.zip';
const START_COMMAND = 'node start.mjs';

const navItems = [
  { label: '接入路径', href: '#products' },
  { label: 'SDK 能力', href: '#capabilities' },
  { label: '在线体验', href: '#web-lab' },
  { label: 'Frame', href: '#frame' },
  { label: '下载', href: '#downloads' },
  { label: '文档', href: '/docs' },
];

const heroCode = `import { Shroom } from './sdk/web/index.js'

const heatmap = Shroom.createHeatmap('#view')
const device = Shroom.mock({ rows: 32, cols: 32 })

device.onFrame((frame) => heatmap.render(frame))`;

const codeSamples = {
  mock: {
    label: 'Mock',
    note: '不需要硬件，接口与真实 Device 一致。',
    code: `import { Shroom } from './sdk/web/index.js'

const heatmap = Shroom.createHeatmap('#view')
const device = Shroom.mock({ rows: 32, cols: 32, fps: 30 })

const off = device.onFrame((frame) => {
  heatmap.render(frame)
  console.log(frame.max, frame.area, frame.center)
})

// off()
// await device.close()`,
  },
  web: {
    label: '浏览器设备',
    note: 'Chrome 或 Edge，页面必须位于 HTTPS 或 localhost。',
    code: `import { Shroom } from './sdk/web/index.js'

const button = document.querySelector('#connect')
const heatmap = Shroom.createHeatmap('#view')

button.addEventListener('click', async () => {
  const device = await Shroom.connect({
    baudRate: 1_000_000,
    rows: 32,
    cols: 32,
  })

  device.onFrame((frame) => heatmap.render(frame))
}, { once: true })`,
  },
  node: {
    label: 'Node / Electron',
    note: '先执行 npm i serialport，文件使用 ESM。',
    code: `import { Shroom } from './sdk/node/index.js'

const device = await Shroom.connect({
  path: 'COM3',
  baudRate: 1_000_000,
  rows: 32,
  cols: 32,
})

const off = device.onFrame((frame) => {
  console.log(frame.max, frame.area, frame.center)
})

process.once('SIGINT', async () => {
  off()
  await device.close()
})`,
  },
} as const;

type CodeSampleId = keyof typeof codeSamples;

const frameGroups = [
  {
    title: '原始值与归一化值',
    fields: 'raw / values',
    description: 'raw 是 0-255 ADC 字节，values 是 0-1 相对值。',
  },
  {
    title: '矩阵尺寸',
    fields: 'rows / cols',
    description: '所有数据源都用相同的行列定义组织传感点。',
  },
  {
    title: '帧内统计',
    fields: 'min / max / avg / area',
    description: '直接获得极值、均值和超过阈值的有效点数量。',
  },
  {
    title: '压力重心与时间',
    fields: 'center / timestamp',
    description: 'center 的 x、y 均为 0-1，timestamp 使用毫秒时间戳。',
  },
];

const packageContents = [
  ['web/', 'Web Serial、Mock 与 Canvas 热力图'],
  ['node/', 'serialport 适配器与终端热力图'],
  ['core/', 'Frame 解码、切帧器与颜色映射'],
  ['backend/', '增强串口、采集、存储、回放、CSV 与算法通道'],
  ['index.d.ts', '当前公共类型定义'],
  ['web/index.html', '可直接打开的 Mock 示例'],
  ['README.md', '运行说明、接口与故障排查'],
];

const roadmapGroups = [
  {
    title: '接入自动化',
    items: ['安装式 Shroom Skill', '版本化文档 AI 问答', '产品 Profile 与协议上下文'],
  },
  {
    title: '产品工具链',
    items: ['Mapping Schema 与生成器', '分平台 Shroom 上位机', '物理量标定与完整报告引擎'],
  },
];

const CODE_TOKEN = /(\/\/[^\n]*)|(`[^`]*`|'[^']*'|"[^"]*")|\b(import|from|const|let|await|async|return|new)\b|\b(true|false|null)\b|\b([A-Za-z_$][\w$]*)(?=\()/g;
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

function createPressureFrame(frame: number, size: number) {
  const centerX = size * 0.58 + Math.sin(frame * 0.16) * size * 0.12;
  const centerY = size * 0.43 + Math.cos(frame * 0.13) * size * 0.1;
  const secondX = size * 0.3 + Math.cos(frame * 0.11) * size * 0.06;
  const secondY = size * 0.69 + Math.sin(frame * 0.09) * size * 0.08;
  const pulse = 0.86 + Math.sin(frame * 0.18) * 0.1;

  return Array.from({ length: size * size }, (_, index) => {
    const x = index % size;
    const y = Math.floor(index / size);
    const primary = Math.exp(-(((x - centerX) ** 2) / (size * 0.55) + ((y - centerY) ** 2) / (size * 0.74))) * pulse;
    const secondary = Math.exp(-(((x - secondX) ** 2) / (size * 0.3) + ((y - secondY) ** 2) / (size * 0.38))) * 0.57;
    return Math.min(1, primary + secondary);
  });
}

function calculateStats(values: number[], size: number) {
  let total = 0;
  let xTotal = 0;
  let yTotal = 0;
  let max = 0;
  let area = 0;

  values.forEach((value, index) => {
    const x = index % size;
    const y = Math.floor(index / size);
    total += value;
    xTotal += x * value;
    yTotal += y * value;
    max = Math.max(max, value);
    if (value > 0.12) area += 1;
  });

  return {
    max,
    area,
    centerX: total ? xTotal / total / Math.max(1, size - 1) : 0,
    centerY: total ? yTotal / total / Math.max(1, size - 1) : 0,
  };
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] = segment < 1
    ? [chroma, secondary, 0]
    : segment < 2
      ? [secondary, chroma, 0]
      : segment < 3
        ? [0, chroma, secondary]
        : segment < 4
          ? [0, secondary, chroma]
          : segment < 5
            ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const offset = lightness - chroma / 2;
  const channel = (value: number) => Math.round((value + offset) * 255);

  return `rgb(${channel(red)}, ${channel(green)}, ${channel(blue)})`;
}

function pressureColor(value: number) {
  if (value < 0.035) return 'rgb(16, 35, 67)';
  return hslToRgb(215 - value * 205, 0.82, 0.35 + value * 0.24);
}

function PressureGrid({ values, size, label, className = '' }: { values: number[]; size: number; label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`grid aspect-square gap-[3px] rounded-xl bg-[#07101f] p-3 ${className}`}
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
    >
      {values.map((value, index) => (
        <span
          key={index}
          className="rounded-[3px]"
          style={{
            backgroundColor: pressureColor(value),
            opacity: Math.round((0.55 + value * 0.45) * 10_000) / 10_000,
          }}
        />
      ))}
    </div>
  );
}

function CopyButton({ target, copiedTarget, onCopy, text, inverse = false }: {
  target: string;
  copiedTarget: string | null;
  onCopy: (value: string, target: string) => void;
  text: string;
  inverse?: boolean;
}) {
  return (
    <button
      type="button"
      aria-live="polite"
      onClick={() => onCopy(text, target)}
      className={inverse
        ? 'min-h-10 rounded-lg border border-white/15 px-3 text-xs font-semibold text-[#dce7f7] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84adff] active:translate-y-px'
        : 'min-h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text-strong)] transition hover:border-[var(--focus)] hover:text-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:translate-y-px'}
    >
      {copiedTarget === target ? '已复制' : '复制'}
    </button>
  );
}

export default function SdkPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [activeSample, setActiveSample] = useState<CodeSampleId>('mock');
  const [demoMode, setDemoMode] = useState<'mock' | 'device'>('mock');
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoFrame, setDemoFrame] = useState(0);
  const [gain, setGain] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(false);

  const heroValues = useMemo(() => createPressureFrame(5, 12), []);
  const heroStats = useMemo(() => calculateStats(heroValues, 12), [heroValues]);
  const demoValues = useMemo(
    () => createPressureFrame(demoFrame, 16).map((value) => Math.min(1, value * gain)),
    [demoFrame, gain],
  );
  const demoStats = useMemo(() => calculateStats(demoValues, 16), [demoValues]);
  const currentSample = codeSamples[activeSample];
  const serialSupported = typeof navigator === 'undefined' ? null : 'serial' in navigator;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setReducedMotion(media.matches);
    syncPreference();
    media.addEventListener('change', syncPreference);
    return () => media.removeEventListener('change', syncPreference);
  }, []);

  useEffect(() => {
    if (!demoRunning || demoMode !== 'mock' || reducedMotion) return;
    const interval = window.setInterval(() => setDemoFrame((frame) => frame + 1), 160);
    return () => window.clearInterval(interval);
  }, [demoMode, demoRunning, reducedMotion]);

  async function copyText(value: string, target: string) {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopiedTarget(target);
    window.setTimeout(() => setCopiedTarget(null), 1600);
  }

  function selectDemoMode(mode: 'mock' | 'device') {
    setDemoMode(mode);
    setDemoRunning(false);
  }

  function toggleDemo() {
    if (reducedMotion) {
      setDemoFrame((frame) => frame + 1);
      return;
    }
    setDemoRunning((running) => !running);
  }

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[var(--page)] text-[var(--text)]">
      <a className="skip-link" href="#top">跳到主要内容</a>
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[var(--line)] bg-[var(--header)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-3" aria-label="返回 Shroom Developer 展示首页">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-fill)] text-sm font-black text-[var(--on-accent)] shadow-[0_8px_22px_rgba(37,99,235,0.2)]">S</span>
            <span className="text-[15px] font-bold tracking-[-0.02em] text-[var(--text-strong)]">
              Shroom <span className="font-medium text-[var(--text-muted)]">Developer</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--text-muted)] lg:flex" aria-label="主导航">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="transition hover:text-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <a href={SDK_DOWNLOAD} download className="hidden min-h-11 items-center rounded-xl bg-[var(--accent-fill)] px-4 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-fill-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:translate-y-px sm:inline-flex">
              下载 SDK
            </a>
            <button
              type="button"
              aria-label="切换移动端导航"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              className="min-h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--text-strong)] lg:hidden"
            >
              导航
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-t border-[var(--line)] bg-[var(--surface)] px-5 py-4 shadow-lg lg:hidden" aria-label="移动端导航">
            <div className="mx-auto grid max-w-7xl gap-1">
              {navItems.map((item) => (
                <a key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className="min-h-11 rounded-lg px-3 py-3 text-sm font-medium text-[var(--text-strong)] hover:bg-[var(--surface-muted)]">
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      <section id="top" tabIndex={-1} className="relative scroll-mt-24 overflow-hidden pt-[72px]">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative mx-auto grid min-h-[calc(100dvh-72px)] max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-10 lg:py-16">
          <div>
            <h1 className="max-w-2xl text-[clamp(2.7rem,5.4vw,4.8rem)] font-semibold leading-[1.02] tracking-[-0.06em] text-[var(--text-strong)]">
              从串口到压力帧，<span className="text-[var(--accent)]">一条链路完成接入。</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-[var(--text-muted)] sm:text-lg">
              浏览器与 Node 共用统一 Frame。没有硬件时，先用 Mock 写完界面。
            </p>

            <div className="mt-8 flex max-w-lg items-center overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
              <span className="px-4 font-mono text-sm text-[var(--text-subtle)]" aria-hidden="true">$</span>
              <code className="min-w-0 flex-1 overflow-x-auto py-3.5 pr-3 font-mono text-[13px] text-[var(--text-strong)]">{START_COMMAND}</code>
              <div className="m-1.5"><CopyButton target="start" copiedTarget={copiedTarget} onCopy={copyText} text={START_COMMAND} /></div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#web-lab" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-fill)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] shadow-[0_10px_28px_rgba(37,99,235,0.2)] transition hover:bg-[var(--accent-fill-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:translate-y-px">体验 Mock 数据</a>
              <a href={SDK_DOWNLOAD} download className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--text-strong)] transition hover:border-[var(--focus)] hover:text-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:translate-y-px">下载 SDK</a>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[650px] overflow-hidden rounded-2xl border border-[#20314f] bg-[#0b1220] shadow-[0_30px_80px_rgba(16,24,40,0.2)]">
            <div className="flex min-h-12 items-center justify-between border-b border-white/10 px-4 sm:px-5">
              <div><p className="font-mono text-[11px] font-medium text-[#e2e8f0]">Mock frame</p><p className="mt-0.5 font-mono text-[9px] text-[#7f91aa]">12 × 12 示例数据</p></div>
              <span className="rounded-md border border-[#2a3b58] bg-[#121d30] px-2.5 py-1 font-mono text-[10px] text-[#9fb3cf]">source: mock</span>
            </div>

            <div className="grid md:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-white/10 p-5 md:border-b-0 md:border-r">
                <PressureGrid values={heroValues} size={12} label="一帧模拟压力数据的 Grid 模式预览" />
                <div className="mt-4 grid grid-cols-3 gap-3 font-mono text-[10px] text-[#8da0bb]">
                  <span><b className="block text-xs font-medium text-white">{heroStats.max.toFixed(2)}</b>max</span>
                  <span><b className="block text-xs font-medium text-white">{heroStats.area}</b>area</span>
                  <span><b className="block text-xs font-medium text-white">{heroStats.centerX.toFixed(2)} / {heroStats.centerY.toFixed(2)}</b>center</span>
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex h-11 items-center justify-between border-b border-white/10 px-4"><span className="font-mono text-[10px] text-[#8da0bb]">quick-start.js</span><CopyButton target="hero-code" copiedTarget={copiedTarget} onCopy={copyText} text={heroCode} inverse /></div>
                <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-6 text-[#cbd5e1] sm:p-6"><code>{highlight(heroCode)}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 px-5 sm:px-8 md:grid-cols-4 lg:px-10">
          {[
            ['Core / Frame', '环境无关'],
            ['Browser', 'Chrome / Edge'],
            ['Node / Electron', 'Node 18+'],
            ['Mock', '无需硬件'],
          ].map(([title, detail], index) => (
            <div key={title} className={`py-5 ${index % 2 ? 'pl-5' : ''} ${index > 0 ? 'md:border-l md:border-[var(--line)] md:pl-6' : ''}`}>
              <p className="text-sm font-semibold text-[var(--text-strong)]">{title}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="products" className="scroll-mt-24 py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl"><h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-4xl">按你的开发环境开始。</h2><p className="mt-5 max-w-xl leading-7 text-[var(--text-muted)]">不再先选产品型号。先完成第一次数据读取，再接入产品协议与业务逻辑。</p></div>

          <div className="mt-12 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <article className="relative overflow-hidden rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-7 sm:p-9">
              <div className="max-w-xl"><h3 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">没有硬件，先运行 Mock</h3><p className="mt-3 leading-7 text-[var(--text-muted)]">Mock、Web Serial 与 Node serialport 都返回同一套 Device 与 Frame。界面代码无需重写。</p></div>
              <div className="mt-8 rounded-xl border border-[var(--accent-border)] bg-[var(--surface)] p-5 font-mono text-sm text-[var(--text-strong)] shadow-sm"><p><span className="text-[var(--accent-strong)]">const</span> device = Shroom.mock({'{ rows: 32, cols: 32 }'})</p><p className="mt-2">device.onFrame(frame {'=>'} heatmap.render(frame))</p></div>
              <a href="#web-lab" className="mt-7 inline-flex min-h-11 items-center font-semibold text-[var(--accent-strong)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">打开模拟体验 →</a>
            </article>

            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              <article className="p-7 sm:p-8"><p className="font-mono text-xs font-semibold text-[var(--accent-strong)]">Web Serial</p><h3 className="mt-3 text-xl font-semibold text-[var(--text-strong)]">在浏览器连接设备</h3><p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Chrome 或 Edge，HTTPS 或 localhost，并在用户点击回调内调用 connect。</p><a href="#quick-start" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent-strong)] hover:underline">查看浏览器代码 →</a></article>
              <article className="border-t border-[var(--line)] p-7 sm:p-8"><p className="font-mono text-xs font-semibold text-[var(--accent-strong)]">Node / Electron</p><h3 className="mt-3 text-xl font-semibold text-[var(--text-strong)]">在主进程或 CLI 连接</h3><p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Node 18+、ESM，并额外安装 serialport。可指定串口路径或枚举端口。</p><a href="#quick-start" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent-strong)] hover:underline">查看 Node 代码 →</a></article>
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="scroll-mt-24 border-y border-[var(--line)] bg-[var(--surface)] py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl"><h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-4xl">Core 先统一数据，再按需进入后端链路。</h2><p className="mt-5 max-w-xl leading-7 text-[var(--text-muted)]">连接数据源，获得 Device，订阅统一 Frame；随后可以交给内置渲染器、你的业务代码，或本地 Node 采集与回放模块。</p></div>
          <ol className="mt-12 grid overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--page)] md:grid-cols-4">
            {[
              ['connect / mock', '选择真实串口或模拟数据源'],
              ['Device', '统一 info、onFrame 与 close'],
              ['Frame', '统一矩阵、统计和压力重心'],
              ['render', 'Canvas 热力图或终端字符图'],
            ].map(([title, detail], index) => (
              <li key={title} className={`relative min-h-40 p-6 ${index ? 'border-t border-[var(--line)] md:border-l md:border-t-0' : ''}`}><h3 className="mt-2 font-mono text-lg font-semibold text-[var(--text-strong)]">{title}</h3><p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{detail}</p></li>
            ))}
          </ol>
          <div className="mt-10 grid gap-8 lg:grid-cols-2"><div className="border-t border-[var(--accent)] pt-6"><h3 className="text-xl font-semibold text-[var(--text-strong)]">当前已经提供</h3><p className="mt-3 leading-7 text-[var(--text-muted)]">Web Serial、Node serialport、Mock、Frame 解码、Canvas 热力图，以及 Node 后端的增强串口、采集、SQLite / 内存存储、回放、CSV 和同步算法通道。</p></div><div className="border-t border-[var(--line)] pt-6"><h3 className="text-xl font-semibold text-[var(--text-strong)]">当前不在 SDK 内</h3><p className="mt-3 leading-7 text-[var(--text-muted)]">通用设备握手、后台自动重连、物理量标定、通用 Mapping 生成器、完整报告引擎与云端服务。</p></div></div>
        </div>
      </section>

      <section id="web-lab" className="scroll-mt-24 py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl"><h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-4xl">先看一帧数据如何变化。</h2><p className="mt-5 max-w-xl leading-7 text-[var(--text-muted)]">这里展示可交互的 Mock Grid。它用于理解 Frame，不伪装成真实设备遥测。</p></div>

          <div className="mt-12 overflow-hidden rounded-2xl border border-[#20314f] bg-[#0b1220] shadow-[0_28px_70px_rgba(16,24,40,0.18)]">
            <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div role="tablist" aria-label="体验数据源" className="flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
                {(['mock', 'device'] as const).map((mode) => (
                  <button key={mode} type="button" role="tab" aria-selected={demoMode === mode} onClick={() => selectDemoMode(mode)} className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition ${demoMode === mode ? 'bg-white text-[#0b1220]' : 'text-[#a9b7ca] hover:text-white'}`}>{mode === 'mock' ? 'Mock 模拟' : '真实设备要求'}</button>
                ))}
              </div>
              <p className="font-mono text-xs text-[#8da0bb]">Grid preview / relative values</p>
            </div>

            {demoMode === 'mock' ? (
              <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
                <div className="border-b border-white/10 p-5 sm:p-8 lg:border-b-0 lg:border-r"><PressureGrid values={demoValues} size={16} label="16 乘 16 Mock 压力帧动态 Grid 预览" className="mx-auto max-w-[560px]" /></div>
                <div className="p-5 sm:p-8">
                  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10">
                    {[
                      ['max', demoStats.max.toFixed(2)],
                      ['area', String(demoStats.area)],
                      ['center x', demoStats.centerX.toFixed(2)],
                      ['center y', demoStats.centerY.toFixed(2)],
                    ].map(([label, value]) => (<div key={label} className="bg-[#101a2b] p-5"><p className="font-mono text-[10px] text-[#8da0bb]">{label}</p><p className="mt-2 font-mono text-2xl font-semibold text-white" aria-live="polite">{value}</p></div>))}
                  </div>
                  <div className="mt-7"><div className="flex items-center justify-between gap-4"><label htmlFor="gain" className="text-sm font-semibold text-white">显示增益</label><output htmlFor="gain" className="font-mono text-sm text-[#9fb3cf]">{gain.toFixed(1)}×</output></div><input id="gain" type="range" min="0.6" max="2" step="0.1" value={gain} onChange={(event) => setGain(Number(event.target.value))} className="mt-4 h-11 w-full accent-[#60a5fa]" /><p className="mt-2 text-xs leading-5 text-[#8da0bb]">只改变显示增益，不改变原始 Frame。</p></div>
                  <button type="button" onClick={toggleDemo} className="mt-7 min-h-11 w-full rounded-xl bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3b82f6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84adff] active:translate-y-px">{reducedMotion ? '生成下一帧' : demoRunning ? '暂停模拟' : '开始模拟'}</button>
                </div>
              </div>
            ) : (
              <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.05fr_0.95fr]">
                <div><h3 className="text-2xl font-semibold text-white">真实 Web Serial 需要本地 Demo</h3><p className="mt-4 max-w-xl leading-7 text-[#a9b7ca]">当前页面只运行 Mock。下载 SDK 后执行 node start.mjs，再在 Chrome 或 Edge 的点击回调中请求串口。</p><a href={SDK_DOWNLOAD} download className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-white px-5 text-sm font-semibold text-[#0b1220] hover:bg-[#eaf0f8]">下载本地 Demo</a></div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6"><p className="font-mono text-xs text-[#8da0bb]">当前浏览器检测</p><p className="mt-3 text-lg font-semibold text-white">{serialSupported === null ? '正在检测 Web Serial' : serialSupported ? '检测到 Web Serial API' : '未检测到 Web Serial API'}</p><ul className="mt-5 space-y-3 text-sm leading-6 text-[#a9b7ca]"><li>Chrome 或 Edge 新版浏览器</li><li>HTTPS 或 localhost 安全上下文</li><li>由用户点击触发设备选择</li><li>系统已识别 USB 串口设备</li></ul></div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="quick-start" className="scroll-mt-24 border-y border-[var(--line)] bg-[var(--surface)] py-24 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.68fr_1.32fr] lg:px-10">
          <div><h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-4xl">复制一段能运行的代码。</h2><p className="mt-5 max-w-md leading-7 text-[var(--text-muted)]">根据运行环境切换示例。真实设备示例包含用户手势、串口参数和关闭方式。</p><p className="mt-7 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 text-sm leading-6 text-[var(--text-muted)]">浏览器 connect 必须直接发生在点击回调中。Node 真串口需要额外安装 serialport。</p></div>
          <div className="min-w-0 overflow-hidden rounded-2xl border border-[#20314f] bg-[#0b1220] shadow-[0_24px_60px_rgba(16,24,40,0.16)]">
            <div className="flex flex-col gap-3 border-b border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between"><div role="tablist" aria-label="快速开始运行环境" className="flex flex-wrap gap-1">{(Object.keys(codeSamples) as CodeSampleId[]).map((id) => (<button key={id} type="button" role="tab" aria-selected={activeSample === id} onClick={() => setActiveSample(id)} className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition ${activeSample === id ? 'bg-white text-[#0b1220]' : 'text-[#a9b7ca] hover:bg-white/[0.06] hover:text-white'}`}>{codeSamples[id].label}</button>))}</div><CopyButton target="sample-code" copiedTarget={copiedTarget} onCopy={copyText} text={currentSample.code} inverse /></div>
            <p className="border-b border-white/10 px-5 py-3 text-xs leading-5 text-[#9fb3cf]">{currentSample.note}</p>
            <pre className="max-h-[520px] overflow-auto p-5 font-mono text-[12px] leading-6 text-[#cbd5e1] sm:p-7 sm:text-[13px]"><code>{highlight(currentSample.code)}</code></pre>
          </div>
        </div>
      </section>

      <section id="frame" className="scroll-mt-24 py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl"><h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-4xl">Frame 是唯一的数据合同。</h2><p className="mt-5 max-w-xl leading-7 text-[var(--text-muted)]">无论数据来自 Mock、浏览器还是 Node，onFrame 都返回相同字段。</p></div>
          <div className="mt-12 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="overflow-hidden rounded-2xl border border-[#20314f] bg-[#0b1220]"><div className="border-b border-white/10 px-5 py-4 font-mono text-[11px] text-[#8da0bb]">Frame 示例对象</div><pre className="overflow-x-auto p-6 font-mono text-[12px] leading-7 text-[#cbd5e1] sm:p-8 sm:text-[13px]"><code>{highlight(`{
  raw: Uint8Array,
  values: Float32Array,
  rows: 32,
  cols: 32,
  min: 0.01,
  max: 0.93,
  avg: 0.18,
  area: 147,
  center: { x: 0.58, y: 0.46 },
  timestamp: 1787875200000,
}`)}</code></pre></div>
            <div className="grid gap-4 sm:grid-cols-2">{frameGroups.map((group, index) => (<article key={group.title} className={`rounded-2xl border p-6 ${index === 0 ? 'border-[var(--accent-border)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-[var(--surface)]'}`}><p className="font-mono text-xs font-semibold text-[var(--accent-strong)]">{group.fields}</p><h3 className="mt-4 text-lg font-semibold text-[var(--text-strong)]">{group.title}</h3><p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{group.description}</p></article>))}</div>
          </div>
          <div className="mt-6 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-5 text-sm leading-6 text-[var(--warning-text)]">values 是相对 ADC 归一化值，不是 kPa、N 或其他物理单位。物理量换算需要每台设备的标定数据。</div>
        </div>
      </section>

      <section id="downloads" className="scroll-mt-24 border-y border-[var(--line)] bg-[var(--surface)] py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="overflow-hidden rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)]">
            <div className="grid gap-10 p-7 sm:p-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div><p className="font-mono text-xs font-semibold text-[var(--accent-strong)]">Shroom Sensor SDK v0.2.0-preview.1</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-4xl">下载完整技术预览包。</h2><p className="mt-5 max-w-lg leading-7 text-[var(--text-muted)]">包含 Web、Node、Core、Mock、热力图，以及本地 Node 后端的采集、存储、回放、CSV、算法、类型声明和示例。</p><a href={SDK_DOWNLOAD} download className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-[var(--accent-fill)] px-5 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-fill-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:translate-y-px">下载 ZIP</a></div>
              <div className="grid overflow-hidden rounded-xl border border-[var(--accent-border)] bg-[var(--surface)] sm:grid-cols-2">{packageContents.map(([name, description], index) => (<div key={name} className={`p-5 ${index >= 2 ? 'border-t border-[var(--line)]' : ''} ${index % 2 ? 'sm:border-l sm:border-[var(--line)]' : ''}`}><p className="font-mono text-sm font-semibold text-[var(--text-strong)]">{name}</p><p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{description}</p></div>))}</div>
            </div>
            <div className="grid gap-4 border-t border-[var(--accent-border)] px-7 py-5 text-xs text-[var(--text-muted)] sm:grid-cols-4 sm:px-10"><span><b className="block text-[var(--text-strong)]">版本</b>0.2.0-preview.1</span><span><b className="block text-[var(--text-strong)]">运行时</b>ESM + CJS / Node 18+</span><span><b className="block text-[var(--text-strong)]">发布状态</b>Technical Preview</span><span><b className="block text-[var(--text-strong)]">授权</b>公开条款待补充</span></div>
          </div>

          <div className="mt-16">
            <h3 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">统一 Frame，不同运行时适配器。</h3>
            <div className="mt-7 grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-[var(--line)] bg-[var(--page)] p-7"><div className="flex items-baseline justify-between gap-4"><h4 className="text-xl font-semibold text-[var(--text-strong)]">Browser adapter</h4><span className="font-mono text-xs text-[var(--text-subtle)]">web/index.js</span></div><dl className="mt-7 grid gap-5 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-[var(--text-strong)]">真实串口</dt><dd className="mt-2 leading-6 text-[var(--text-muted)]">Chrome / Edge Web Serial</dd></div><div><dt className="font-semibold text-[var(--text-strong)]">页面要求</dt><dd className="mt-2 leading-6 text-[var(--text-muted)]">HTTPS 或 localhost</dd></div><div><dt className="font-semibold text-[var(--text-strong)]">渲染</dt><dd className="mt-2 leading-6 text-[var(--text-muted)]">Canvas heatmap</dd></div><div><dt className="font-semibold text-[var(--text-strong)]">Safari / Firefox</dt><dd className="mt-2 leading-6 text-[var(--text-muted)]">仅 Mock，不支持真实串口</dd></div></dl></article>
              <article className="rounded-2xl border border-[var(--line)] bg-[var(--page)] p-7"><div className="flex items-baseline justify-between gap-4"><h4 className="text-xl font-semibold text-[var(--text-strong)]">Node adapter</h4><span className="font-mono text-xs text-[var(--text-subtle)]">node/index.js</span></div><dl className="mt-7 grid gap-5 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-[var(--text-strong)]">真实串口</dt><dd className="mt-2 leading-6 text-[var(--text-muted)]">serialport 12</dd></div><div><dt className="font-semibold text-[var(--text-strong)]">运行要求</dt><dd className="mt-2 leading-6 text-[var(--text-muted)]">Node 18+ / ESM</dd></div><div><dt className="font-semibold text-[var(--text-strong)]">渲染</dt><dd className="mt-2 leading-6 text-[var(--text-muted)]">Terminal ASCII</dd></div><div><dt className="font-semibold text-[var(--text-strong)]">系统差异</dt><dd className="mt-2 leading-6 text-[var(--text-muted)]">驱动、权限与串口路径</dd></div></dl></article>
            </div>
          </div>

          <div className="mt-12 grid gap-5 rounded-2xl border border-[var(--line)] bg-[var(--page)] p-7 lg:grid-cols-[0.75fr_1.25fr]"><div><h3 className="text-xl font-semibold text-[var(--text-strong)]">上位机与 SDK 分开发布</h3><p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">SDK 的 Frame 与订阅模型保持统一；Windows、macOS、Linux 上位机仍需各自打包。</p></div><p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 text-sm leading-6 text-[var(--text-muted)]">当前站点尚未提供上位机安装包。CH341SER 仅是部分 Windows USB 串口芯片所需驱动，不属于 SDK 本体。</p></div>
        </div>
      </section>

      <section id="skill" className="scroll-mt-24 py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] lg:grid-cols-[1.08fr_0.92fr]">
            <div className="p-7 sm:p-10 lg:p-12"><h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-4xl">AI 加速接入，从真实上下文开始。</h2><p className="mt-5 max-w-xl leading-7 text-[var(--text-muted)]">当前做法是把 README 和对应运行时入口交给 Codex，再描述设备参数与目标。安装式 Shroom Skill 正在规划。</p><div className="mt-9 space-y-6">{[
              ['提供上下文', 'README.md、web/index.js 或 node/index.js'],
              ['描述目标', '设备矩阵、波特率、运行环境和展示方式'],
              ['验证输出', '先跑 Mock，再连接真实串口并检查第一帧'],
            ].map(([title, detail]) => (<div key={title} className="border-l-2 border-[var(--accent)] pl-5"><h3 className="font-semibold text-[var(--text-strong)]">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{detail}</p></div>))}</div></div>
            <div className="border-t border-[var(--line)] bg-[var(--surface-muted)] p-7 sm:p-10 lg:border-l lg:border-t-0 lg:p-12"><p className="font-mono text-xs font-semibold text-[var(--accent-strong)]">规划中的 Skill 包</p><div className="mt-6 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] font-mono text-sm text-[var(--text-strong)]">{[
              ['SKILL.md', '任务边界与执行流程'],
              ['references/api.md', '可用 API 与运行时差异'],
              ['references/frame.md', 'Frame 合同与限制'],
              ['examples/', 'Mock、Web、Node 验证用例'],
            ].map(([path, detail], index) => (<div key={path} className={`p-4 ${index ? 'border-t border-[var(--line)]' : ''}`}><p>{path}</p><p className="mt-1 font-sans text-xs text-[var(--text-muted)]">{detail}</p></div>))}</div><p className="mt-6 text-sm leading-6 text-[var(--text-muted)]">AI 问答将在版本化文档和 API 事实源稳定后接入，避免根据过期接口生成代码。</p></div>
          </div>
        </div>
      </section>

      <section id="tools" className="scroll-mt-24 border-y border-[var(--line)] bg-[var(--surface)] py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"><div className="max-w-2xl"><h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-4xl">下一阶段，只展示真实进度。</h2><p className="mt-5 max-w-xl leading-7 text-[var(--text-muted)]">以下能力不在当前 ZIP 中。完成事实源、测试和下载入口后再升级为正式功能。</p></div><div className="mt-12 grid gap-8 lg:grid-cols-2">{roadmapGroups.map((group) => (<div key={group.title} className="border-t border-[var(--accent)] pt-6"><h3 className="text-xl font-semibold text-[var(--text-strong)]">{group.title}</h3><div className="mt-6 space-y-3">{group.items.map((item) => (<div key={item} className="flex items-center justify-between gap-5 rounded-xl bg-[var(--surface-muted)] px-4 py-3.5"><span className="text-sm font-medium text-[var(--text-strong)]">{item}</span><span className="shrink-0 font-mono text-[10px] text-[var(--text-subtle)]">规划中</span></div>))}</div></div>))}</div></div>
      </section>

      <section id="docs" className="scroll-mt-24 py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"><div className="max-w-2xl"><h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-4xl">文档按开发任务组织。</h2><p className="mt-5 max-w-xl leading-7 text-[var(--text-muted)]">先完成第一次成功，再查 Frame、兼容性和故障边界。完整 README 随 SDK 下载。</p></div><div className="mt-12 grid gap-4 md:grid-cols-2">{[
          ['30 秒快速开始', 'Mock、浏览器和 Node 三种可运行示例。', '/docs#quick-start', '查看代码'],
          ['Frame 参考', '字段、类型、统计值与物理单位边界。', '/docs#frame', '查看合同'],
          ['运行环境与兼容', 'Web Serial、Node、系统驱动和页面要求。', '/docs#downloads', '查看兼容'],
          ['后端与串口', '增强串口、采集、存储、回放、CSV 和同步算法通道。', '/docs/backend#overview', '查看后端'],
          ['完整 README', '下载包内包含 API、参数和故障排查表。', SDK_DOWNLOAD, '下载文档'],
        ].map(([title, description, href, action]) => (<a key={title} href={href} download={href === SDK_DOWNLOAD} className="group rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7 transition hover:border-[var(--focus)] hover:shadow-[0_16px_44px_rgba(16,24,40,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"><h3 className="text-xl font-semibold text-[var(--text-strong)]">{title}</h3><p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{description}</p><span className="mt-7 inline-flex text-sm font-semibold text-[var(--accent-strong)] group-hover:underline">{action} →</span></a>))}</div></div>
      </section>

      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-fill)] text-xs font-black text-[var(--on-accent)]">S</span><div><p className="text-sm font-bold text-[var(--text-strong)]">Shroom Developer</p><p className="mt-1 text-xs text-[var(--text-muted)]">连接串口，获得 Frame，画出数据。</p></div></div><nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--text-muted)]" aria-label="页脚导航"><Link href="/" className="hover:text-[var(--accent-strong)]">展示首页</Link><a href="/docs#quick-start" className="hover:text-[var(--accent-strong)]">快速开始</a><a href="#downloads" className="hover:text-[var(--accent-strong)]">SDK 下载</a><a href="#skill" className="hover:text-[var(--accent-strong)]">AI 接入</a><a href="/docs" className="hover:text-[var(--accent-strong)]">文档</a></nav><p className="text-xs text-[var(--text-muted)]">© 2026 Shroom</p></div>
      </footer>
    </main>
  );
}
