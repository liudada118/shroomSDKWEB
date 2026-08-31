import DocCodeBlock from './components/doc-code-block';
import { DocsInlineCode as InlineCode, DocsPageIntro, DocsSectionHeading as SectionHeading } from './components/docs-content';
import DocsPageShell from './components/docs-page-shell';
import { SDK_DOWNLOAD, SDK_VERSION } from './docs-data';

const installCode = `# 在解压后的 shroom-sdk 目录
npm install

# 无硬件验证协议解析与内存存储
npm run backend:serial-demo -- --mock`;

const serialLifecycleCode = `// backend-demo.cjs
const { ShroomSensorSDK } = require('./backend')

async function main() {
  const sdk = new ShroomSensorSDK()
  try {
    const result = await sdk.connectSerial({
      sensorType: 'hand0205',
      channels: { left: 'COM3', right: 'COM4' },
      connectionOptions: {
        retries: 3,
        timeoutMs: 2000,
        staleAfterMs: 5000,
      },
      onFrame: (frame) => console.log(frame.channel, frame.stats),
      onError: ({ channel, error, phase }) => {
        console.error('session error', channel, phase, error.code, error.message)
      },
      onChannelStale: ({ channel, lastError }) => {
        console.warn('stale', channel, lastError?.code)
      },
    })

    const session = result.session
    if (!session) throw new Error('manual connection did not return a session')

    const written = await sdk.writeSerial(
      session,
      'left',
      Buffer.from([0x01, 0x02]),
    )
    console.log('written bytes', written.bytesWritten)
    console.dir(sdk.getSerialState(), { depth: 4 })
  } catch (error) {
    console.error(error.code || 'UNKNOWN', error.userMessage || error.message)
  } finally {
    // 关闭所有串口会话；若已创建存储，也会一并释放
    await sdk.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})`;

const serialPortsCode = `const allPorts = await sdk.listPorts()
const likelySensors = await sdk.listPorts({
  onlyLikelySensorPorts: true,
})

console.table(likelySensors.map((port) => ({
  path: port.path,
  manufacturer: port.manufacturer,
  vendorId: port.vendorId,
  productId: port.productId,
  likely: port.isLikelySensorPort,
})))`;

const serialManualConnectCode = `const result = await sdk.connectSerial({
  sensorType: 'hand0205',
  channels: {
    left: 'COM3',
    right: 'COM4',
  },
  baudRate: 921600, // 可省略，省略时使用 Profile 默认值
  connectionOptions: {
    retries: 3,
    timeoutMs: 2000,
    retryDelayMs: 500,
    staleAfterMs: 5000,
  },
})

const session = result.session
console.log(result.mode, result.ports, result.failedPorts)`;

const serialAutoConnectCode = `const result = await sdk.connectSerial({
  sensorType: 'hand0205',
  maxPorts: 2,
  baudCandidates: [115200, 921600, 1000000, 1500000, 3000000],
  fallbackToAllPorts: true,
})

// 自动连接可能按 sensorType + baudRate 产生多个会话
for (const session of result.sessions) {
  console.log(session.sessionId, session.getState())
}

// success=true 时也要检查是否有部分端口失败
console.table(result.failedPorts)`;

const serialStateCode = `const managerState = sdk.getSerialState()
console.log(managerState.status)              // idle / connecting
console.log(managerState.lastConnectionError)
console.log(managerState.sessions)
console.log(managerState.latestFrames)

const sessionState = session.getState()
const left = sessionState.channels.left
console.log(left.status, left.online, left.open)
console.log(left.lastDataAt, left.lastFrameAt)
console.log(left.goodFrames, left.badFrames, left.dataQuality)
console.log(left.lastError)`;

const serialWriteCode = `// target 可以是 session，也可以是 session.sessionId
const result = await sdk.writeSerial(
  session,
  'left',
  Buffer.from([0x01, 0x02, 0x03]),
)

console.log(result.channel)
console.log(result.portPath)
console.log(result.bytesWritten)

// 也可以直接使用会话方法
await session.write('left', Uint8Array.from([0x04, 0x05]))`;

