'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import desktopRelease from './desktop-release.json';

// SDK 压缩包由 scripts/pack-sdk.mjs 从 sdk/ 目录打包生成，构建时自动更新
const SDK_DOWNLOAD = '/shroom-sdk.zip';

// 上位机的包 100MB 上下，不进仓库也不走 Node 进程发。
// 线上把 Nginx 的 /downloads/ alias 到磁盘目录，本地则落在 public/downloads/（已 gitignore）。
// 换 CDN 或对象存储时只改这个环境变量，页面代码不动。
const DESKTOP_BASE = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_BASE ?? '/downloads';
const DESKTOP_WIN_URL = `${DESKTOP_BASE}/${desktopRelease.fileName}`;

// 手套的浏览器体验站，独立部署，不在这个仓库里
const GLOVE_LAB_URL = 'https://glove.jq-industries.io/';

// 下载前留个联系方式，POST 到密钥系统的「SDK 获取」模块。
// 抽成环境变量是为了本地联调时能指到本地那套（NEXT_PUBLIC_SDK_REGISTRY_URL=http://localhost:3000/sdk-requests）
const SDK_REGISTRY_URL =
  process.env.NEXT_PUBLIC_SDK_REGISTRY_URL ?? 'https://shroom.jq-industries.com/sdk-requests';
// 留过一次就别再拦人家了，之后点按钮直接下载。
// SDK 和上位机共用这一个标记：这是留联系方式，不是按产品逐个授权，没必要问两遍
const REGISTERED_KEY = 'shroom-sdk-registered';

// SDK 和上位机共用同一个登记弹窗，只有下载地址、登记来源和文案不同
type DownloadTarget = {
  url: string;
  source: string;
  title: string;
  subtitle: string;
};

const SDK_TARGET: DownloadTarget = {
  url: SDK_DOWNLOAD,
  source: 'sdk-web',
  title: '获取 Shroom SDK',
  subtitle: '留个联系方式，方便后续技术支持。提交后立即开始下载。',
};

const DESKTOP_TARGET: DownloadTarget = {
  url: DESKTOP_WIN_URL,
  source: 'desktop-win',
  title: `下载 Windows 上位机 ${desktopRelease.version}`,
  subtitle: `免安装 zip，${desktopRelease.sizeLabel}，下载需要一点时间。留个联系方式，方便后续技术支持。`,
};

const navItems = [
  { label: '选择产品', href: '#products' },
  { label: '产品能力', href: '#capabilities' },
  { label: 'SDK Skill', href: '#skill' },
  { label: '资源下载', href: '#downloads' },
  { label: '快速开始', href: '#quick-start' },
  { label: '开发工具', href: '#tools' },
  { label: '文档中心', href: '/docs' },
];

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
      { label: 'Windows 上位机', href: '#downloads' },
      { label: '接入示例', href: '#quick-start' },
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
      { label: 'Windows 上位机', href: '#downloads' },
      { label: '接入示例', href: '#quick-start' },
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
      { label: '接入示例', href: '#quick-start' },
    ],
  },
];

// 这四条必须和 sdk/AI-CONTEXT.md §1「能力边界」对得上。
// 之前这里写过「异常重连」「实时曲线」「CSV 下载」「Mapping JSON 导出」——
// SDK 里一个都没有。官网吹的功能下载下来找不到，比少写几条严重得多。
const capabilities = [
  {
    index: '01',
    tag: 'DEVICE',
    title: '统一设备接入',
    description: '浏览器用 Web Serial、Node 用 serialport，封装成同一个 connect()。业务代码在两端可以直接搬。',
    meta: ['串口通信', '设备发现', '浏览器 / Node 同接口'],
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
    description: '内置 canvas 热力图，点阵 / 热斑 / 网格三种画法，不依赖 Three.js。绘制按屏幕刷新率节流，串口再快也不会多画一次。',
    meta: ['三种画法', '可换配色', '按帧节流'],
  },
];

// Windows 已经有正式产出物，版本号 / 体积全部来自 app/desktop-release.json，
// 那个文件由 scripts/sync-desktop-release.mjs 从包本身算出来，不许手填。
// 里面的 sha256 是给发布流程核对用的（见 DEPLOY.md），**不往页面上渲染** ——
// 一串 64 位十六进制挂在下载区，看的人会以为是密钥。
// macOS / Linux 还没有产出物，就老老实实写「即将发布」，别挂假文件名。
type DesktopPlatform = {
  id: string;
  label: string;
  badge: string;
  eyebrow: string;
  title: string;
  description: string;
  compatibility: string;
  packageName: string;
  driverNote: string;
  status: 'available' | 'planned';
  // 只有已发布的平台才有，用它来区分渲染，不用再去判断 id === 'windows'
  release?: typeof desktopRelease;
  href?: string;
};

