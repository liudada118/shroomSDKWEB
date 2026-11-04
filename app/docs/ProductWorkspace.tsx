'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useDownload, useLicenseRequest } from '../DownloadProvider';
import SdkInstall from '../SdkInstall';
import { SERIAL_DRIVERS, SDK_VARIANTS } from '../downloads';
import { getCatalogProduct, productFields, productPackageReady, type ProductField } from '../product-catalog';
import { useProductWorkspace } from './product-workspace-state';
import { workspaceProducts, type WorkspacePlatform, type WorkspaceProtocol, type WorkspaceSection, type WorkspaceTab } from './product-workspace-model';
import styles from './ProductWorkspace.module.css';

type Runtime = 'node' | 'web' | 'terminal';
const stepSlogans: Record<string, string> = {
  'flow-read': '一次调用，持续拿到产品数据。',
  'flow-ws': '把设备数据接到你的网页。',
  'flow-start': '从现在开始保存数据。',
  'flow-stop': '结束本次记录，继续实时取数。',
  'flow-download': '下载刚刚完成的采集记录。',
};

/** 系统选择只影响串口路径和终端命令示例。 */
function PlatformSelect({ id, value, onChange }: { id: string; value: WorkspacePlatform; onChange: (platform: WorkspacePlatform) => void }) {
  return <label className={styles.platformControl} htmlFor={id}>串口电脑
    <select id={id} value={value} onChange={event => onChange(event.target.value as WorkspacePlatform)}>
      <option value="windows">Windows</option><option value="macos">macOS</option><option value="linux">Linux</option>
    </select>
  </label>;
}

function CodeBlock({ code, runtime, disabled = false, onCopy, descriptionId }: {
  code: string;
  runtime: Runtime;
  disabled?: boolean;
  onCopy: () => void;
  descriptionId?: string;
}) {
  const label = runtime === 'node' ? 'Node.js' : runtime === 'web' ? '浏览器 JavaScript' : '终端';
  return <div className={styles.codeBlock}>
    <div className={styles.codeHeader}>
      <span className={runtime === 'web' ? styles.webRuntime : styles.runtime}>{label}</span>
      <button type="button" disabled={disabled} aria-describedby={descriptionId} onClick={onCopy}>复制代码</button>
    </div>
    <pre tabIndex={0} aria-label={`${label} 调用代码`}><code>{code.split('\n').map((line, index) =>
      <span key={index} className={`${styles.codeLine} ${line.trimStart().startsWith('//') || line.trimStart().startsWith('#') ? styles.comment : ''}`}>
        <span className={styles.lineNumber} aria-hidden="true">{index + 1}</span>{line || ' '}
      </span>)}</code></pre>
  </div>;
}

function Preparation({ id, title, children }: { id: WorkspaceSection; title: string; children: ReactNode }) {
  return <section id={id} className={styles.preparation} aria-labelledby={`${id}-title`} tabIndex={-1}>
    <h2 id={`${id}-title`}>{title}</h2>{children}
  </section>;
}

function FieldsTable({ rows }: { rows: readonly ProductField[] }) {
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="产品返回字段表">
    <table><caption>产品返回字段</caption><thead><tr><th scope="col">字段</th><th scope="col">数据规模</th><th scope="col">含义</th></tr></thead>
      <tbody>{rows.map(([field, size, description]) => <tr key={field}><th scope="row"><code>{field}</code></th><td>{size}</td><td>{description}</td></tr>)}</tbody>
    </table>
  </div>;
}