const serialDisconnectCode = `// 连接来自 connectSerial() 时，推荐由管理器断开并移除会话
// 以下三种按使用阶段选择，不需要连续调用
const disconnected = await sdk.disconnectSerial(session) // true / false

// 断开管理器中的全部串口会话，返回断开数量
const count = await sdk.disconnectSerial()

// 应用退出时使用：断开全部串口，并关闭已经创建的存储
await sdk.close()`;

const serialRecoveryCode = `sdk.serialManager.on('connectionError', (error) => {
  console.error(error.code, error.stage, error.message)
})

sdk.serialManager.on('sessionError', ({ sessionId, channel, phase, error }) => {
  console.error(sessionId, channel, phase, error.code, error.message)
})

sdk.serialManager.on('channelStale', ({ sessionId, channel, lastError }) => {
  console.warn('串口断流', sessionId, channel, lastError?.code)
})

async function rescan() {
  try {
    const result = await sdk.rescanSerial({
      sensorType: 'hand0205',
      maxPorts: 2,
    })
    console.log('重新连接', result.ports)
  } catch (error) {
    console.error(error.code, error.userMessage || error.message)
  }
}`;

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

type CapabilityDetail = readonly [title: string, description: React.ReactNode, anchor?: string];
type ReferenceRow = readonly [name: string, category: string, description: React.ReactNode];

const backendPositionDetails = [
  ['输入：统一标准帧', <>数据可以直接来自本地串口，也可以由 <InlineCode>CoreDeviceBridge</InlineCode> 把 Web、Node 或 Mock Device 转成可序列化的 Backend Frame。上层能力不需要为每个设备重新设计一套数据格式。</>],
  ['处理：本地数据链', <>Frame 在当前进程中依次进入同步算法、采集控制和 SQLite / 内存存储。串口、数据库和文件系统都由本地 Node / Electron 进程访问，网页只负责展示文档与下载包。</>],
  ['输出：可复用数据资产', <>实时监听、采集记录、历史回放和 CSV 导出围绕同一份 Frame 工作。业务可以先做实时展示，再按需要增加留存、复盘或离线分析，而不用替换前面的设备接入。</>],
] satisfies readonly CapabilityDetail[];

const serialMethodRows = [
  ['listPorts(options?)', '连接前', '枚举系统串口，可仅保留可能属于 WCH / CH34 设备的端口。'],
  ['connectSerial(options?)', '建立连接', '传入端口时走手动连接；没有端口参数时走扫描、波特率识别和自动连接。'],
  ['writeSerial(target, channel, data)', '连接后', '向指定会话和通道写入 Buffer、TypedArray、字节数组或字符串，默认等待 drain。'],
  ['getSerialState()', '运行中', '读取连接任务、全部会话、每个通道状态、最新 Frame 和最后一次连接异常。'],
  ['disconnectSerial(target?)', '主动断开', '传 session / sessionId 断开单个会话；省略 target 断开全部串口会话。'],
  ['close()', '应用退出', '断开全部串口会话，并关闭当前 SDK 已经创建的本地存储。'],
] satisfies readonly ReferenceRow[];

const serialEventRows = [
  ['frame', '标准数据', '协议解析、Mapping、清零和算法处理完成后发出，可直接进入展示或采集。'],
  ['rawFrame', '原始数据', '完成分帧、但尚未解析时发出；解析失败时仍可用于抓包和排障。'],
  ['channelState', '状态变化', '连接、降级、错误、断流或关闭时返回当前通道状态。'],
  ['channelStale', '断流提醒', '串口仍然 open，但超过 staleAfterMs 没有数据；SDK 不会在后台无限重连。'],
  ['write', '写入完成', '底层 write 和默认 drain 都完成后发出，包含通道、端口和写入字节数。'],
  ['error', '异步异常', '返回 channel、error 与 phase；用于处理串口、解析、监听器、采集、写入和清理异常。'],
  ['open / close', '会话生命周期', '全部通道打开完成，或会话完成停止采集与端口释放时发出。'],
] satisfies readonly ReferenceRow[];

