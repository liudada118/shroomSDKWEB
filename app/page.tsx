'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDownload, useLicenseRequest } from './DownloadProvider';
import SdkInstall from './SdkInstall';
import HeroDataVisual from './HeroDataVisual';
import { DESKTOP_PLATFORMS, SDK_VARIANTS, SERIAL_DRIVERS, SDK_SOURCE_URL } from './downloads';
import { productSpecifications } from './product-specifications';
import styles from './home.module.css';

const GLOVE_LAB_URL = 'https://glove.jq-industries.io/';

// 编号只用于操作顺序，能力和产品资料不与使用步骤混排。
const workflows = [
  {
    id: 'sdk-flow', title: 'SDK 接入', audience: '开发自己的应用',
    slogan: '一个函数，把产品数据交给你的应用。',
    steps: [
      { title: '安装驱动与 SDK', detail: 'JavaScript / TypeScript 项目通过 npm 安装。' },
      { title: '搜索串口，激活 SDK 授权', detail: '选择实际端口，使用 Shroom SDK 产品密钥。' },
      { title: '调用 readProduct()', detail: '传入产品与串口，按对应产品确认侧别和协议。' },
      { title: '收到产品数据', detail: '在 onData 接收数据，再按需扩展采集与下载。' },
    ],
    href: '/docs/quick-start?tab=guide', action: '查看 SDK 接入说明',
  },
  {
    id: 'desktop-flow', title: '上位机使用', audience: '直接使用现成软件',
    slogan: '打开软件，查看、采集和导出设备数据。',
    steps: [
      { title: '安装驱动与上位机', detail: '按电脑系统下载，无需另外安装 SDK。' },
      { title: '激活上位机授权', detail: '在软件内使用对应的上位机产品密钥。' },
      { title: '选择设备与串口', detail: '按实际设备选择对应入口和串口连接。' },
      { title: '查看、采集与导出', detail: '在软件内完成操作，具体功能以对应版本为准。' },
    ],
    href: '#desktop-downloads', action: '下载上位机与驱动',
  },
];

const capabilities = [
  { icon: 'device', title: '产品数据读取', description: '通过 readProduct() 获取已支持产品的结构化数据。鞋垫与人体全身从 SDK 0.3.0 起支持。', detail: 'Node.js 取数 · 浏览器通过 WS 接收' },
  { icon: 'parse', title: '连接与协议解析', description: '处理串口连接、拆帧与产品点位映射。Node 产品连接支持有限自动重连。', detail: '协议内置 · 结构化错误 · 连接状态' },
  { icon: 'record', title: '数据采集', description: '按标签开始、停止采集，数据存入 SQLite，按记录导出 CSV 或 JSONL。', detail: 'Node.js 保存 · 浏览器控制采集' },
  { icon: 'view', title: '浏览器可视化', description: '展示手套五指、指腹和手掌分区，以及手垫压力热图，按收到的数据更新。', detail: '产品视图 · 通用点阵、热斑与网格' },
];

function CapabilityIcon({ kind }: { kind: string }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'device' ? <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M10 7h4M10 17h4M3 9v6M21 9v6" /></>
      : kind === 'parse' ? <path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 4l-4 16" />
      : kind === 'record' ? <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>
      : <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /><rect x="9" y="9" width="6" height="6" fill="currentColor" stroke="none" /></>}
  </svg>;
}