const upperComputerPlatforms: DesktopPlatform[] = [
  {
    id: 'windows',
    label: 'Windows',
    badge: 'W',
    eyebrow: 'SHROOM 上位机',
    title: 'Windows 串口监视器',
    description: '连接串口，看原始字节、看帧、看实时热力图。免安装，解压双击即用。',
    compatibility: 'Windows 10 / 11（64 位）',
    packageName: '免安装 zip · 解压即用',
    driverNote: '装 CH341SER 驱动后，在设备管理器里确认出现了 COM 口。',
    status: 'available' as const,
    release: desktopRelease,
    href: DESKTOP_WIN_URL,
  },
  {
    id: 'macos',
    label: 'macOS',
    badge: 'M',
    eyebrow: 'SHROOM 上位机',
    title: 'macOS 上位机',
    description: '用于 Apple Silicon 与 Intel Mac 的设备调试、数据查看和采集回放。',
    compatibility: 'Apple Silicon / Intel',
    packageName: '上位机 · 安装说明 · 更新日志',
    driverNote: '较新的 macOS 自带 CH34x 驱动；插上后设备名形如 /dev/tty.usbserial-*。',
    status: 'planned' as const,
  },
  {
    id: 'linux',
    label: 'Linux',
    badge: 'L',
    eyebrow: 'SHROOM 上位机',
    title: 'Linux 上位机',
    description: '用于 Linux 工作站与实验室环境的设备调试、数据采集和结果导出。',
    compatibility: 'x64 / ARM64',
    driverNote: '内核自带驱动，但要把当前用户加进 dialout 组，否则打开串口是 Permission denied。',
    packageName: '上位机 · 权限说明 · 更新日志',
    status: 'planned' as const,
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
  {
    number: '01',
    title: '下载并解压 SDK',
    description: '一个压缩包，包含浏览器和 Node 两套入口、示例页面与类型定义，无需选择操作系统版本。',
  },
  {
    number: '02',
    title: '先用模拟数据跑通',
    description: '没有硬件也能开始：Shroom.mock() 与真实设备接口完全一致，界面写好后直接换成真设备。',
  },
  {
    number: '03',
    title: '连接设备',
    description: '浏览器用 Web Serial，Node 用 serialport，同一个 connect() 接口。',
  },
  {
    number: '04',
    title: '订阅数据并渲染',
    description: 'onFrame 拿到统一的数据帧，交给内置热力图，或接入你自己的可视化与业务逻辑。',
  },
];

// planned 为 true 的卡片渲染成不可点的灰态。宁可写「规划中」，
// 也不要挂一个指回本页的假链接 —— 那种链接点下去毫无反应，比明说没做更糟。
const tools = [
  {
    label: 'WEB LAB',
    title: '网页测试台',
    description: '在 Chrome / Edge 中连接设备，实时查看压力热图与原始数据，不用装任何东西。',
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

const resources = [
  {
    type: 'FOR AI',
    title: '给 AI 的上下文',
    description: '整篇复制给 AI，它就掌握了全部接口和能力边界，不必再翻源码。',
    href: '/docs/ai-context',
  },
  {
    type: 'GUIDE',
    title: '怎么用 AI 来开发',
    description: '写给不写代码的人：怎么描述需求，出了问题怎么跟 AI 说。',
    href: '/docs/ai-guide',
  },
  {
    type: 'REFERENCE',
    title: 'SDK 说明与排错',
    description: '完整 API 一览和排错对照表。连不上设备时先查这份。',
    href: '/docs/readme',
  },
];

const heroCode = `import { Shroom } from './sdk/web/index.js'

const heatmap = Shroom.createHeatmap('#view')
const device = await Shroom.connect()

device.onFrame((frame) => {
  heatmap.render(frame)
})`;

const skillCode = `const device = await Shroom.connect()
const heatmap = Shroom.createHeatmap('#view')
device.onFrame((frame) => heatmap.render(frame))`;

const quickStartCode = `// 1. 连接设备（必须在用户点击里调用）
const device = await Shroom.connect({ baudRate: 1000000 })

// 2. 创建热力图
const heatmap = Shroom.createHeatmap('#view')

// 3. 订阅实时数据
device.onFrame((frame) => {
  heatmap.render(frame)
  console.log(frame.max, frame.area, frame.center)
})

// 4. 用完断开
await device.close()`;

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState('matrix');
  const [activePlatform, setActivePlatform] = useState('windows');
  const [productQuery, setProductQuery] = useState('');
  const [copied, setCopied] = useState(false);
  // 下载前的登记弹窗。注意这不是审批：填完当场就下载。
  // gateTarget 记住是谁触发的，SDK 和上位机走同一个弹窗但登记来源不同
  const [gateOpen, setGateOpen] = useState(false);
  const [gateTarget, setGateTarget] = useState<DownloadTarget>(SDK_TARGET);
  const [submitting, setSubmitting] = useState(false);
  // 试用密钥表单暂时下线，SDK 点击即可下载
  // const [submitted, setSubmitted] = useState(false);

  const selectedPlatform = useMemo(
    () => upperComputerPlatforms.find((platform) => platform.id === activePlatform) ?? upperComputerPlatforms[0],
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
    await navigator.clipboard?.writeText(heroCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  // 弹窗开着时按 Esc 关掉。提交中不给关，免得请求发出去一半界面就没了
  useEffect(() => {
    if (!gateOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) setGateOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gateOpen, submitting]);

  // 程序化触发下载：造一个隐藏的 <a download> 点一下。
  // 不用 location.href，那样在部分浏览器里会先跳走再回来，页面闪一下
  function startDownload(target: DownloadTarget) {
    const a = document.createElement('a');
    a.href = target.url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function openGate(target: DownloadTarget) {
    setGateTarget(target);
    // 填过一次的老用户直接放行，别每次下载都问一遍
    try {
      if (window.localStorage.getItem(REGISTERED_KEY)) {
        startDownload(target);
        return;
      }
    } catch {
      // 隐私模式下 localStorage 会抛错，那就当没填过，弹一次也无妨
    }
    setGateOpen(true);
  }

  async function submitGate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      await fetch(SDK_REGISTRY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 登记接口要是卡住（网络不通、服务没起来），按钮会一直停在「下载中…」，
        // 用户以为在排队审批。给 8 秒上限，超时就当登记失败，直接放行下载
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          name: String(fd.get('name') ?? '').trim(),
          phone: String(fd.get('phone') ?? '').trim(),
          email: String(fd.get('email') ?? '').trim(),
          organization: String(fd.get('organization') ?? '').trim(),
          source: gateTarget.source,
          sdkVersion: gateTarget.source === 'desktop-win' ? desktopRelease.version : undefined,
        }),
      });
    } catch {
      // 登记失败不挡下载——这本来就不是审批，密钥系统挂了也不能让人拿不到 SDK
    }
    try {
      window.localStorage.setItem(REGISTERED_KEY, '1');
    } catch {
      // 同上，存不下就下次再填一遍
    }
    setSubmitting(false);
    setGateOpen(false);
    startDownload(gateTarget);
  }

  // function submitTrial(event: FormEvent<HTMLFormElement>) {
  //   event.preventDefault();
  //   setSubmitted(true);
  // }

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
              <a key={item.label} className="transition hover:text-[#175cd3]" href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/docs"
              className="hidden rounded-lg border border-[#d0d5dd] bg-white px-4 py-2 text-sm font-semibold text-[#344054] shadow-sm transition hover:border-[#84adff] hover:text-[#175cd3] sm:inline-flex"
            >
              查看文档
            </Link>
            <button
              type="button"
              onClick={() => openGate(SDK_TARGET)}
              className="hidden rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#175cd3] sm:inline-flex"
            >
              获取 SDK
            </button>
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
                  key={item.label}
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
              统一 SDK · Skill 推荐接入
            </div>
            <h1 className="max-w-3xl text-[clamp(2.75rem,6vw,5rem)] font-semibold leading-[1.02] tracking-[-0.06em] text-[#101828]">
              让硬件数据，
              <span className="text-[#2563eb]">更快抵达应用。</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-[#667085] sm:text-lg">
              一套统一 SDK，不区分操作系统；配合 Shroom Skill，让 AI 理解设备协议、Mapping 与接口，直接辅助完成接入代码。
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#quick-start"
                className="inline-flex items-center justify-center rounded-xl bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5 hover:bg-[#175cd3]"
              >
                用 Skill 快速接入 <span aria-hidden="true" className="ml-2">→</span>
              </a>
              <button
                type="button"
                onClick={() => openGate(SDK_TARGET)}
                className="inline-flex items-center justify-center rounded-xl border border-[#d0d5dd] bg-white px-5 py-3 text-sm font-semibold text-[#344054] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f9fafb]"
              >
                获取通用 SDK
              </button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium text-[#667085]">
              <span className="flex items-center gap-2"><span className="text-[#12b76a]">●</span> SDK 不区分操作系统</span>
              <span className="flex items-center gap-2"><span className="text-[#12b76a]">●</span> 上位机分平台提供</span>
              <span className="flex items-center gap-2"><span className="text-[#12b76a]">●</span> 点击即可下载，无需密钥</span>
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
                <code>{highlight(heroCode)}</code>
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
          <p className="text-sm font-medium text-[#667085]">SDK 保持统一，上位机按系统提供</p>
          <div className="flex flex-wrap gap-2.5">
            <span className="flex items-center gap-2 rounded-lg border border-[#b2ccff] bg-[#eff4ff] px-3.5 py-2 text-xs font-semibold text-[#175cd3] shadow-sm">
              <span className="grid h-5 w-5 place-items-center rounded bg-[#2563eb] text-[9px] text-white">S</span>
              通用 SDK
            </span>
            {upperComputerPlatforms.map((platform) => (
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
              <p className="mt-5 leading-7 text-[#667085]">选择已购买的产品系列，页面将集中展示对应规格书、统一 SDK、上位机、示例和测试工具。</p>
            </div>
            <label className="relative block">
              <span className="sr-only">搜索产品型号</span>
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

      <section id="skill" className="scroll-mt-24 bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="relative overflow-hidden rounded-[30px] bg-[#0b1220] px-6 py-10 text-white shadow-[0_30px_80px_rgba(16,24,40,0.2)] sm:px-10 sm:py-14 lg:px-14">
            <div className="skill-grid pointer-events-none absolute inset-0 opacity-70" />
            <div className="relative grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#2e90fa]/40 bg-[#102a56] px-3 py-1.5 text-xs font-semibold text-[#84adff]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#53b1fd]" />
                  推荐接入方式
                </div>
                <p className="mt-7 font-mono text-[10px] font-semibold tracking-[0.16em] text-[#84adff]">SHROOM SDK SKILL</p>
                <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">
                  用 AI Skill，<br />更快接入 Shroom SDK。
                </h2>
                <p className="mt-6 max-w-xl text-sm leading-7 text-[#a7b4c8] sm:text-base">
                  Skill 就是 SDK 里那份 <span className="font-mono text-[#84adff]">AI-CONTEXT.md</span>：接口、数据结构、坐标系、
                  硬性约束和常见错误都写在里面。整篇复制给 AI，再描述你的产品和目标，它就能生成连接、读取和展示代码。
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/docs/ai-context" className="rounded-lg bg-[#2563eb] px-5 py-3 text-center text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] transition hover:bg-[#175cd3]">
                    获取 SDK Skill
                  </Link>
                  <a href="#quick-start" className="rounded-lg border border-white/15 bg-white/[0.04] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10">
                    查看接入示例
                  </a>
                </div>
                <div className="mt-7 flex flex-wrap gap-2">
                  {['接口与数据结构', '坐标系与量级', '硬性约束', '可抄的例子'].map((item) => (
                    <span key={item} className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-medium text-[#a7b4c8]">{item}</span>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#070c14] shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#e2e8f0]">
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-[#2563eb] text-[10px] font-black">S</span>
                    Shroom Skill
                  </div>
                  <span className="flex items-center gap-2 font-mono text-[9px] text-[#86efac]"><span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" /> READY</span>
                </div>
                <div className="space-y-4 p-5 sm:p-6">
                  <div className="ml-8 rounded-xl rounded-tr-sm bg-[#172033] p-4 text-xs leading-6 text-[#cbd5e1]">
                    我在做矩阵压力传感器展示页，请帮我连接设备、加载 Mapping，并实时读取压力数据。
                  </div>
                  <div className="mr-4 rounded-xl rounded-tl-sm border border-[#1d4ed8]/30 bg-[#0d1e3d] p-4">
                    <p className="text-xs font-semibold text-[#bfdbfe]">已加载 Shroom SDK 上下文</p>
                    <div className="mt-3 grid gap-2.5 text-[11px] text-[#a7b4c8]">
                      <span className="flex items-center gap-2"><span className="text-[#34d399]">✓</span> 已匹配矩阵产品协议与数据字段</span>
                      <span className="flex items-center gap-2"><span className="text-[#34d399]">✓</span> 已选择统一 SDK 连接与订阅接口</span>
                      <span className="flex items-center gap-2"><span className="text-[#34d399]">✓</span> 正在生成设备接入与热图示例</span>
                    </div>
                    <pre className="mt-4 overflow-x-auto rounded-lg border border-white/5 bg-[#050912] p-3 font-mono text-[10px] leading-5 text-[#94a3b8]">
                      <code>{highlight(skillCode)}</code>
                    </pre>
                  </div>
                </div>
                <div className="border-t border-white/10 bg-white/[0.03] px-5 py-3 font-mono text-[9px] text-[#64748b]">
                  SDK context · protocol · mapping · examples
                </div>
              </div>
            </div>

            <ol className="relative mt-12 grid gap-3 border-t border-white/10 pt-8 md:grid-cols-3">
              {skillSteps.map((step) => (
                <li key={step.number} className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
                  <div className="flex items-start gap-4">
                    <span className="font-mono text-xs font-bold text-[#84adff]">{step.number}</span>
                    <div>
                      <h3 className="text-sm font-semibold">{step.title}</h3>
                      <p className="mt-2 text-xs leading-6 text-[#8fa0b8]">{step.description}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="downloads" className="scroll-mt-24 border-y border-[#e4e7ec] bg-[#f8fafc] py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[#2563eb]">SDK 与软件资源</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">SDK 保持统一，上位机按平台下载。</h2>
              <p className="mt-5 leading-7 text-[#667085]">开发者使用同一套 SDK 接口；只有用于设备调试和数据查看的 Shroom 上位机与驱动需要选择操作系统。</p>
            </div>
            <p className="text-xs text-[#98a2b3]">
              SDK 与 Windows 上位机均可直接下载；macOS / Linux 上位机尚未发布
            </p>
          </div>

          <article className="relative mt-10 overflow-hidden rounded-2xl border border-[#84adff] bg-white p-7 shadow-[0_16px_46px_rgba(37,99,235,0.09)] sm:p-9">
            <div className="download-grid pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-60" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#2563eb] text-sm font-black text-white">S</span>
                  <div>
                    <p className="font-mono text-[9px] font-semibold tracking-[0.15em] text-[#2563eb]">UNIFIED SDK</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">统一 Shroom SDK</h3>
                  </div>
                </div>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-[#667085]">当前版本只做三件事：连接串口、拿到统一格式的数据帧、把它画成热力图。浏览器（Web Serial）和 Node（serialport）共用同一套接口和同一个数据结构，不区分操作系统。曲线、回放、算法这些由你在它之上自行实现。</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {['连接串口', '统一数据帧', '热力图渲染', '浏览器 / Node'].map((item) => (
                    <span key={item} className="rounded-md bg-[#eff4ff] px-2.5 py-1.5 text-[11px] font-semibold text-[#175cd3]">{item}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <button type="button" onClick={() => openGate(SDK_TARGET)} className="rounded-lg bg-[#2563eb] px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-[#175cd3]">获取统一 SDK</button>
                <a href="#quick-start" className="rounded-lg border border-[#d0d5dd] bg-white px-5 py-3 text-center text-sm font-semibold text-[#344054] transition hover:bg-[#f9fafb]">查看接入示例</a>
              </div>
            </div>
          </article>

          <div className="mt-12">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[10px] font-semibold tracking-[0.15em] text-[#2563eb]">SHROOM DESKTOP</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Shroom 上位机与驱动</h3>
              </div>
              <p className="max-w-xl text-xs leading-6 text-[#667085]">平台选择仅影响上位机与驱动，不影响 SDK 的使用。</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {upperComputerPlatforms.map((platform) => (
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
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                      {selectedPlatform.release ? '版本与体积' : '资源内容'}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#344054]">
                      {selectedPlatform.release
                        ? `v${selectedPlatform.release.version} · ${selectedPlatform.release.sizeLabel} · ${selectedPlatform.release.releaseDate}`
                        : selectedPlatform.packageName}
                    </p>
                  </div>
                </div>

                {selectedPlatform.release ? (
                  <div className="mt-4 max-w-xl rounded-xl border border-[#eaecf0] bg-[#f9fafb] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">本次更新</p>
                    <ul className="mt-2 grid gap-1.5">
                      {selectedPlatform.release.notes.map((note) => (
                        <li key={note} className="flex gap-2 text-xs leading-6 text-[#475467]">
                          <span className="text-[#2563eb]">·</span>
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-auto flex flex-col items-start gap-4 pt-8 sm:flex-row sm:items-center">
                  {selectedPlatform.status === 'available' ? (
                    <button
                      type="button"
                      onClick={() => openGate(DESKTOP_TARGET)}
                      className="rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#175cd3]"
                    >
                      下载 {selectedPlatform.label} 上位机 · {selectedPlatform.release?.sizeLabel}
                    </button>
                  ) : (
                    <span className="cursor-not-allowed rounded-lg border border-[#d0d5dd] bg-[#f2f4f7] px-4 py-2.5 text-sm font-semibold text-[#98a2b3]">
                      {selectedPlatform.label} 上位机 · 即将发布
                    </span>
                  )}
                  <a
                    href="/lab.html"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-[#175cd3] hover:underline"
                  >
                    先用网页测试台看数据 →
                  </a>
                </div>

                {selectedPlatform.status === 'available' ? (
                  /* 没做代码签名，SmartScreen 一定会拦。这条必须写在下载按钮旁边，
                     不能只写在文档里 —— 被拦住的人第一反应是「这软件有毒」，然后就走了 */
                  <p className="mt-5 rounded-lg border border-[#eaecf0] bg-white px-4 py-3 text-xs leading-6 text-[#667085]">
                    解压后运行 <code className="font-mono text-[#344054]">ShroomMonitor.exe</code>，不需要安装、不需要授权。
                    程序未做代码签名，首次运行 Windows 会弹「已保护你的电脑」，点<span className="font-semibold text-[#344054]">「更多信息 → 仍要运行」</span>即可。
                  </p>
                ) : null}
              </div>
            </article>
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[#fedf89] bg-[#fffaeb] px-5 py-4 text-sm sm:flex-row sm:items-start sm:justify-between">
            <p className="text-[#7a2e0e]">
              <span className="font-semibold">{selectedPlatform.label} 驱动与权限：</span>
              {selectedPlatform.driverNote}
            </p>
            <Link href="/docs/readme" className="shrink-0 font-semibold text-[#b54708] hover:underline">查看完整排错表 →</Link>
          </div>
        </div>
      </section>

      <section id="quick-start" className="scroll-mt-24 bg-[#0b1220] py-24 text-white sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#84adff]">手动接入路径</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">需要完全控制？也可以按文档四步接入。</h2>
            <p className="mt-5 leading-7 text-[#98a2b3]">统一 SDK 的安装、接口和示例不随操作系统改变；你可以跳过 Skill，按标准流程完成第一次数据读取。</p>
            <a href="#skill" className="mt-5 inline-flex text-sm font-semibold text-[#84adff] hover:underline">返回推荐的 Skill 接入方式 →</a>
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
                <code>{highlight(quickStartCode)}</code>
              </pre>
              <div className="border-t border-white/10 bg-[#0d1524] px-6 py-4 font-mono text-[11px] text-[#86efac] sm:px-8">
                ✓ Connected · 256 channels · 60 FPS
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="web-lab" className="scroll-mt-24 bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="relative overflow-hidden rounded-[28px] bg-[#2563eb] px-7 py-12 text-white shadow-[0_28px_70px_rgba(37,99,235,0.25)] sm:px-12 sm:py-16 lg:px-16">
            <div className="lab-grid pointer-events-none absolute inset-0 opacity-35" />
            <div className="relative">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-[#dbeafe]">SHROOM WEB LAB</p>
                  <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">无需下载，即可在此试用。</h2>
                </div>
                <a
                  href="/lab.html"
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#175cd3] shadow-sm transition hover:bg-[#eff6ff]"
                >
                  新标签页打开
                </a>
              </div>

              {/*
                直接把示例页嵌进来，用户不用下载、不用跳走就能连设备。
                allow="serial" 不能少 —— 串口能力默认只给顶层文档，
                iframe 里不显式放行的话，「连接设备」按钮点了会静默失败。
              */}
              <div className="mt-9 overflow-hidden rounded-2xl border border-white/20 bg-[#0b0f14] shadow-[0_20px_60px_rgba(8,15,35,0.45)]">
                <iframe
                  src="/lab.html"
                  title="Shroom 网页测试台"
                  allow="serial"
                  loading="lazy"
                  className="block h-[620px] w-full border-0 sm:h-[760px]"
                />
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
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[#2563eb]">文档与示例</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">从第一个 Demo 到完整应用。</h2>
              <p className="mt-5 leading-7 text-[#667085]">用清晰的入门路径、API 说明和示例代码，帮助团队快速形成可交付成果。</p>
            </div>
            <Link href="/docs" className="text-sm font-semibold text-[#175cd3] hover:underline">进入完整文档中心 →</Link>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {resources.map((resource, index) => (
              <a key={resource.title} href={resource.href} className="group rounded-2xl border border-[#e4e7ec] p-7 transition hover:border-[#84adff] hover:shadow-[0_14px_40px_rgba(16,24,40,0.06)]">
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

      {/* 获取 SDK 前的登记弹窗。不是审批：提交完当场就开始下载，登记失败也照下不误 */}
      {gateOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#101828]/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sdk-gate-title"
          onClick={(e) => {
            // 只有点在遮罩本身（不是卡片）上才关
            if (e.target === e.currentTarget && !submitting) setGateOpen(false);
          }}
        >
          <form
            onSubmit={submitGate}
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 text-[#101828] shadow-2xl sm:p-8"
          >
            <button
              type="button"
              aria-label="关闭"
              disabled={submitting}
              onClick={() => setGateOpen(false)}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-lg text-[#98a2b3] transition hover:bg-[#f2f4f7] hover:text-[#344054] disabled:opacity-40"
            >
              ×
            </button>

            <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#2563eb]">
              {gateTarget.source === 'desktop-win' ? 'DESKTOP DOWNLOAD' : 'SDK DOWNLOAD'}
            </p>
            <h3 id="sdk-gate-title" className="mt-2 text-xl font-semibold">{gateTarget.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#667085]">{gateTarget.subtitle}</p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-xs font-semibold text-[#344054]">
                姓名
                <input required name="name" autoComplete="name" placeholder="怎么称呼你" className="h-11 rounded-lg border border-[#d0d5dd] px-3.5 text-sm font-normal outline-none transition placeholder:text-[#98a2b3] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]" />
              </label>
              <label className="grid gap-2 text-xs font-semibold text-[#344054]">
                手机号
                <input required name="phone" autoComplete="tel" placeholder="用于接入沟通" className="h-11 rounded-lg border border-[#d0d5dd] px-3.5 text-sm font-normal outline-none transition placeholder:text-[#98a2b3] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]" />
              </label>
              <label className="grid gap-2 text-xs font-semibold text-[#344054] sm:col-span-2">
                邮箱 <span className="font-normal text-[#98a2b3]">（选填）</span>
                <input type="email" name="email" autoComplete="email" placeholder="用于接收更新通知" className="h-11 rounded-lg border border-[#d0d5dd] px-3.5 text-sm font-normal outline-none transition placeholder:text-[#98a2b3] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]" />
              </label>
              <label className="grid gap-2 text-xs font-semibold text-[#344054] sm:col-span-2">
                所在公司 / 学校 / 机构 <span className="font-normal text-[#98a2b3]">（选填）</span>
                <input name="organization" autoComplete="organization" placeholder="请输入机构名称" className="h-11 rounded-lg border border-[#d0d5dd] px-3.5 text-sm font-normal outline-none transition placeholder:text-[#98a2b3] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]" />
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-lg bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#175cd3] disabled:opacity-60"
            >
              {submitting ? '下载中…' : '提交并下载'}
            </button>
            <p className="mt-3 text-center text-[11px] leading-5 text-[#98a2b3]">
              提交即表示你同意我们仅将信息用于产品相关的技术支持联系。
            </p>
          </form>
        </div>
      )}

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
            <a href="#downloads" className="hover:text-[#175cd3]">SDK 与上位机</a>
            <Link href="/docs" className="hover:text-[#175cd3]">文档中心</Link>
            <a href="/lab.html" target="_blank" rel="noreferrer" className="hover:text-[#175cd3]">网页测试台</a>
            <Link href="/docs/readme" className="hover:text-[#175cd3]">排错与支持</Link>
          </div>
          <p className="text-[11px] text-[#98a2b3]">© 2026 Shroom. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