const serialErrorRows = [
  ['CONN_BUSY', '连接锁', '已有 connect 或 rescan 正在运行；等待当前任务结束后再试。'],
  ['NO_PORT / NO_SENSOR_PORT', '扫描与筛选', '没有检测到串口，或没有符合 WCH / CH34 特征的候选口。'],
  ['BAUD_FAIL', '波特率识别', '候选波特率均未得到符合分隔符与帧长规则的数据。'],
  ['PORT_BUSY / PORT_NOT_FOUND', '打开端口', '端口被其他程序占用，或设备已经拔出、路径失效。'],
  ['OPEN_FAIL / CONNECT_TIMEOUT', '建立连接', '打开单个端口失败，或整个连接任务超过超时限制。'],
  ['PORT_OFFLINE / WRITE_FAIL', '写入', '目标通道不在线，或底层 write / drain 执行失败。'],
  ['STALE_CONNECTION', '健康检查', '端口仍打开但超过阈值没有数据；需要业务决定提示、重连或重扫。'],
  ['CLEANUP_FAIL', '资源释放', '关闭端口或清理监听器失败；错误会向上抛出，不会伪装成关闭成功。'],
] satisfies readonly ReferenceRow[];

const serialErrorPhaseRows = [
  ['serial', '串口运行错误', '当前通道进入 error；其他通道继续运行。'],
  ['rawFrame / frame', '业务监听器抛错', '错误会上报，但不会阻断后续解析或采集入库。'],
  ['parse', '协议或 Frame 处理失败', '只丢弃当前脏帧；下一帧继续处理，可结合 rawFrame 排障。'],
  ['capture', '入库或磁盘保护失败', '停止当前采集；串口仍继续接收实时 Frame。'],
  ['write', 'write 或 drain 失败', '本次写入 Promise 被拒绝；其他通道不会因此关闭。'],
  ['cleanup', '回滚或关闭失败', '继续尝试清理其他会话，结束后把首个清理异常向上抛出。'],
] satisfies readonly ReferenceRow[];

const captureDetails = [
  ['采样模式', <><InlineCode>serial</InlineCode> 保存每个有效串口帧；<InlineCode>custom</InlineCode> 在 1–200 Hz 范围内按目标频率取样。多通道分别维护采样时钟，一个通道不会压低另一个通道的保存频率。</>, 'capture-sampling'],
  ['批量落盘', <>帧先进入内存批次，达到 <InlineCode>batchSize</InlineCode> 时立即交给存储；默认 SQLite Store 会使用批量事务写入。未满批次由 <InlineCode>flushIntervalMs</InlineCode> 控制最长驻留时间，正常停止采集或关闭会话时会先 flush 剩余数据。</>, 'capture-flush'],
  ['保护与状态', <>可设置 <InlineCode>minFreeBytes</InlineCode> 在磁盘余量不足时阻止继续落盘。控制器同时统计接收、排队、保存、跳过和 flush 次数；存储异常会触发 <InlineCode>captureError</InlineCode>，但不会主动关闭串口实时链路。</>, 'capture-safety'],
] satisfies readonly CapabilityDetail[];

const storageDetails = [
  ['数据模型', <><InlineCode>captures</InlineCode> 保存名称、设备类型、频率、起止时间和参数快照；<InlineCode>frames</InlineCode> 保存时间戳、通道、数据、统计、原始帧和算法结果。一次采集因此既能追踪上下文，也能还原逐帧数据。</>, 'storage-records'],
  ['存储实现', <>默认 <InlineCode>CaptureStore</InlineCode> 使用 SQLite WAL 和批量事务，适合长期留存；<InlineCode>MemoryCaptureStore</InlineCode> 保持同名接口，适合 Demo 与自动化测试，但数据会在进程退出时丢失，长时间采集也会持续占用内存。</>, 'storage-engines'],
  ['查询与生命周期', <>支持按设备类型、采集名称、创建时间、通道和帧时间过滤，并提供分页、计数和级联删除。调用 <InlineCode>close()</InlineCode> 会释放数据库资源；仓库不会把本地采集自动上传到云端。</>, 'storage-lifecycle'],
] satisfies readonly CapabilityDetail[];

const replayDetails = [
  ['真实时间轴', <>回放使用相邻采集帧的真实时间戳差值安排下一帧，再除以当前播放倍速。这样既能按原速复现实验，也能用倍速快速检查长时间采集。</>, 'replay-timeline'],
  ['播放控制', <><InlineCode>ReplayPlayer</InlineCode> 提供播放、暂停、停止、定位、前后逐帧、倍速和循环，并通过 <InlineCode>frame</InlineCode>、<InlineCode>state</InlineCode>、<InlineCode>end</InlineCode> 事件把状态交给播放器或可视化界面。</>, 'replay-controls'],
  ['算法与桥接', <>开启 <InlineCode>applyAlgorithms</InlineCode> 后，历史帧会重新经过当前注册的算法，适合对比新旧算法结果。由轻量 Device 采集的数据还可转回 Core Frame，继续交给现有 Heatmap。</>, 'replay-processing'],
] satisfies readonly CapabilityDetail[];