/** 页面展示调用合同，不激活授权、不连接串口，也不模拟已完成的采集状态。 */
export default function ProductWorkspace() {
  const { state, ready, flowSteps, setProduct, confirmSide, setPlatform, setProtocol, setTab, navigateChapter } = useProductWorkspace();
  const openDownload = useDownload();
  const requestLicense = useLicenseRequest();
  const jsDownload = SDK_VARIANTS.find(target => target.source === 'sdk-node')!;
  const pythonDownload = SDK_VARIANTS.find(target => target.source === 'sdk-python')!;
  const [notice, setNotice] = useState('');
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const product = getCatalogProduct(state.product);
  const productName = product.name;
  const productId = product.productId;
  const sideName = state.side ? product.sideNames?.[state.side] ?? '不需要' : '未确认';
  const packageVersion = jsDownload.fileName?.match(/^shroom-sdk-(.+)\.tgz$/)?.[1];
  const localPackageReady = productPackageReady(product, packageVersion);
  const portExample = state.platform === 'windows' ? 'COM3' : state.platform === 'macos' ? '/dev/cu.usbserial-实际端口' : '/dev/ttyUSB0';
  const keyCommand = state.platform === 'windows'
    ? "$env:SHROOM_LICENSE_KEY = '你的 SDK 产品密钥'"
    : "export SHROOM_LICENSE_KEY='你的 SDK 产品密钥'";
  const activationCode = "import { Shroom } from 'shroom-sdk/node';\n\n// 在第 1 步取数前激活；deviceId 必须是本机持久保存的安装标识。\nawait Shroom.activateLicense(process.env.SHROOM_LICENSE_KEY, {\n  deviceId: process.env.SHROOM_DEVICE_ID,\n});";
  const portSearchCode = "import { listPorts } from 'shroom-sdk/node';\n\n// 查询可用串口，不打开设备，也不需要先激活密钥。\nconst ports = await listPorts();\nconsole.table(ports); // 按实际设备选择 path，填入第 1 步。";
  const tabs: { key: WorkspaceTab; label: string; id: string }[] = [
    { key: 'guide', label: '接入准备', id: 'product-guide' },
    { key: 'start', label: '调用流程', id: 'product-start' },
    { key: 'data', label: '字段', id: 'product-data' },
    { key: 'debug', label: '排查', id: 'product-debug' },
    { key: 'downloads', label: 'SDK 与驱动下载', id: 'product-downloads' },
  ];

  useEffect(() => {
    if (copyFallback === null) return;
    fallbackRef.current?.focus();
    fallbackRef.current?.select();
    fallbackRef.current?.scrollIntoView({ block: 'center' });
  }, [copyFallback]);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFallback(null);
      setNotice(`${label}已复制。`);
    } catch {
      setCopyFallback(value);
      setNotice('剪贴板不可用，请在下方文本框中手动复制。');
    }
  }

  function copyFlow(code: string) {
    // URL 参数不能替操作者确认实物；所有具体配置代码都使用同一守卫。
    if (!ready) return;
    void copy(code, '调用代码');
  }

  function diagnostics() {
    return JSON.stringify({
      sdk: jsDownload.sdkVersion,
      product: productId,
      side: product.requiresSide ? state.sideConfirmed ? state.side : '未按实物确认' : '不需要',
      ...(product.protocols.length ? { protocol: state.protocol } : {}),
      platform: state.platform,
      flow: 'Node 取数与 WS；浏览器连接、采集控制与下载',
      questions: ['系统中可见的实际串口？', '错误发生在第几步？', '错误 code / stage / suggestion？', 'Node 输出的 server.url？', '停止采集返回的 recording.id？'],
      note: '仅配置记录；请补充脱敏错误，不要提供 SDK 密钥。',
    }, null, 2);
  }

  const fields: readonly ProductField[] = [
    ...productFields(product, state.protocol),
    ...(product.requiresSide ? [['side', state.sideConfirmed ? sideName : '未确认', `来自按实物确认的${product.sideLabel}，SDK 不自动识别 left / right。`] as const] : []),
  ];
  const sdkInstallContent = <>
    <p>复制命令，在自己的项目目录执行。SDK 会自动下载并安装，无需先保存压缩包。</p>
    <SdkInstall />
    {product.minSdkVersion === '0.3.0' && <p>此产品要求 SDK {product.minSdkVersion} 或更高版本。旧项目可执行 <code>npm install shroom-sdk@0.3.0</code> 升级；Node 服务端与网页项目需使用同一版本，并重新构建前端。</p>}
    <p><button type="button" disabled={!localPackageReady} className={styles.textLink} onClick={() => openDownload(jsDownload)}>下载安装包 →</button></p>
  </>;

  return <div className={styles.workspace}>
    <header className={styles.pageHeading}><h1>快速接入</h1><p><strong>一步拿数据</strong>，再按需创建 WS、采集和下载。</p></header>

    <div className={styles.tabs} role="group" aria-label="产品接入资料">{tabs.map(tab => <button type="button" key={tab.key} aria-pressed={state.tab === tab.key} aria-controls={tab.id} onClick={() => setTab(tab.key)}>{tab.label}</button>)}</div>
    <p className={styles.notice} role="status" aria-live="polite">{notice}</p>

    <section id="product-start" hidden={state.tab !== 'start'} aria-label="五步 API 调用流程">
      <div className={styles.prerequisite}><span>首次使用？先安装 SDK 并激活密钥。</span><button type="button" className={styles.textLink} onClick={() => navigateChapter('guide-prepare')}>接入准备 →</button></div>
      <section className={styles.preparation} aria-labelledby="port-search-title">
        <div className={styles.sectionHeading}><h2 id="port-search-title">接入前：搜索并选择串口</h2><PlatformSelect id="workspace-port-platform" value={state.platform} onChange={setPlatform} /></div>
        <CodeBlock runtime="node" code={portSearchCode} onCopy={() => void copy(portSearchCode, '串口搜索代码')} />
        <p>用设备的 <code>path</code> 替换第 1 步中的 <code>{portExample}</code>。多个端口时，按实际设备选择。</p>
      </section>
      <div className={styles.flow}>
        {flowSteps.map((step, index) => <section id={step.id} key={step.id} className={styles.flowStep} aria-labelledby={`${step.id}-title`} tabIndex={-1}>
          <div className={styles.stepHeading}><span aria-hidden="true">{index + 1}</span><div><h2 id={`${step.id}-title`}>{step.title}</h2><p>{stepSlogans[step.id]}</p></div></div>
          {step.id === 'flow-read' && <div id="workspace-config" className={styles.exampleControls}>
            <div className={styles.productRow}>
              <div className={styles.productChoices} role="group" aria-label="选择示例产品"><span className={styles.controlLabel}>产品</span>{workspaceProducts.map(product => <button type="button" key={product.id} aria-pressed={state.product === product.id} onClick={() => setProduct(product.id)}><span className={styles.choiceCheck} aria-hidden="true">{state.product === product.id ? '✓' : ''}</span>{product.label}</button>)}</div>
              <Link className={styles.textLink} href="/docs/products">所有产品资料 →</Link>
            </div>
            {product.requiresSide && <div className={styles.sideRow}><div className={styles.sideChoices} role="group" aria-label={`按实物确认${product.sideLabel}`}><span className={styles.controlLabel}>{product.sideLabel}</span>{(['left', 'right'] as const).map(side => <button id={`workspace-side-${side}`} type="button" key={side} aria-pressed={state.sideConfirmed && state.side === side} onClick={() => confirmSide(side)}><span className={styles.choiceCheck} aria-hidden="true">{state.sideConfirmed && state.side === side ? '✓' : ''}</span>{product.sideNames?.[side]}</button>)}</div><p id="workspace-ready" className={!ready ? styles.selectionHint : styles.confirmedHint}>{ready ? `已按实物确认${sideName}` : `按实物确认${product.sideLabel}后，可复制调用代码。`}</p></div>}
            {product.protocols.length > 0 && <div className={styles.protocolRow}><label className={styles.platformControl} htmlFor="workspace-protocol">鞋垫协议<select id="workspace-protocol" value={state.protocol} onChange={event => setProtocol(event.target.value as WorkspaceProtocol)}>{product.protocols.map(protocol => <option key={protocol.value} value={protocol.value}>{protocol.label}</option>)}</select></label><p className={styles.secondaryText}>按固件选择，不自动识别或扫描协议；默认 921600 baud。</p></div>}
            {product.minSdkVersion === '0.3.0' && <p className={styles.versionNote}><strong>SDK {product.minSdkVersion} 起支持</strong>已有项目请同步升级 Node 与网页中的 SDK。<button type="button" className={styles.textLink} onClick={() => navigateChapter('guide-run')}>查看安装说明 →</button></p>}
          </div>}
          {step.blocks.map((block, blockIndex) => <CodeBlock key={`${step.id}-${block.runtime}-${blockIndex}`} code={block.code} runtime={block.runtime} disabled={!ready} descriptionId={!ready ? 'workspace-ready' : undefined} onCopy={() => copyFlow(block.code)} />)}
          <p className={styles.stepNote}>{step.note}</p>
        </section>)}
      </div>
    </section>

    <section id="product-guide" hidden={state.tab !== 'guide'} aria-label="接入准备">
      <Preparation id="guide-prepare" title="安装驱动与运行环境"><PlatformSelect id="workspace-guide-platform" value={state.platform} onChange={setPlatform} /><p>使用 Node.js 18+。CH34x 设备先安装对应驱动，再重新插拔；确认系统串口可见，并关闭占用端口的上位机。</p><div className={styles.driverDownloads}>{SERIAL_DRIVERS.map(driver => <a className={styles.secondaryButton} key={driver.id} href={driver.url}>{driver.label} 驱动 · {driver.format} ↗</a>)}</div><p>本机网页使用 <code>http://localhost</code>，连接示例中的本机 WS。</p></Preparation>
      <Preparation id="guide-config" title="确认产品与串口"><p>当前产品：<strong>{productName}</strong>{product.requiresSide ? `，${state.sideConfirmed ? `已确认${sideName}` : `${product.sideLabel}待按实物确认`}` : '，无需侧别参数'}{product.protocols.length ? `，${state.protocol} 协议` : ''}。将第 1 步的 <code>path</code> 替换为真实串口，当前系统格式示意为 <code>{portExample}</code>。</p><p>{product.connection}</p><p>第 1–2 步的 Node 代码放在同一进程；第 2 步的浏览器连接只建立一次，后续三步复用同一个 <code>stream</code>。</p></Preparation>
      <Preparation id="guide-run" title="安装 SDK">{sdkInstallContent}</Preparation>
      <Preparation id="guide-connect" title="激活 SDK 授权"><p>使用 Shroom SDK 产品密钥。<button type="button" className={styles.textLink} onClick={requestLicense}>申请 SDK 密钥 →</button></p><p>在启动 Node 程序的终端中设置密钥：</p><CodeBlock runtime="terminal" code={keyCommand} onCopy={() => void copy(keyCommand, '密钥设置命令')} /><p>在同一 Node 程序中，先激活，再执行第 1 步取数：</p><CodeBlock runtime="node" code={activationCode} onCopy={() => void copy(activationCode, '授权调用')} /><p className={styles.secondaryText}>限定电脑名额的密钥需要设置 <code>SHROOM_DEVICE_ID</code>；同一安装保持不变，不要每次启动生成新值。<Link href="/docs/license">安装标识与离线授权说明 →</Link></p></Preparation>
      <Preparation id="guide-verify" title="验证取数与采集"><p><code>onData</code> 持续返回帧，触按位置与产品分区一致。开始采集返回会话 ID，停止采集返回本次 <code>recording.id</code>；下载使用此 ID。停止采集只停止保存记录，设备与 WS 仍保持连接。</p><p>SDK 0.2.0 起，Node 产品连接意外断开后默认每 3 秒重连原串口，最多尝试 3 次；<code>reconnect: false</code> 可关闭。断线中的采集记录以 <code>error</code> 收尾，恢复取数后需重新开始采集。</p></Preparation>
      <Preparation id="guide-code" title="接入自己的页面"><p>五步函数从 <code>shroom-sdk/quick-flow</code> 导入，串口搜索从 <code>shroom-sdk/node</code> 导入。Node 代码使用 ES 模块（如 <code>.mjs</code>）；网页工程通过 Vite 等构建工具解析包名。普通 HTML 无构建工具时，请使用源码 ZIP 的相对路径示例。</p><p>将第 3–5 步放进各自按钮的点击处理，捕获调用失败；同一网页复用 <code>stream</code>，不要在初始化时连续执行开始和停止。</p><p>退出时关闭浏览器的 <code>stream</code>，并在 Node 端关闭 <code>server</code> 释放设备。</p><button type="button" className={styles.textLink} onClick={() => setTab('start')}>返回五步调用流程 →</button></Preparation>
    </section>

    <section id="product-data" hidden={state.tab !== 'data'} className={styles.referencePanel} aria-labelledby="product-data-title" tabIndex={-1}>
      <h2 id="product-data-title">产品字段</h2><p>以下是 <code>onData(data)</code> 的产品帧结构，不表示实时设备状态。</p><FieldsTable rows={fields} />
      <p className={styles.note}>{product.note} 原始 ADC 不自动对应牛顿、帕斯卡或角度，物理量需要结合硬件标定。</p>
    </section>

    <section id="product-debug" hidden={state.tab !== 'debug'} className={styles.referencePanel} aria-labelledby="product-debug-title" tabIndex={-1}>
      <h2 id="product-debug-title">按失败步骤排查</h2>
      <details className={styles.issue} open><summary>第 1 步：找不到串口或没有数据</summary><p>核对数据线、驱动、真实串口路径和端口占用。当前要求：{product.connection}。{product.requiresSide ? `请按实物确认${product.sideLabel}。` : ''}{product.protocols.length ? `当前选择 ${state.protocol}，应与固件一致。` : ''}</p><button type="button" className={styles.textLink} onClick={() => navigateChapter('guide-prepare')}>查看准备要求 →</button></details>
      <details className={styles.issue}><summary>设备断开后如何恢复</summary><p>SDK 0.2.0 起，Node 产品连接默认重试原 <code>path</code>，期间可用 <code>onStateChange</code> 显示重连状态。主动关闭、首次连接失败、授权或解析错误不会自动重连；COM 号改变后需重新搜索并选择。浏览器 WS 和 Web Serial 不自动重连。</p><p>重连恢复实时取数，不会继续写入已中断的采集记录。确认重新收到数据后，再开始一条新记录。</p></details>
      <details className={styles.issue}><summary>第 2 步：浏览器连不上 WS</summary><p>先确认 Node 已执行 <code>createWS(device)</code>，核对输出的 <code>server.url</code> 与浏览器连接端口。默认 <code>ws://127.0.0.1:19999</code> 仅供同机使用，网页使用 <code>http://localhost</code>。</p><p>HTTPS 页面不能直接套用本机明文 WS 配置；部署时需配置 <code>wss://</code>、HTTPS 下载地址及允许的网页来源，不能只改页面协议。</p></details>
      <details className={styles.issue}><summary>授权失败或功能不可用</summary><p>先在 Node 调用 <code>Shroom.activateLicense()</code>。核对 SDK 产品密钥、在线 / 离线模式、有效期、电脑名额，以及串口、流服务、录制功能权限。密钥不会自动激活。</p><button type="button" className={styles.textLink} onClick={() => navigateChapter('guide-connect')}>查看授权调用 →</button></details>
      <details className={styles.issue}><summary>第 3–4 步：采集没有开始或停止失败</summary><p>复用第 2 步返回的 <code>stream</code>，等待每个操作的 Promise 完成，并在按钮处理中捕获错误。<code>onData</code> 收到帧不代表已经保存记录；不要立即连续执行开始和停止。</p></details>
      <details className={styles.issue}><summary>第 5 步：无法下载</summary><p>先完成一次开始和停止采集，用停止返回的 <code>recording.id</code> 下载。不要默认挑最近记录。触发浏览器下载不代表文件已经保存完成。</p></details>
      <button type="button" className={styles.secondaryButton} onClick={() => void copy(diagnostics(), '配置与排查问题')}>复制配置与排查问题</button>
    </section>

    <section id="product-downloads" hidden={state.tab !== 'downloads'} className={styles.referencePanel} aria-labelledby="product-downloads-title" tabIndex={-1}>
      <h2 id="product-downloads-title">SDK 与驱动下载</h2>
      <SdkInstall />
      <div className={styles.resources}>
        <article><div><h3>JavaScript SDK · v{packageVersion ?? jsDownload.sdkVersion}</h3><p>下载 npm 安装包；包含 Node 串口、WS 服务和浏览器入口。</p>{localPackageReady && <a className={styles.textLink} href="/shroom-sdk-node.zip" download>源码与示例 ZIP →</a>}</div><button type="button" disabled={!localPackageReady} className={styles.secondaryButton} onClick={() => openDownload(jsDownload)}>下载安装包</button></article>
        <article><div><h3>Shroom SDK 产品密钥</h3><p>安装与下载无需申请，连接真实设备前需要激活。</p></div><button type="button" className={styles.primaryButton} onClick={requestLicense}>申请 SDK 密钥</button></article>
        {SERIAL_DRIVERS.map(driver => <article key={driver.id}><div><h3>{driver.label} 串口驱动 · {driver.format}</h3><p>{driver.installNote}</p></div><a className={styles.secondaryButton} href={driver.url}>下载驱动</a></article>)}
        <article><div><h3>Python SDK</h3><p>通用串口与矩阵路线，不包含本页的 Node / Web WS 采集控制链，也不支持整包手套。</p><Link className={styles.textLink} href="/docs/backend?language=python">查看 Python 支持范围 →</Link></div><button type="button" className={styles.secondaryButton} onClick={() => openDownload(pythonDownload)}>下载 Python SDK</button></article>
      </div>
    </section>

    {copyFallback !== null && <section className={styles.copyFallback} aria-label="手动复制内容"><label htmlFor="workspace-copy-fallback">剪贴板不可用，请手动复制</label><textarea ref={fallbackRef} id="workspace-copy-fallback" readOnly value={copyFallback} rows={8} /><button type="button" className={styles.secondaryButton} onClick={() => setCopyFallback(null)}>收起复制内容</button></section>}
  </div>;
}
