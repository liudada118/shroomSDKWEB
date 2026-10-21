'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useDownload } from '../DownloadProvider';
import { SERIAL_DRIVERS, SDK_VARIANTS } from '../downloads';
import { createProductExample } from '../../sdk/examples/product-examples.js';
import CopyRawButton from './CopyRawButton';
import { useProductWorkspace } from './product-workspace-state';
import { workspaceLocationTarget, type WorkspaceSection, type WorkspaceTab } from './product-workspace-model';
import styles from './ProductWorkspace.module.css';

type Props = { raw: string; extensionHtml: string };
type Row = [string, string, string];
type CodeTopic = 'license' | 'connect' | 'data' | 'errors' | 'close';
const topics: { key: CodeTopic; label: string; pattern: RegExp }[] = [
  { key: 'license', label: '授权', pattern: /(?:await\s+.*activateLicense|async function activate|function activate)/ },
  { key: 'connect', label: '连接', pattern: /await\s+.*connectProduct\(/ },
  { key: 'data', label: '数据回调', pattern: /(?:\.onData\(|\bonData\s*[:(])/ },
  { key: 'errors', label: '运行错误', pattern: /(?:\.onError\(|\bonError\s*[:(])/ },
  { key: 'close', label: '关闭资源', pattern: /(?:async function (?:stop|close|disconnect)|function (?:stop|close|disconnect)|await\s+.*\.close\()/ },
];

function Chapter({ id, number, title, before, children }: { id: WorkspaceSection; number: string; title: string; before: string; children: ReactNode }) {
  return <section id={id} className={styles.chapter} aria-labelledby={`${id}-title`} tabIndex={-1}>
    <div className={styles.chapterHeading}><span className={styles.chapterNumber} aria-hidden="true">{number}</span><div><h2 id={`${id}-title`}>{title}</h2><p>开始前：{before}</p></div></div>
    {children}
  </section>;
}

function DataTable({ caption, headings, rows }: { caption: string; headings: [string, string, string]; rows: Row[] }) {
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={caption}><table className={styles.table}><caption>{caption}</caption><thead><tr>{headings.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map(([field, size, text]) => <tr key={field}><th scope="row"><code>{field}</code></th><td>{size}</td><td>{text}</td></tr>)}</tbody></table></div>;
}

/** 文档页只生成配置和示例；授权、串口连接与安装标识均在用户运行示例时执行。 */
export default function ProductWorkspace({ raw, extensionHtml }: Props) {
  const { state, ready, filename, code, previewCode, commands, confirmSide, setEnvironment, setPlatform, setTab, navigateChapter, setCodeKind } = useProductWorkspace();
  const configurationKey = [state.product, state.side, state.sideConfirmed, state.env, state.platform].join(':');
  const [checkedConfiguration, setCheckedConfiguration] = useState(configurationKey);
  const openDownload = useDownload();
  const jsDownload = SDK_VARIANTS.find(target => target.source === 'sdk-node')!;
  const pythonDownload = SDK_VARIANTS.find(target => target.source === 'sdk-python')!;
  const [notice, setNotice] = useState('');
  const [portChecked, setPortChecked] = useState(false);
  const [checks, setChecks] = useState({ frame: false, mapping: false, units: false });
  const [selectedLine, setSelectedLine] = useState<{ source: string; line: number } | null>(null);
  const extensionRef = useRef<HTMLDetailsElement>(null);
  const guideRef = useRef<HTMLDetailsElement>(null);
  const pythonRef = useRef<HTMLDetailsElement>(null);
  const codeRef = useRef<HTMLPreElement>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const glove = state.product === 'glove';
  const node = state.env === 'node';
  const productName = glove ? '触觉手套' : '手部检测垫';
  const productId = glove ? 'handGloveFullPacket' : 'hand';
  const sideName = state.side === 'left' ? '左手' : state.side === 'right' ? '右手' : '待确认';
  const environmentName = node ? 'Node.js' : '浏览器 JavaScript';
  const platformName = state.platform === 'windows' ? 'Windows' : state.platform === 'macos' ? 'macOS' : 'Linux';
  const displayedCode = ready ? code : previewCode;
  const codeLines = displayedCode.split('\n');
  const topicLines = Object.fromEntries(topics.map(topic => [topic.key, codeLines.findIndex(line => !line.trimStart().startsWith('//') && topic.pattern.test(line))])) as Record<CodeTopic, number>;

  // 变更实物或运行配置时，立即清空人工检查记录；保留 DOM 与键盘焦点。
  // 仅在配置键变化时调整状态，章节 / 参考资料 / 示例类型切换不触发。
  if (checkedConfiguration !== configurationKey) {
    setCheckedConfiguration(configurationKey);
    setPortChecked(false);
    setChecks({ frame: false, mapping: false, units: false });
  }

  useEffect(() => {
    if (copyFallback !== null) {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
      fallbackRef.current?.scrollIntoView({ block: 'center' });
    }
  }, [copyFallback]);

  // 折叠资料保持原生深链。导航事件只展开，不回调 navigateChapter 造成循环。
  useEffect(() => {
    const reveal = (id: string, scroll: boolean) => {
      const target = document.getElementById(id);
      if (!target) return;
      const details = guideRef.current?.contains(target) ? guideRef.current : extensionRef.current?.contains(target) ? extensionRef.current : null;
      if (!details) return;
      details.open = true;
      for (let parent = target.parentElement; parent && details.contains(parent); parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      }
      if (scroll) window.requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'start' });
        target.focus({ preventScroll: true });
      });
    };
    const revealHash = () => {
      const id = workspaceLocationTarget(window.location.search, window.location.hash);
      if (id) reveal(id, true);
    };
    const revealChapter = (event: Event) => {
      const section = (event as CustomEvent<{ section?: string }>).detail?.section;
      if (section) reveal(section, false);
    };
    revealHash();
    window.addEventListener('hashchange', revealHash);
    window.addEventListener('popstate', revealHash);
    window.addEventListener('shroom:workspace-chapter', revealChapter);
    return () => {
      window.removeEventListener('hashchange', revealHash);
      window.removeEventListener('popstate', revealHash);
      window.removeEventListener('shroom:workspace-chapter', revealChapter);
    };
  }, [extensionHtml]);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFallback(null);
      setNotice(`${label}已复制。`);
    } catch {
      setCopyFallback(text);
      setNotice('浏览器未允许剪贴板访问，请在下方文本框中全选复制。');
    }
  }

  function downloadExample() {
    if (!ready) return;
    const source = createProductExample({ ...state, side: glove ? state.side ?? undefined : undefined, kind: 'complete' });
    const url = URL.createObjectURL(new Blob([source], { type: node ? 'text/javascript;charset=utf-8' : 'text/html;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`已生成 ${filename}，请保存到解压后的 SDK 根目录。`);
  }

  function locateCode(topic: CodeTopic) {
    const index = topicLines[topic];
    if (index < 0) return;
    setSelectedLine({ source: displayedCode, line: index + 1 });
    codeRef.current?.querySelector<HTMLElement>(`[data-line="${index + 1}"]`)?.scrollIntoView({ block: 'nearest' });
    codeRef.current?.focus({ preventScroll: true });
    setNotice(`已定位“${topics.find(item => item.key === topic)!.label}”，第 ${index + 1} 行。`);
  }

  function diagnostics() {
    return JSON.stringify({ sdk: jsDownload.sdkVersion, product: productId, side: glove ? (state.sideConfirmed ? state.side : '未按实物确认') : '不需要', environment: environmentName, platform: platformName, source: '文档页手动记录，未连接设备', manualChecks: { systemPortVisible: portChecked, ...checks }, questions: ['系统可见的实际串口是什么？', '失败发生在激活、打开端口、首帧还是取数期间？', '完整示例显示的错误 code、stage、suggestion 是什么？', '已知触点与返回分区是否一致？'], privacy: '请补充脱敏错误信息；不要提供密钥。' }, null, 2);
  }

  const parameters: Row[] = [
    ['product', productId, glove ? '整包手套协议；不是 hand，也不是串口自动识别结果。' : '手部检测垫协议，产品接口内置 32 × 32 映射。'],
    ...(glove ? [['side', state.sideConfirmed ? sideName : '待按实物确认', 'left / right 决定映射。SDK 无法根据串口或包类型推断手侧。'] as Row] : []),
    ['运行入口', environmentName, node ? '由 node/index.js 在本机打开串口。' : '由 web/index.js 通过 Web Serial 连接。'],
    ['串口', node ? (state.platform === 'windows' ? '实际 COM 端口' : state.platform === 'macos' ? '/dev/cu.* 实际路径' : '实际串口设备路径') : '连接时由浏览器选择', '系统串口可见不代表产品协议或手侧已经正确。'],
  ];
  const outputRows: Row[] = glove ? [
    ['fingersADC.thumb.body', 'data.fingers.thumb.raw', '触按拇指主体，观察对应 12 个 ADC；其他四指同理。'],
    ['fingersADC.thumb.pulp', 'data.fingers.thumb.pulp.raw', '单独触按拇指指腹，观察独立指腹点。'],
    ['palmADC', 'data.palm.matrix', '逐个触按已知手掌位置，观察 5 行 / 72 点；行长为 12、15、15、15、15。'],
    ['rawADCFirst16', 'data.pressure 的前 16 点', '只预览原始扫描顺序，不能代替全手或分区验收。'],
  ] : [
    ['pressureMatrixADC', 'data.pressureMatrix', '示例按 32 行显示全部 1,024 个 ADC；触按已知位置，比较对应行列。'],
    ['rawADCFirst16', 'data.pressure 的前 16 点', '原始扫描顺序预览，不按显示位置排列；不要再次映射 pressureMatrix。'],
  ];
  const fieldRows: Row[] = glove ? [
    ['pressure / raw', '256 个 ADC', '原始扫描顺序压力通道值；两者指向同一份帧内快照。'],
    ['fingers.*.raw', '每指主体 12 点', 'thumb、index、middle、ring、little；每指另有独立 pulp 指腹 1 点。'],
    ['palm.matrix', '5 行 / 72 点', '实际行长 [12, 15, 15, 15, 15]，不自动补零为规则矩阵。'],
    ['side', state.sideConfirmed ? sideName : '待确认', '来自应用提供的 left / right，不是实物手侧识别结果。'],
    ['imu.raw', '16 字节', '仅原始 IMU 字节，不提供姿态、单位或手势结果。'],
  ] : [
    ['pressure / raw', '1,024 个 ADC', '保留设备原始扫描顺序。'],
    ['pressureMatrix', '1,024 个 ADC', '已经过 mat32 映射，无需再次重排。'],
    ['values', '1,024 个浮点值', '与矩阵对应的归一化相对值，按行优先排列。'],
    ['rows / cols', '32 / 32', '由产品接口内置的矩阵尺寸。'],
    ['max / avg / center', '基础 Frame 统计', '基于映射矩阵的统计，不是标定后的物理量。'],
  ];
  const count = Object.values(checks).filter(Boolean).length;
  const references: { key: WorkspaceTab; label: string; id: string }[] = [
    { key: 'start', label: '接入指南', id: 'product-start' },
    { key: 'data', label: '数据字段与映射', id: 'product-data' },
    { key: 'debug', label: '连接排查', id: 'product-debug' },
    { key: 'downloads', label: '相关下载', id: 'product-downloads' },
  ];
  const readiness = ready ? `${productName}${glove ? ` · ${sideName}` : ''} · ${environmentName}，完整示例已就绪。` : '请先在顶部按实物确认左手或右手，再生成示例。';

  const codeTopicNavigation = <div className={styles.topicNav} role="group" aria-label="定位示例的关键逻辑">{topics.map(topic => <button type="button" key={topic.key} disabled={topicLines[topic.key] < 0} title={topicLines[topic.key] < 0 ? '完整示例包含此逻辑' : undefined} onClick={() => locateCode(topic.key)}>{topic.label}</button>)}</div>;

  return <div className={styles.workspace}>
    <header className={styles.pageHeading}><div><h1>{productName}</h1><p>{glove ? '获取五指、指腹与手掌分区数据。' : '读取已映射的 32 × 32 压力矩阵。'}</p></div></header>
    <div className={styles.driverStrip} aria-label="串口驱动前置条件"><div><strong>串口驱动</strong><span>安装 → 重插设备 → 确认系统端口</span></div><div>{SERIAL_DRIVERS.map(driver => <a key={driver.id} href={driver.url}>{driver.label} · {driver.format} ↗</a>)}</div></div>
    <div id="workspace-config" className={styles.configurationPanel}>
      <div className={styles.configuration}>
        <div className={styles.sideControl}><span>{glove ? '手套手侧' : '产品规格'}</span>{glove ? <div className={styles.segmented} role="group" aria-label="按实际设备确认手侧">{(['left', 'right'] as const).map(side => <button id={`workspace-side-${side}`} key={side} type="button" aria-pressed={state.sideConfirmed && state.side === side} onClick={() => confirmSide(side)}>{side === 'left' ? '左手' : '右手'}</button>)}</div> : <strong>32 × 32 标准矩阵</strong>}</div>
        <label className={styles.inlineSelect}>开发环境<select value={state.env} onChange={event => setEnvironment(event.target.value as 'web' | 'node')}><option value="web">浏览器 JavaScript</option><option value="node">Node.js</option></select></label>
        <label className={styles.inlineSelect}>采集电脑<select value={state.platform} onChange={event => setPlatform(event.target.value as 'windows' | 'macos' | 'linux')}><option value="windows">Windows</option><option value="macos">macOS</option><option value="linux">Linux</option></select></label>
      </div>
      <div className={styles.configFooter}><p id="workspace-ready" hidden={ready}>请先按实物选择左手或右手，再下载示例。</p><details ref={pythonRef} className={styles.pythonSupport}><summary>Python 支持范围</summary><div><p>Python 提供通用串口、拆帧、矩阵映射和同步逐帧读取，没有 JavaScript 的 connectProduct 产品快捷接口。检测垫可按实际协议与 32 × 32 尺寸走通用矩阵路线；整包手套、手指 / 手掌分区和 IMU 暂不支持。</p><div className={styles.actions}><Link className={styles.textLink} href="/docs/backend?language=python">阅读 Python 接入文档 →</Link><button type="button" className={styles.secondaryButton} onClick={() => openDownload(pythonDownload)}>下载 Python SDK</button></div></div></details></div>
    </div>
    <div className={styles.referenceNav} role="group" aria-label="接入指南与参考资料">{references.map(item => <button type="button" key={item.key} aria-pressed={state.tab === item.key} aria-controls={item.id} onClick={() => setTab(item.key)}>{item.label}</button>)}</div>
    <div role="status" aria-live="polite" className={styles.notice}>{notice}</div>

    <div id="product-start" hidden={state.tab !== 'start'}>
      <div className={styles.workbenchGrid}>
        <div className={styles.workbenchMain}>
          <section className={styles.downloadPanel} aria-labelledby="workspace-start-title"><h2 id="workspace-start-title">下载与运行</h2><div className={styles.actions}><button type="button" className={styles.primaryButton} disabled={!ready} aria-describedby={!ready ? 'workspace-ready' : undefined} onClick={downloadExample}>下载完整示例</button><button type="button" className={styles.secondaryButton} onClick={() => openDownload(jsDownload)}>下载 JavaScript SDK</button></div><div className={styles.releaseMeta}><span>SDK v{jsDownload.sdkVersion}</span>{ready && <span>{filename}</span>}</div></section>
          <section id="workspace-run" className={styles.quickSteps} aria-labelledby="workspace-steps-title"><div className={styles.sectionHeading}><h2 id="workspace-steps-title">三步接入</h2><button type="button" className={styles.textLink} onClick={() => navigateChapter('guide-run')}>完整说明 →</button></div><p className={styles.hint}>{node ? '需 Node.js 18+ 和 SDK 产品密钥。' : '需 Node.js 18+、桌面 Chrome / Edge（Web Serial）。浏览器直连无需 npm install。'}</p><ol>
            <li><span aria-hidden="true">1</span><div><h3>解压并放好示例</h3><p>解压 SDK，把 <code>{ready ? filename : '产品示例'}</code> 放在根目录，与 <code>web/</code>、<code>node/</code> 同级。</p></div></li>
            <li><span aria-hidden="true">2</span><div><h3>运行命令</h3><div className={styles.command}><pre><code>{node ? ready ? commands : '# 选择手侧后显示启动命令' : 'node start.mjs --no-open'}</code></pre><button type="button" className={styles.inlineCopy} disabled={node && !ready} onClick={() => copy(node ? commands : 'node start.mjs --no-open', '运行命令')}>复制</button></div>{node ? <p>替换密钥和实际串口。离线授权设置见完整说明。</p> : <p>打开终端实际 localhost 地址下的 <code>{ready ? filename : '示例文件.html'}</code>，不要双击 HTML。</p>}</div></li>
            <li><span aria-hidden="true">3</span><div><h3>授权后连接</h3><p>{node ? '程序激活 SDK 授权后，自动打开指定端口。' : '在完整示例粘贴 SDK 密钥 → 激活授权 → 连接设备。'}</p></div></li>
          </ol></section>
          <section id="workspace-code" className={styles.corePreview} aria-labelledby="workspace-code-title"><h2 id="workspace-code-title">{state.codeKind === 'complete' ? '完整示例' : '核心代码'}</h2><p className={styles.codePrerequisite}>{<>{state.codeKind === 'complete' ? '包含授权、连接、错误处理和关闭；运行方式见上方三步。' : '适用于已完成 SDK 授权的项目；独立运行请用完整示例。'}{!ready && <span>只读演示：手侧参数未按实物确认。</span>}</>}</p>{state.codeKind === 'complete' && codeTopicNavigation}<div className={styles.codeCard}><div className={styles.codeHeader}><div className={styles.codeTools}><div className={styles.segmented} role="group" aria-label="示例内容"><button type="button" aria-pressed={state.codeKind === 'snippet'} onClick={() => setCodeKind('snippet')}>核心代码</button><button type="button" aria-pressed={state.codeKind === 'complete'} onClick={() => setCodeKind('complete')}>完整示例</button></div><button type="button" className={styles.secondaryButton} disabled={!ready} onClick={() => copy(displayedCode, state.codeKind === 'complete' ? '完整示例' : '核心代码')}>{state.codeKind === 'complete' ? '复制完整示例' : '复制已有项目片段'}</button></div></div><pre ref={codeRef} className={styles.codeBody} tabIndex={0} aria-label="带中文注释的产品示例源码"><code>{codeLines.map((line, index) => <span className={`${styles.codeLine} ${selectedLine?.source === displayedCode && selectedLine.line === index + 1 ? styles.selectedLine : ''} ${line.trimStart().startsWith('//') || line.trimStart().startsWith('<!--') ? styles.comment : ''}`} key={index} data-line={index + 1}><span className={styles.lineNumber} aria-hidden="true">{index + 1}</span>{line || ' '}</span>)}</code></pre></div>{state.codeKind === 'complete' && <p className={styles.codeScrollHint}>完整源码共 {codeLines.length} 行，在代码区内滚动查看。</p>}{state.codeKind === 'snippet' && <details className={styles.codeTopics}><summary>定位代码段</summary>{codeTopicNavigation}</details>}</section>
        </div>
        <aside className={styles.productAside} aria-label="当前产品数据与验收提示"><section className={styles.productCard}><h2>产品数据</h2><p>{glove ? '256 通道，五指、指腹和手掌分区。' : '1,024 通道，32 × 32 映射矩阵。'}</p><details className={styles.fieldDetails}><summary>查看字段</summary><ul className={styles.fieldSummary}>{(glove ? [['fingers.*.raw', '五指主体 ADC'], ['fingers.*.pulp', '独立指腹点'], ['palm.matrix', '手掌 5 行 / 72 点'], ['imu.raw', '16 字节原始 IMU']] : [['pressure', '原始扫描 ADC'], ['pressureMatrix', '已映射矩阵 ADC'], ['values', '归一化相对值'], ['rows / cols', '固定 32 / 32']]).map(([field, label]) => <li key={field}><code>{field}</code><span>{label}</span></li>)}</ul><button type="button" className={styles.textLink} onClick={() => setTab('data')}>字段与映射参考 →</button></details></section><section className={styles.successCard}><h2>验收看这三项</h2><ul><li>有效帧持续增加</li><li>触点与分区一致</li><li>断开后可重新连接</li></ul><button type="button" className={styles.textLink} onClick={() => setTab('debug')}>连接排查 →</button></section></aside>
      </div>
      <details ref={guideRef} className={styles.fullGuide} open><summary><span>完整接入说明</span></summary><div className={styles.guideContent}>
      <Chapter id="guide-prepare" number="01" title="准备环境与 SDK 密钥" before="准备设备、支持数据传输的 USB 线和采集电脑。">
        <div className={styles.driverPanel}><h3>1.1 安装驱动，确认系统串口</h3><p>CH34x 设备缺少可用驱动时，系统无法提供串口。安装后重新插拔设备，关闭占用端口的上位机或其他采集程序。</p><div className={styles.actions}>{SERIAL_DRIVERS.map(driver => <a className={styles.secondaryButton} key={driver.id} href={driver.url}>{driver.label} 驱动 · {driver.format}</a>)}</div><p>Windows 在设备管理器中查看 COM 端口；macOS 检查新增的 <code>/dev/cu.*</code>；Linux 检查串口节点与当前用户访问权限。</p><label className={styles.check}><input type="checkbox" checked={portChecked} onChange={event => setPortChecked(event.target.checked)} /><span>我已在系统中看到设备串口<small>手动确认；本页没有检测驱动或读取设备。</small></span></label></div>
        <h3>1.2 准备运行环境与 SDK 产品密钥</h3><p>安装 Node.js 18+。浏览器使用支持 Web Serial 的桌面 Chrome / Edge，通过 localhost 或 HTTPS 访问完整示例；Node.js 路线在本机终端运行。</p><p>向交付方获取 <strong>Shroom SDK 产品密钥</strong>，确认在线密钥或 RSA 离线授权码类型。上位机密钥与 SDK 密钥分属不同产品，不能混用。SDK 授权检查有效期、状态、电脑名额与功能权限；不按手套或检测垫型号限制。</p><p className={styles.result}><strong>完成标志</strong>系统串口可见，运行环境可用，已拿到正确类型的 SDK 密钥。网页上的勾选仅记录你的检查结果。</p>
      </Chapter>

      <Chapter id="guide-config" number="02" title="确认产品与运行参数" before="核对左侧当前产品，确认实物设备与协议。">
        <p>产品、手侧、开发环境与采集系统集中在工作台顶部配置。手套必须按实物点击确认手侧；检测垫不需要 side。</p><button type="button" className={styles.textLink} onClick={() => { document.getElementById('workspace-config')?.scrollIntoView({ block: 'center' }); document.getElementById('workspace-side-left')?.focus({ preventScroll: true }); }}>返回顶部配置 →</button>
        <DataTable caption="当前配置会怎样传给 SDK" headings={['配置项', '当前值', '作用与填写方式']} rows={parameters} />
        <p className={styles.result}><strong>完成标志</strong>{ready ? `当前产品与环境已明确${glove ? `，已按实物确认${sideName}` : '；检测垫无需手侧'}，可以下载对应示例。` : '手侧尚未确认。请先点击左手或右手，再继续第 03 章。'}</p>
      </Chapter>

      <Chapter id="guide-run" number="03" title="下载并运行完整示例" before="完成产品参数确认，具备第 01 章的运行条件。">
        <h3>3.1 下载 SDK，再放入示例文件</h3><p>JavaScript SDK 提供协议、授权与连接能力；完整示例包含本次产品配置、中文注释和操作流程。浏览器与 Node.js 共用下列 SDK 包。</p><div className={styles.actions}><button type="button" className={styles.secondaryButton} onClick={() => openDownload(jsDownload)}>下载 JavaScript SDK</button><button type="button" className={styles.primaryButton} disabled={!ready} aria-describedby="guide-ready" onClick={downloadExample}>下载带注释的完整示例</button></div><p id="guide-ready" className={styles.hint}>{readiness}</p>
        <p>解压 <code>shroom-sdk-node.zip</code>，将 <code>{ready ? filename : '确认手侧后生成的示例文件'}</code> 放在 SDK 根目录，与 <code>web/</code>、<code>node/</code> 同级。不要放入这两个子目录，示例使用相对导入路径。</p><pre className={styles.fileTree} aria-label="示例放置位置">{`shroom-sdk-node/\n├─ package.json\n├─ start.mjs\n├─ node/\n├─ web/\n└─ ${ready ? filename : '确认手侧后下载的示例文件'}  ← 放在这里`}</pre>
        <h3>3.2 在 SDK 根目录执行命令</h3><p>{node ? '在包含 package.json 的目录打开终端，依次安装依赖、设置密钥并运行。命令中的密钥和端口都必须替换为实际值。' : '在包含 start.mjs 的目录打开终端，执行命令并保持终端运行。浏览器直连不需要先执行 npm install。'}</p><div className={styles.command}><pre><code>{ready ? commands : '请先确认手侧，再生成启动命令。'}</code></pre><button type="button" className={styles.secondaryButton} disabled={!ready} onClick={() => copy(commands, '运行命令')}>复制命令</button></div>
        {!node && <div className={styles.note}><strong>打开完整示例的 URL</strong><p>服务默认使用 5178 端口，占用时会尝试后续端口。以终端实际打印的 localhost 地址为准，再追加文件名：</p><code className={styles.url}>{ready ? `http://localhost:5178/${filename}` : 'http://localhost:实际端口/确认手侧后的示例文件.html'}</code><p>保留相同浏览器、访问地址和端口，以复用安装标识。不要直接双击 HTML，也不要只打开 SDK 根目录默认演示页。</p></div>}
        {node && <p className={styles.hint}>Windows 示例端口 COM3、macOS 的 /dev/cu.*、Linux 的 /dev/ttyUSB0 都是格式提示，需替换为实际串口。离线码另设置 <code>SHROOM_LICENSE_MODE=offline</code>；也可通过 <code>SHROOM_LICENSE_FILE</code> 指向密钥文件。</p>}
        <p className={styles.result}><strong>完成标志</strong>{node ? '依赖安装成功，程序开始输出“正在激活 SDK 授权”。先处理终端错误，再继续第 04 章。' : '终端打印实际 localhost 地址，打开带示例文件名的 URL 后能看到授权和连接界面。'}</p>
      </Chapter>

      <Chapter id="guide-connect" number="04" title="激活 SDK 授权，再连接设备" before="浏览器已打开完整示例，或 Node 已按第 03 章命令启动。">
        <ol className={styles.operations}>{node ? <><li><strong>激活授权：</strong>程序通过 <code>activateLicenseFromEnv()</code> 读取环境变量或密钥文件；缺少或无效密钥会报错。</li><li><strong>打开实际端口：</strong>授权通过后，程序按命令的端口参数调用 <code>connectProduct()</code>，无需浏览器串口选择框。</li><li><strong>查看状态：</strong>看到“等待首帧”或“正在取数”后，继续第 05 章验收。</li></> : <><li><strong>选择密钥类型：</strong>在完整示例中，在线密钥选在线模式，RSA 离线授权码选离线模式，粘贴 SDK 产品密钥。</li><li><strong>先点击“激活授权”：</strong>等待“授权有效”。这一步异步校验授权，不会打开串口。</li><li><strong>再点击“连接设备”：</strong>在串口列表中选择对应设备。串口选择必须由这次单独的点击触发，不能在同次点击中先等待远程激活。</li></>}</ol>
        <div className={styles.note}><strong>安装标识自动处理，无需手工生成。</strong><p>{node ? <>Node 辅助模块复用用户目录中的 <code>.shroom-sdk/device-id</code>，密钥从环境变量或文件读取。</> : <>完整示例在当前浏览器与访问地址的本地存储中保存稳定安装标识，不保存密钥。更换浏览器、地址、端口或清理存储，可能被视为新的安装。</>}</p><p>本页不采集密钥，也不生成安装标识。上述操作仅在你运行完整示例时发生。</p></div>
        <p className={styles.result}><strong>完成标志</strong>授权有效，没有打开端口错误，示例进入“等待首帧 / 正在取数”。接下来仍需验证触点与映射。</p><button type="button" className={styles.textLink} onClick={() => setTab('debug')}>授权失败或打不开串口？按症状排查 →</button>
      </Chapter>

      <Chapter id="guide-verify" number="05" title="验收真实数据，安全结束采集" before="示例已打开设备串口，准备检查有效帧和触点位置。">
        <h3>5.1 对照示例输出与 SDK 字段</h3><p>左侧是示例为便于阅读整理的显示键。接入自己的程序时，使用中间列的原始 SDK 字段。</p><DataTable caption="示例显示键与 SDK 字段对应关系" headings={['示例里看哪个键', '对应 SDK 字段', '如何验证']} rows={outputRows} />
        <h3>5.2 逐项确认接入结果</h3><p>完成真实操作后再手动勾选；本页不读取设备状态。</p><div className={styles.checks}>{([
          ['frame', '收到持续有效帧', '完整示例状态为“正在取数”，有效帧数量持续增加。'],
          ['mapping', '已知触点与数据一致', glove ? '按实物手侧，分别触按指主体、指腹和已知手掌位置，核对对应分区。' : '触按已知行列位置，核对映射后的矩阵变化。'],
          ['units', '已确认数值含义', 'ADC 为采样值；力、压力或角度需要结合实物另行标定。'],
        ] as const).map(([key, title, detail]) => <label className={styles.check} key={key}><input type="checkbox" checked={checks[key]} onChange={event => setChecks(previous => ({ ...previous, [key]: event.target.checked }))} /><span><strong>{title}</strong><small>{detail}</small></span></label>)}</div><p className={styles.checkCount} role="status" aria-live="polite">手动验收：{count} / 3 项</p>
        <h3>5.3 结束采集，检查错误恢复</h3><p>{node ? <>按 <code>Ctrl+C</code> 结束，程序关闭设备并输出累计帧数。修复设备或授权错误后重新运行命令，不要让多个进程打开同一串口。</> : '在完整示例中点击“断开”，确认已断开后再次连接，验证端口可重开。设备或授权错误后先解决原因；授权失效需重新激活。离开页面会清理会话，返回后按提示重新激活。'}</p><p className={styles.result}><strong>完成标志</strong>持续帧、触点映射和数值含义都已确认；停止后可以重新连接。只打开串口还不足以完成验收。</p><div className={styles.actions}><button type="button" className={styles.textLink} onClick={() => setTab('data')}>查看全部字段与映射 →</button><button type="button" className={styles.textLink} onClick={() => copy(diagnostics(), '配置与问题清单')}>复制配置与问题清单 →</button></div>
      </Chapter>

      <Chapter id="guide-code" number="06" title="阅读代码，接入自己的项目" before="先用完整示例完成第 05 章验收，再迁移到已有项目。">
        <h3>6.1 按五个关键动作阅读</h3><ol className={styles.operations}><li><strong>准备授权：</strong>读取 SDK 密钥，复用稳定安装标识，完成激活。</li><li><strong>连接产品：</strong><code>connectProduct</code> 接收产品参数；手套提供手侧，Node 提供实际端口。</li><li><strong>处理数据：</strong><code>onData</code> 已拿到解析和映射后的数据，在这里接入业务逻辑。</li><li><strong>处理错误：</strong><code>onError</code> 接收运行期错误，区分业务回调失败与需要停止的设备 / 授权错误。</li><li><strong>释放资源：</strong>停止、离开页面或退出程序时关闭设备；清理旧会话后再重连。</li></ol>
        <h3>6.2 阅读带中文注释的源码</h3><p>工作台默认展示已授权项目的核心调用；需要激活、恢复和完整页面时，切换完整示例或直接下载。复制的内容与当前显示内容一致。</p><button type="button" className={styles.textLink} onClick={() => document.getElementById('workspace-code')?.scrollIntoView({ block: 'start' })}>返回工作台示例代码 →</button>
        <h3>6.3 将数据回调接入业务</h3><p>保留授权、<code>connectProduct</code>、<code>onError</code> 和关闭逻辑，把 <code>onData</code> 中整理 / 打印示例 JSON 的部分替换为业务处理。{glove ? <>手指和手掌直接读取 <code>data.fingers</code> 与 <code>data.palm</code>。</> : <>直接使用 <code>data.pressureMatrix</code> 或 <code>data.values</code>，避免二次映射。</>}</p><p className={styles.result}><strong>完成标志</strong>业务程序能接收真实数据，停止或报错后释放端口。保留完整示例作对照，便于区分设备与业务代码问题。</p><div className={styles.actions}><Link className={styles.textLink} href="/docs/custom">扩展展示与自定义设备 →</Link><Link className={styles.textLink} href="/docs/backend">接入已有后端与 WebSocket →</Link><button type="button" className={styles.textLink} onClick={() => setTab('data')}>继续阅读字段参考 →</button></div>
      </Chapter>
      </div></details>
    </div>

    <section id="product-data" className={styles.referencePanel} hidden={state.tab !== 'data'} aria-labelledby="product-data-title" tabIndex={-1}><h2 id="product-data-title">数据字段与映射</h2><p>{productName}使用 <code>{productId}</code> 产品接口，以下内容是字段参考，不表示实时设备状态。</p><DataTable caption="产品返回字段" headings={['字段', '数据规模', '含义与使用方式']} rows={fieldRows} /><div className={styles.note}><strong>{glove ? '原始通道与产品分区' : '原始扫描与映射矩阵'}</strong><p>{glove ? 'pressure / raw 保留 256 个原始扫描通道；fingers 提供五指主体与独立指腹，palm 提供手掌分区。五指、指腹与手掌共 137 个分区映射位置，不要求覆盖全部通道。imu.raw 仅保留原始 IMU 字节。' : 'pressure 保留原扫描顺序；pressureMatrix 为产品内置映射后的 ADC；values 为同一映射的归一化浮点值。已经映射的数据无需再次重排。'}</p></div><details className={styles.details}><summary>这些数值能直接换算为物理压力吗？</summary><p>不能。原始 ADC 不自动对应牛顿、帕斯卡或弯曲角度。应结合具体硬件与量程完成标定。</p></details><button type="button" className={styles.textLink} onClick={() => navigateChapter('guide-verify')}>返回第 05 章验收 →</button></section>

    <section id="product-debug" className={styles.referencePanel} hidden={state.tab !== 'debug'} aria-labelledby="product-debug-title" tabIndex={-1}><h2 id="product-debug-title">按发生阶段排查连接问题</h2><p>先运行完整示例，再对照错误发生阶段。当前文档页无法代替真实设备诊断。</p>{[
      ['系统找不到串口', <>检查数据线、USB 接口和 CH34x 驱动；安装后重新插拔。Windows 查看 COM 端口，macOS 查看 /dev/cu.*，Linux 检查访问权限。关闭其他占用端口的程序。<button type="button" className={styles.textLink} onClick={() => navigateChapter('guide-prepare')}>返回驱动准备 →</button></>],
      ['浏览器无法选择设备', <>确认使用支持 Web Serial 的桌面浏览器，通过 localhost / HTTPS 打开完整示例。先独立激活授权，再单击连接设备；串口选择必须由用户点击触发。</>],
      ['串口已打开，但没有有效帧', <>{glove ? '确认设备输出整包手套协议 handGloveFullPacket；手侧改变映射，不决定是否收到帧。' : '确认设备使用 hand 产品接口对应的协议和 32 × 32 数据尺寸。'}产品接口已内置波特率、分帧和解析，不要重复覆盖。检查设备是否持续发送完整数据。</>],
      ['触按位置与分区不一致', <>{glove ? '按实物重新确认 left / right；SDK 不会根据串口或包类型识别手侧。直接读取 fingers 与 palm 的对应分区。' : '直接使用 pressureMatrix 或 values，不要重复套用 mat32 映射。'}<button type="button" className={styles.textLink} onClick={() => setTab('data')}>对照字段与映射 →</button></>],
      ['SDK 授权失败或采集期间失效', <>确认使用 SDK 产品密钥、正确的在线 / 离线模式，检查有效期、电脑名额、功能权限与网络。连接前捕获激活或连接 Promise 错误；连接后通过 onError 监听运行期错误。恢复后重新激活并连接，不要继续使用旧会话。</>],
      ['业务回调报错或无法重新连接', <><code>CALLBACK_FAILED</code> 表示业务回调失败，不代表串口已断开。检查回调代码；设备、传输或授权错误需要按完整示例清理会话。先 await close() 完成，再创建新连接，避免占用同一端口。</>],
    ].map(([title, body], index) => <details className={styles.details} key={index} open={index === 0}><summary>{title}</summary><div className={styles.issueBody}>{body}</div></details>)}<div className={styles.note}><strong>交付排查信息</strong><p>请记录 SDK 版本、产品、手侧、系统、环境、实际端口，以及完整示例中的错误 code / stage / suggestion。将脱敏信息交给原交付方；不要发送密钥。</p><button type="button" className={styles.secondaryButton} onClick={() => copy(diagnostics(), '配置与问题清单')}>复制当前配置与问题清单</button></div></section>

    <section id="product-downloads" className={styles.referencePanel} hidden={state.tab !== 'downloads'} aria-labelledby="product-downloads-title" tabIndex={-1}><h2 id="product-downloads-title">SDK、完整示例与串口驱动</h2><div className={styles.resources}><article><div><h3>JavaScript SDK · v{jsDownload.sdkVersion}</h3><p>浏览器和 Node.js 共用，含产品接口、协议解析、授权与文档；换产品或手侧无需重装 SDK。</p></div><button type="button" className={styles.secondaryButton} onClick={() => openDownload(jsDownload)}>下载 JavaScript SDK</button></article><article><div><h3>{productName} · 带注释的完整示例</h3><p>{readiness}</p><code>{ready ? filename : '确认手侧后生成'}</code></div><button type="button" className={styles.primaryButton} disabled={!ready} onClick={downloadExample}>下载完整示例</button></article>{SERIAL_DRIVERS.map(driver => <article key={driver.id}><div><h3>{driver.label} 串口驱动 · {driver.format}</h3><p>{driver.installNote} 安装后重新插拔并确认系统串口。</p></div><a className={styles.secondaryButton} href={driver.url}>下载驱动</a></article>)}<article><div><h3>Python SDK · 通用串口与矩阵</h3><p>Python 3.10+，没有整包手套产品 API。请先阅读支持范围。</p><Link className={styles.textLink} href="/docs/backend?language=python">阅读 Python 接入文档 →</Link></div><button type="button" className={styles.secondaryButton} onClick={() => openDownload(pythonDownload)}>下载 Python SDK</button></article></div><button type="button" className={styles.textLink} onClick={() => navigateChapter('guide-run')}>返回第 03 章运行示例 →</button></section>

    {copyFallback !== null && <section className={styles.copyFallback} aria-label="手动复制内容"><label htmlFor="workspace-copy-fallback">剪贴板不可用，请手动复制</label><textarea ref={fallbackRef} id="workspace-copy-fallback" readOnly value={copyFallback} rows={8} /><button type="button" className={styles.secondaryButton} onClick={() => setCopyFallback(null)}>收起复制内容</button></section>}
    <div className={styles.documentTools}><CopyRawButton raw={raw} label="复制文档原文" /></div>
    <details ref={extensionRef} className={styles.extension}><summary>设备、展示与录制扩展资料</summary><div className="doc-body docs-article" dangerouslySetInnerHTML={{ __html: extensionHtml }} /></details>
  </div>;
}