const csvDetails = [
  ['导出范围', <>先用采集 ID 或名称定位采集，设备类型可用于同名消歧；再按通道、时间闭区间和 limit / offset 限制本次导出的帧。没有匹配帧时会明确报错，不会生成看似成功的空文件。</>, 'csv-scope'],
  ['字段结构', <>当前固定导出 14 列，包含序号、相对秒数、时间戳、通道、统计值、采集数据（当前表头为“矩阵数据”）、姿态、原始帧 HEX、算法结果和附加信息。数组与对象写成 JSON 字符串，保留传感点顺序和嵌套结构。</>, 'csv-fields'],
  ['文件与兼容', <>每次调用生成一个独立文件，可指定完整 <InlineCode>outputPath</InlineCode> 或输出目录，并选择中英文表头。当前列集合不可裁剪且没有 BOM 选项；中文 CSV 在部分 Excel 环境中需要通过“从文本导入”并选择 UTF-8。</>, 'csv-output'],
] satisfies readonly CapabilityDetail[];

const algorithmDetails = [
  ['执行位置', <>算法位于标准 Frame 生成之后、实时事件和采集入库之前。结果写入 <InlineCode>frame.algorithmResults</InlineCode>，因此实时界面、存储、回放和 CSV 都能复用同一份计算结果。</>, 'algorithms-pipeline'],
  ['注册与隔离', <>算法按注册顺序同步执行，可以启用、停用，并通过 <InlineCode>select</InlineCode> 或 <InlineCode>when</InlineCode> 选择输入和运行条件。默认单个算法失败只记录错误并继续，也可切换为严格抛错模式。</>, 'algorithms-registration'],
  ['性能与数值', <>handler 应短耗时、同步执行并返回可 JSON 序列化结果；注册前还要确认 <InlineCode>frame.valueScale</InlineCode>。Python、GPU 推理或大模型调用应放在独立进程，通过队列或客户端接入。</>, 'algorithms-boundaries'],
] satisfies readonly CapabilityDetail[];