export default function Home() {
  const [activePlatform, setActivePlatform] = useState('windows');
  const selectedPlatform = DESKTOP_PLATFORMS.find(platform => platform.id === activePlatform) ?? DESKTOP_PLATFORMS[0];
  const selectedDriver = SERIAL_DRIVERS.find(driver => driver.id === selectedPlatform.id);
  const openDownload = useDownload();
  const requestLicense = useLicenseRequest();

  return <div className={styles.page}>
    <section id="top" className={styles.hero} aria-labelledby="home-title">
      <div className={styles.container + ' ' + styles.heroLayout}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>SHROOM 开发者中心</p>
          <h1 id="home-title">让传感器数据，<br /><span>接入你的应用。</span></h1>
          <p className={styles.heroDescription}>用 SDK 一步获取产品数据，开发自己的应用；<br className={styles.desktopBreak} />用上位机直接查看、采集与导出。</p>
          <div className={styles.actions}>
            <a href="#sdk-flow" className={styles.primaryButton}>使用 SDK 开发 <span aria-hidden="true">→</span></a>
            <a href="#desktop-flow" className={styles.secondaryButton}>使用上位机 <span aria-hidden="true">→</span></a>
          </div>
          <p className={styles.heroNote}>从连接设备，到让数据为你所用。</p>
        </div>
        <div className={styles.heroVisual}><HeroDataVisual /></div>
      </div>
    </section>

    <section id="workflows" className={styles.section} aria-labelledby="workflows-title">
      <div className={styles.container}>
        <header className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}>两种使用方式</p><h2 id="workflows-title">SDK 接入与上位机使用</h2><p>开发应用或直接使用，各有一条清楚的路径。</p></div>
        </header>
        <div className={styles.flowGrid}>
          {workflows.map(flow => <article id={flow.id} key={flow.id} className={styles.flowCard} aria-labelledby={flow.id + '-title'}>
            <div className={styles.flowTitle}><h3 id={flow.id + '-title'}>{flow.title}</h3><span>{flow.audience}</span></div>
            <p className={styles.flowSlogan}>{flow.slogan}</p>
            <ol className={styles.steps} aria-label={flow.title + '流程'}>
              {flow.steps.map((step, index) => <li key={step.title}>
                <span className={styles.stepNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div><h4>{step.title}</h4><p>{step.detail}</p></div>
              </li>)}
            </ol>
            <Link href={flow.href} className={styles.textLink}>{flow.action} <span aria-hidden="true">→</span></Link>
          </article>)}
        </div>
      </div>
    </section>

    <section id="capabilities" className={styles.section + ' ' + styles.tinted} aria-labelledby="capabilities-title">
      <div className={styles.container}>
        <header className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}>连接 · 解析 · 采集 · 展示</p><h2 id="capabilities-title">SDK 能力中心</h2><p>基础工作交给 SDK，让开发专注于应用本身。</p></div>
          <Link href="/docs/quick-start" className={styles.textLink}>查看调用流程 <span aria-hidden="true">→</span></Link>
        </header>
        <div className={styles.capabilityGrid}>
          {capabilities.map(capability => <article key={capability.title} className={styles.capabilityCard}>
            <span className={styles.icon}><CapabilityIcon kind={capability.icon} /></span>
            <h3>{capability.title}</h3><p>{capability.description}</p><p className={styles.cardMeta}>{capability.detail}</p>
          </article>)}
        </div>
      </div>
    </section>

    <section id="products" className={styles.section} aria-labelledby="products-title">
      <div className={styles.container}>
        <header className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}>产品规格书</p><h2 id="products-title">产品资料</h2><p>查看产品规格与技术参数，点击直接打开 PDF 规格书。</p></div>
        </header>
        <div className={styles.productGrid}>
          {productSpecifications.map(specification => <a key={specification.id} className={styles.productCard}
            href={specification.href} target="_blank" rel="noopener noreferrer"
            aria-label={`查看${specification.name}规格书（PDF，新标签页打开）`}>
            <div className={styles.productHeading}><h3>{specification.name}</h3><span className={styles.documentType}>PDF</span></div>
            <p className={styles.productFilename}>{specification.displayFileName}</p>
            <span className={styles.textLink}>查看规格书 <span aria-hidden="true">↗</span></span>
          </a>)}
        </div>
      </div>
    </section>

    <section id="downloads" className={styles.section + ' ' + styles.tinted} aria-labelledby="sdk-downloads-title">
      <div className={styles.container}>
        <header className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}>安装即可开始</p><h2 id="sdk-downloads-title">SDK 下载</h2><p>通过 npm 安装，在 Node.js 或浏览器项目中调用。</p></div>
          <Link href="/docs" className={styles.textLink}>进入文档中心 <span aria-hidden="true">→</span></Link>
        </header>
        <div className={styles.downloadGrid}>
          {SDK_VARIANTS.map(variant => <article key={variant.source} aria-labelledby={variant.source + '-title'} className={styles.sdkCard}>
            <div className={styles.downloadTitle}><span className={styles.languageBadge} aria-hidden="true">JS</span><span className={styles.version}>v{variant.sdkVersion} · npm</span></div>
            <h3 id={variant.source + '-title'}>JavaScript / TypeScript SDK</h3>
            <p className={styles.downloadDescription}>{variant.description}</p>
            <p>{variant.details}</p>
            <p className={styles.sdkRequirements}>{variant.contents}</p>
            <div className={styles.install}><SdkInstall /></div>
            <div className={styles.downloadActions}>
              <button type="button" onClick={() => openDownload(variant)} className={styles.secondaryButton}>下载安装包</button>
              <Link href={variant.guideHref} className={styles.textLink}>使用指南 <span aria-hidden="true">→</span></Link>
              <a href={SDK_SOURCE_URL} target="_blank" rel="noreferrer" className={styles.textLink}>查看源码 <span aria-hidden="true">↗</span></a>
            </div>
          </article>)}
        </div>
        <div className={styles.licenseStrip}><p><strong>SDK 可直接安装与下载</strong><span>连接真实设备前，单独申请并激活 Shroom SDK 产品密钥。</span></p><button type="button" onClick={requestLicense} className={styles.textLink}>申请 SDK 密钥 <span aria-hidden="true">→</span></button></div>
      </div>
    </section>

    <section id="desktop-downloads" className={styles.section} aria-labelledby="desktop-downloads-title">
      <div className={styles.container}>
        <header className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}>软件与驱动下载</p><h2 id="desktop-downloads-title">Shroom 上位机</h2><p>安装即用，让设备数据看得见。按电脑系统下载，无需额外安装 SDK。</p></div>
        </header>
        <div className={styles.platforms} role="group" aria-label="选择上位机系统">
          {DESKTOP_PLATFORMS.map(platform => <button key={platform.id} type="button" aria-pressed={selectedPlatform.id === platform.id} aria-controls="desktop-package" onClick={() => setActivePlatform(platform.id)}>{platform.label}</button>)}
        </div>
        <div id="desktop-package" className={styles.desktopGrid}>
          <article className={styles.desktopCard} aria-labelledby="desktop-package-title">
            <div className={styles.downloadTitle}><h3 id="desktop-package-title">Shroom · {selectedPlatform.label}</h3><span className={styles.version}>v{selectedPlatform.version}</span></div>
            <p>{selectedPlatform.description}</p>
            <dl className={styles.packageFacts}><div><dt>兼容环境</dt><dd>{selectedPlatform.compatibility}</dd></div><div><dt>安装包</dt><dd>{selectedPlatform.format} · {selectedPlatform.sizeLabel}</dd></div></dl>
            <button type="button" onClick={() => openDownload(selectedPlatform.target)} className={styles.primaryButton}>下载 {selectedPlatform.label} 上位机 <span aria-hidden="true">↓</span></button>
            <p className={styles.installNote}>{selectedPlatform.installNote}</p>
          </article>
          <aside id="serial-drivers" className={styles.driverCard} aria-labelledby="serial-drivers-title">
            <span id="serial-driver-details" className={styles.anchor} />
            <p className={styles.eyebrow}>连接设备前</p><h3 id="serial-drivers-title">{selectedPlatform.label} 驱动与权限</h3>
            <p>{selectedDriver ? '安装匹配的串口驱动后重插设备，确认系统能够识别串口，再连接上位机或 SDK。' : 'Linux 通常使用内核自带驱动。请确认串口可见，并为当前用户配置串口访问权限。'}</p>
            {selectedDriver ? <><a href={selectedDriver.url} target="_blank" rel="noreferrer" className={styles.secondaryButton}>下载 {selectedDriver.label} 驱动 · {selectedDriver.format} <span aria-hidden="true">↗</span></a><p className={styles.driverNote}>{selectedDriver.installNote}</p></> : <p className={styles.driverNote}>{selectedPlatform.driverNote}</p>}
            <Link href="/docs/drivers" className={styles.textLink}>安装与串口排查 <span aria-hidden="true">→</span></Link>
          </aside>
        </div>
      </div>
    </section>

    <section id="docs" className={styles.section + ' ' + styles.tinted} aria-labelledby="home-docs-title">
      <div className={styles.container}>
        <header className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}>开发说明与 AI 辅助</p><h2 id="home-docs-title">文档中心</h2><p>从第一次取数，到完成你的应用，按任务找到接入说明。</p></div>
          <Link href="/docs" className={styles.textLink}>全部文档 <span aria-hidden="true">→</span></Link>
        </header>
        <div className={styles.docsGrid}>
          <Link id="quick-start" href="/docs/quick-start" className={styles.docCard}><span className={styles.eyebrow}>快速接入</span><h3>一步拿到产品数据</h3><p>先完成取数，再按需创建 WS、采集和下载。</p><span className={styles.cardAction}>查看调用流程 <span aria-hidden="true">→</span></span></Link>
          <Link id="skill" href="/docs/skills" className={styles.docCard}><span className={styles.eyebrow}>AI 开发辅助</span><h3>用 Skill 快速接入</h3><p>把接入约定交给 AI，按实际产品和环境生成调用代码。</p><span className={styles.cardAction}>查看 Skill 使用说明 <span aria-hidden="true">→</span></span></Link>
        </div>
        <nav id="tools" className={styles.tools} aria-label="辅助开发工具"><span>辅助工具</span><a id="web-lab" href="/lab.html" target="_blank" rel="noreferrer" className={styles.textLink}>网页测试台 <span aria-hidden="true">↗</span></a><a href={GLOVE_LAB_URL} target="_blank" rel="noreferrer" className={styles.textLink}>手套体验站 <span aria-hidden="true">↗</span></a><Link href="/knowledge" className={styles.textLink}>AI 文档问答 <span aria-hidden="true">→</span></Link></nav>
      </div>
    </section>
  </div>;
}