function CapabilityDetails({ items }: { items: readonly CapabilityDetail[] }) {
  const anchored = items.some(([, , anchor]) => Boolean(anchor));

  if (anchored) {
    return (
      <div className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {items.map(([title, description, anchor]) => (
          <div
            key={title}
            id={anchor}
            tabIndex={anchor ? -1 : undefined}
            className="scroll-mt-24 py-7 sm:py-8 md:grid md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] md:gap-8"
          >
            <h3 className="text-base font-semibold tracking-[-0.015em] text-[var(--text-strong)]">{title}</h3>
            <div className="mt-2 text-base leading-7 text-[var(--text-muted)] md:mt-0">{description}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-x-10 md:grid-cols-2 xl:grid-cols-3">
      {items.map(([title, description]) => (
        <div key={title} className="border-t border-[var(--line)] py-5">
          <h3 className="text-base font-semibold tracking-[-0.015em] text-[var(--text-strong)]">{title}</h3>
          <div className="mt-2 text-base leading-7 text-[var(--text-muted)]">{description}</div>
        </div>
      ))}
    </div>
  );
}

function ReferenceTable({ caption, headings, rows }: { caption: string; headings: readonly [string, string, string]; rows: readonly ReferenceRow[] }) {
  return (
    <div className="mt-8 overflow-x-auto">
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
        <caption className="mb-3 text-left text-sm font-semibold text-[var(--text-strong)]">{caption}</caption>
        <thead>
          <tr className="bg-[var(--surface-muted)] text-xs text-[var(--text-subtle)]">
            {headings.map((heading, index) => (
              <th key={heading} scope="col" className={`px-4 py-3 ${index === 0 ? 'rounded-l-lg' : ''} ${index === headings.length - 1 ? 'rounded-r-lg' : ''}`}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, category, description]) => (
            <tr key={name}>
              <th scope="row" className="border-b border-[var(--line)] px-4 py-4 align-top font-mono text-xs font-semibold text-[var(--accent-strong)]">{name}</th>
              <td className="border-b border-[var(--line)] px-4 py-4 align-top font-semibold text-[var(--text-strong)]">{category}</td>
              <td className="border-b border-[var(--line)] px-4 py-4 align-top leading-6 text-[var(--text-muted)]">{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SerialSubsectionHeading({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">{step}</p>
      <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[var(--text-strong)] sm:text-2xl">{title}</h3>
      <div className="mt-3 text-base leading-7 text-[var(--text-muted)]">{children}</div>
    </div>
  );
}

export default function BackendDocsPage() {
  return (
    <DocsPageShell
      page="backend"
      skipTarget="#overview"
      footerTitle="Shroom Backend Preview"
      footerDescription="本地 Node 能力，不是托管云服务。"
      tocStatus="本地 Node · 技术预览"
    >
      <section id="overview" tabIndex={-1} className="scroll-mt-24">
        <DocsPageIntro
          breadcrumb={[{ label: 'SDK 文档', href: '/docs' }, { label: '后端与串口' }]}
          title="本地 Node 后端能力"
          description="把串口 Frame 延伸为可采集、可存储、可回放、可导出的本地数据链。它运行在 Node / Electron / 上位机进程，不运行在网页或托管 Worker 中。"
        >

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
        </DocsPageIntro>

              <div className="mt-12">
                <SectionHeading eyebrow="Backend responsibility" title="后端在整套 SDK 中负责什么">
                  Core 解决不同运行环境的数据格式问题，本地后端继续解决“数据怎样稳定进入、怎样长期保存、怎样重新使用”。它不是另一套设备协议，而是统一 Frame 之后的工程能力层。
                </SectionHeading>
                <CapabilityDetails items={backendPositionDetails} />
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
              <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">Core Device 桥接默认把 <InlineCode>values</InlineCode> 视为 0–1 归一化值，并标记 <InlineCode>valueScale: &apos;normalized-0-1&apos;</InlineCode>；调用方可显式覆盖该标记。为原始 ADC 编写的算法阈值不能直接照搬。</p>
      </section>

            <section id="serial" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading eyebrow="01 · Serial" title="串口管理不止是 open()">
                串口 API 覆盖从端口发现到资源释放的完整生命周期。下面按实际调用顺序说明枚举、连接、数据接收、状态查询、写入、主动断开、异常处理和重扫；真实产品首次接入建议先手动指定端口，协议稳定后再启用自动连接。
              </SectionHeading>
              <ReferenceTable
                caption="串口生命周期与推荐入口"
                headings={['方法', '使用阶段', '职责']}
                rows={serialMethodRows}
              />
              <div className="mt-5 border-l-4 border-[var(--warning-border)] bg-[var(--warning-soft)] px-5 py-4 text-sm leading-6 text-[var(--warning-text)]">
                <strong>代码补全现状：</strong>上表六个主入口已经写入 TypeScript 声明，可以正常补全。运行时还存在 <InlineCode>serialManager.connectManual()</InlineCode>、<InlineCode>connectAuto()</InlineCode>、<InlineCode>session.writeAll()</InlineCode>、<InlineCode>reconnectChannel()</InlineCode> 和 <InlineCode>closeChannel()</InlineCode>，但当前 <InlineCode>index.d.ts</InlineCode> 尚未完整声明；本页先以已声明的 SDK 主入口作为推荐用法。
              </div>

              <div id="serial-lifecycle" tabIndex={-1} className="mt-12 scroll-mt-24">
                <SerialSubsectionHeading step="Serial · 01" title="最小完整生命周期">
                  推荐把连接放在 <InlineCode>try</InlineCode> 中，把 <InlineCode>sdk.close()</InlineCode> 放在 <InlineCode>finally</InlineCode>。连接回调作为 <InlineCode>connectSerial()</InlineCode> 参数传入，会在端口打开前注册，避免漏掉首帧或最早发生的异步错误。
                </SerialSubsectionHeading>
                <div className="mt-6"><DocCodeBlock label="backend-demo.cjs · 连接 → 写入 → 状态 → 关闭" code={serialLifecycleCode} /></div>
              </div>

              <div id="serial-ports" tabIndex={-1} className="mt-14 scroll-mt-24 border-t border-[var(--line)] pt-10">
                <SerialSubsectionHeading step="Serial · 02" title="枚举端口">
                  <InlineCode>sdk.listPorts()</InlineCode> 返回 path、厂商、序列号、VID/PID、友好名称和 <InlineCode>isLikelySensorPort</InlineCode>。WCH、CH34、USB-SERIAL 与 1A86 只是候选特征的宽匹配，不能单凭该标记断言具体设备型号或协议。
                </SerialSubsectionHeading>
                <div className="mt-6"><DocCodeBlock label="连接前 · 列出全部端口与候选传感器口" code={serialPortsCode} /></div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">如果 <InlineCode>serialport</InlineCode> 尚未安装，这条路径会报依赖缺失；先在 SDK 目录执行 <InlineCode>npm install</InlineCode>。同一个 COM 口不能同时被主项目、串口调试器和本地 SDK 占用。</p>
              </div>

              <div id="serial-connect" tabIndex={-1} className="mt-14 scroll-mt-24 border-t border-[var(--line)] pt-10">
                <SerialSubsectionHeading step="Serial · 03" title="建立连接：手动或自动">
                  传入 <InlineCode>channels</InlineCode>、单个 port/path，或 ports 数组时走手动连接；没有端口参数时进入自动流程。连接结果统一为 <InlineCode>{'{ success, mode, session?, sessions, ports, failedPorts }'}</InlineCode>，自动连接允许部分端口成功，因此不能只判断 success，还要检查 failedPorts。
                </SerialSubsectionHeading>

                <div className="mt-7">
                  <h4 className="text-base font-semibold text-[var(--text-strong)]">手动连接</h4>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">适合首次接入、端口已知或通道映射固定的场景。多通道会按顺序打开；中途失败时 SDK 会先关闭已经打开的端口，再抛出异常。</p>
                  <div className="mt-4"><DocCodeBlock label="已知端口 · 手动建立会话" code={serialManualConnectCode} /></div>
                </div>

                <div className="mt-8">
                  <h4 className="text-base font-semibold text-[var(--text-strong)]">自动连接</h4>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">自动流程先筛选候选口，再依次探测波特率，释放临时探测口后按 sensorType + baudRate 分组建立长连接。需要业务设备识别时，可通过 <InlineCode>resolveDevice()</InlineCode> 返回 sensorType 与 channel。</p>
                  <div className="mt-4"><DocCodeBlock label="未知端口 · 自动扫描与波特率识别" code={serialAutoConnectCode} /></div>
                </div>
              </div>

              <div id="serial-state" tabIndex={-1} className="mt-14 scroll-mt-24 border-t border-[var(--line)] pt-10">
                <SerialSubsectionHeading step="Serial · 04" title="接收 Frame、事件与状态">
                  会话事件用于实时处理，状态快照用于界面渲染和诊断。<InlineCode>sdk.getSerialState()</InlineCode> 聚合全部会话；<InlineCode>session.getState()</InlineCode> 展开单个会话及其通道。默认端口打开后 5 秒没有数据会变为 stale，而不是仍显示在线。
                </SerialSubsectionHeading>
                <ReferenceTable caption="SensorSession 常用事件" headings={['事件', '类型', '什么时候使用']} rows={serialEventRows} />
                <div className="mt-6"><DocCodeBlock label="运行中 · 查询管理器与通道状态" code={serialStateCode} /></div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">Manager 的 <InlineCode>status: &apos;idle&apos;</InlineCode> 只表示当前没有连接或重扫任务，不代表没有已连接设备；是否已连接要查看 sessions。通道状态包含 <InlineCode>online</InlineCode>、<InlineCode>open</InlineCode>、lastDataAt、lastFrameAt、goodFrames、badFrames、badFrameRate、dataQuality 与 lastError。收到脏帧会增加 badFrames，但单帧解析失败不会让进程或其他通道退出。</p>
              </div>

              <div id="serial-write" tabIndex={-1} className="mt-14 scroll-mt-24 border-t border-[var(--line)] pt-10">
                <SerialSubsectionHeading step="Serial · 05" title="写入串口">
                  <InlineCode>sdk.writeSerial(target, channel, data, options?)</InlineCode> 先解析目标会话，再写入指定通道。data 支持 Buffer、TypedArray、字节数组和字符串；默认等待底层 drain 完成，成功结果包含 channel、portPath、bytesWritten 与实际 Buffer。
                </SerialSubsectionHeading>
                <div className="mt-6"><DocCodeBlock label="连接后 · 向指定通道写入" code={serialWriteCode} /></div>
                <p className="mt-4 rounded-lg bg-[var(--surface-muted)] px-5 py-4 text-sm leading-6 text-[var(--text-muted)]">离线通道会拒绝并返回 <InlineCode>PORT_OFFLINE</InlineCode>；底层 write 或 drain 失败返回 <InlineCode>WRITE_FAIL</InlineCode>。写入失败不会主动关闭其他通道。</p>
              </div>

              <div id="serial-disconnect" tabIndex={-1} className="mt-14 scroll-mt-24 border-t border-[var(--line)] pt-10">
                <SerialSubsectionHeading step="Serial · 06" title="主动断开与资源释放">
                  由 <InlineCode>connectSerial()</InlineCode> 创建的会话，推荐使用 <InlineCode>sdk.disconnectSerial(sessionOrId)</InlineCode>，它会关闭端口并从 SerialManager 中移除会话。省略 target 会断开全部会话；进程退出时使用 <InlineCode>sdk.close()</InlineCode>，它还会关闭已经创建的存储。
                </SerialSubsectionHeading>
                <div className="mt-6"><DocCodeBlock label="停止阶段 · 单会话、全部串口与 SDK 关闭" code={serialDisconnectCode} /></div>
                <div className="mt-4 border-l-4 border-[var(--warning-border)] bg-[var(--warning-soft)] px-5 py-4 text-sm leading-6 text-[var(--warning-text)]"><strong>不要只丢弃 session 变量：</strong>这不会释放 COM 口。直接通过 <InlineCode>sdk.open()</InlineCode> 创建、未交给 SerialManager 管理的会话，应显式 <InlineCode>await session.close()</InlineCode>；正常 close 会先停止采集并 flush，再逐个关闭通道。</div>
              </div>

              <div id="serial-errors" tabIndex={-1} className="mt-14 scroll-mt-24 border-t border-[var(--line)] pt-10">
                <SerialSubsectionHeading step="Serial · 07" title="异常、断流与恢复">
                  连接、写入和关闭方法通过 rejected Promise 返回稳定错误码；运行期间的串口、解析、监听器和采集异常通过 <InlineCode>error</InlineCode> 事件返回 phase。业务应匹配 <InlineCode>error.code</InlineCode>，不要匹配 Windows 或 Linux 的原始错误字符串。
                </SerialSubsectionHeading>
                <ReferenceTable caption="稳定串口错误码" headings={['错误码', '阶段', '处理含义']} rows={serialErrorRows} />
                <ReferenceTable caption="会话异步错误 phase" headings={['phase', '来源', '对数据链的影响']} rows={serialErrorPhaseRows} />
                <div className="mt-6"><DocCodeBlock label="异常监听与显式重新扫描" code={serialRecoveryCode} /></div>
                <p className="mt-4 rounded-lg bg-[var(--surface-muted)] px-5 py-4 text-sm leading-6 text-[var(--text-muted)]"><InlineCode>rescanSerial()</InlineCode> 会先停止当前采集、关闭所有串口会话，默认等待 1 秒释放资源，再重新扫描和自动连接。连接与重扫共用互斥锁，并发调用返回 <InlineCode>CONN_BUSY</InlineCode>；SDK 不会无限自动重连，是否提示、重试或重扫由业务决定。</p>
              </div>

              <p className="mt-8 rounded-lg bg-[var(--surface-muted)] px-5 py-4 text-sm leading-6 text-[var(--text-muted)]">自动化测试使用 Fake Port；COM3、COM4 等真实端口仍需在目标 Windows / Linux 设备上验证。不要让主项目、串口调试器和本地 SDK 同时占用同一个串口。</p>
            </section>

            <section id="capture" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading eyebrow="02 · Capture" title="采集按通道限频并批量落盘">
                <InlineCode>serial</InlineCode> 模式保存每个有效帧；<InlineCode>custom</InlineCode> 模式按 1 到 200 Hz 采样。每个通道拥有独立采样时钟，正常停止采集和关闭会话时会先 flush 剩余批次。
              </SectionHeading>
              <CapabilityDetails items={captureDetails} />
              <div className="mt-8"><DocCodeBlock label="接续串口示例 · 采集片段" code={captureCode} /></div>
            </section>

            <section id="storage" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading eyebrow="03 · Storage" title="SQLite 与内存存储使用同一套接口">
                默认 <InlineCode>CaptureStore</InlineCode> 使用 SQLite WAL，并支持事务批写、分页、计数、时间/通道过滤和级联删除。测试或临时任务可以注入 <InlineCode>MemoryCaptureStore</InlineCode>，无需原生数据库依赖。
              </SectionHeading>
              <CapabilityDetails items={storageDetails} />
              <div className="mt-8"><DocCodeBlock label="backend-demo.cjs · 存储" code={storageCode} /></div>
              <p className="mt-5 border-l-4 border-[var(--warning-border)] bg-[var(--warning-soft)] px-5 py-4 text-sm leading-6 text-[var(--warning-text)]"><strong>SQLite 依赖：</strong><InlineCode>better-sqlite3</InlineCode> 是可选原生模块。安装失败时仍可使用内存存储，但不能实例化 <InlineCode>CaptureStore</InlineCode>。</p>
            </section>

            <section id="replay" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading eyebrow="04 · Replay" title="回放沿用采集帧的真实时间间隔">
                <InlineCode>ReplayPlayer</InlineCode> 提供播放、暂停、定位、逐帧、倍速和循环。启用 <InlineCode>applyAlgorithms</InlineCode> 后，历史帧会重新经过当前算法通道。
              </SectionHeading>
              <CapabilityDetails items={replayDetails} />
              <div className="mt-8"><DocCodeBlock label="接续存储示例 · 回放片段" code={replayCode} /></div>
              <p className="mt-5 rounded-lg bg-[var(--surface-muted)] px-5 py-4 text-sm leading-6 text-[var(--text-muted)]">回放对象使用 Backend Frame。由轻量 Device 采集的帧可通过 <InlineCode>backendFrameToCoreFrame()</InlineCode> 恢复为 <InlineCode>Uint8Array / Float32Array</InlineCode>，继续交给现有 Heatmap。</p>
            </section>

            <section id="csv" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading eyebrow="05 · CSV" title="从同一份存储按条件导出">
                先按 captureId 或 captureName 定位采集，可用 sensorType 区分同名记录，再按 channel 和时间区间限制帧。数组与对象使用 JSON 字符串写入，不会改变传感点顺序；中英文表头可选。
              </SectionHeading>
              <CapabilityDetails items={csvDetails} />
              <div className="mt-8"><DocCodeBlock label="backend-demo.cjs · CSV 导出" code={csvCode} /></div>
            </section>

            <section id="algorithms" tabIndex={-1} className="mt-16 scroll-mt-24 border-t border-[var(--line)] pt-14 sm:mt-20">
              <SectionHeading eyebrow="06 · Algorithms" title="简单算法位于 Frame 与采集之间">
                算法按注册顺序执行，结果写入 <InlineCode>frame.algorithmResults</InlineCode>。默认错误策略会隔离失败算法并继续串口链路，也可以切换为严格抛错模式。
              </SectionHeading>
              <CapabilityDetails items={algorithmDetails} />
              <div className="mt-8"><DocCodeBlock label="backend-demo.cjs · 同步算法通道" code={algorithmCode} /></div>
              <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">算法注册前先确认 <InlineCode>frame.valueScale</InlineCode>：串口 Profile 可能给出原始 ADC，Core Device 桥接默认为 <InlineCode>normalized-0-1</InlineCode>，也允许调用方显式覆盖。</p>
              <div className="mt-5 border-l-4 border-[var(--warning-border)] bg-[var(--warning-soft)] px-5 py-4 text-sm leading-6 text-[var(--warning-text)]"><strong>运行边界：</strong>handler 必须同步、短耗时并返回可 JSON 序列化结果。Python 服务、GPU 推理和大模型调用应放在独立进程，通过队列或客户端对接，避免阻塞串口事件循环。</div>
      </section>
    </DocsPageShell>
  );
}
