export const SDK_DOWNLOAD = '/shroom-sdk.zip';
export const SDK_VERSION = '0.2.0-preview.1';

export type DocsPageId = 'sdk' | 'backend';

export type DocNavItem = {
  label: string;
  href: string;
  page: DocsPageId;
  anchor: `#${string}`;
  description: string;
  keywords?: string;
  parentAnchor?: `#${string}`;
  children?: readonly DocNavItem[];
};

type DocNavGroup = {
  title: string;
  label?: string;
  collapsible?: boolean;
  items: readonly DocNavItem[];
};

const serialNavigationItems = [
  { label: '生命周期总览', href: '/docs/backend#serial-lifecycle', page: 'backend', anchor: '#serial-lifecycle', parentAnchor: '#serial', description: '连接、写入、状态与关闭的完整示例', keywords: 'lifecycle try finally 完整示例' },
  { label: '端口枚举', href: '/docs/backend#serial-ports', page: 'backend', anchor: '#serial-ports', parentAnchor: '#serial', description: '列出串口并识别候选传感器端口', keywords: 'listPorts COM WCH CH34 VID PID' },
  { label: '建立连接', href: '/docs/backend#serial-connect', page: 'backend', anchor: '#serial-connect', parentAnchor: '#serial', description: '手动连接、自动扫描与波特率识别', keywords: 'connectSerial manual auto baudRate failedPorts' },
  { label: '事件与状态', href: '/docs/backend#serial-state', page: 'backend', anchor: '#serial-state', parentAnchor: '#serial', description: 'Frame、会话事件和通道健康状态', keywords: 'frame rawFrame channelState getSerialState online stale' },
  { label: '写入串口', href: '/docs/backend#serial-write', page: 'backend', anchor: '#serial-write', parentAnchor: '#serial', description: '向指定会话与通道写入数据', keywords: 'writeSerial session.write Buffer drain WRITE_FAIL' },
  { label: '断开与释放', href: '/docs/backend#serial-disconnect', page: 'backend', anchor: '#serial-disconnect', parentAnchor: '#serial', description: '断开单个或全部会话并释放 COM 口', keywords: 'disconnectSerial session.close sdk.close cleanup' },
  { label: '异常与恢复', href: '/docs/backend#serial-errors', page: 'backend', anchor: '#serial-errors', parentAnchor: '#serial', description: '错误码、异常 phase、断流和重新扫描', keywords: 'error code phase rescanSerial reconnect CONN_BUSY STALE_CONNECTION' },
] satisfies readonly DocNavItem[];

const captureNavigationItems = [
  { label: '采样模式', href: '/docs/backend#capture-sampling', page: 'backend', anchor: '#capture-sampling', parentAnchor: '#capture', description: '逐帧保存或按目标频率独立采样', keywords: 'serial custom frequencyHz 采样 限频' },
  { label: '批量落盘', href: '/docs/backend#capture-flush', page: 'backend', anchor: '#capture-flush', parentAnchor: '#capture', description: '批次、定时 flush 与停止前落盘', keywords: 'batchSize flushIntervalMs batch transaction' },
  { label: '保护与状态', href: '/docs/backend#capture-safety', page: 'backend', anchor: '#capture-safety', parentAnchor: '#capture', description: '磁盘余量保护、统计和采集异常', keywords: 'minFreeBytes captureError captureFlush stats' },
] satisfies readonly DocNavItem[];

const storageNavigationItems = [
  { label: '数据模型', href: '/docs/backend#storage-records', page: 'backend', anchor: '#storage-records', parentAnchor: '#storage', description: '采集记录、Frame 记录与参数快照', keywords: 'captures frames metadata algorithmResults rawFrame' },
  { label: '存储实现', href: '/docs/backend#storage-engines', page: 'backend', anchor: '#storage-engines', parentAnchor: '#storage', description: 'SQLite WAL 与内存存储的使用边界', keywords: 'CaptureStore MemoryCaptureStore better-sqlite3 WAL' },
  { label: '查询与生命周期', href: '/docs/backend#storage-lifecycle', page: 'backend', anchor: '#storage-lifecycle', parentAnchor: '#storage', description: '过滤、分页、计数、删除与关闭', keywords: 'listCaptures getCaptureFrames pagination delete close' },
] satisfies readonly DocNavItem[];

const replayNavigationItems = [
  { label: '真实时间轴', href: '/docs/backend#replay-timeline', page: 'backend', anchor: '#replay-timeline', parentAnchor: '#replay', description: '按采集帧时间戳还原播放间隔', keywords: 'timestamp timing speed timeline' },
  { label: '播放控制', href: '/docs/backend#replay-controls', page: 'backend', anchor: '#replay-controls', parentAnchor: '#replay', description: '播放、暂停、定位、逐帧、倍速与循环', keywords: 'play pause stop seek step setSpeed setLoop' },
  { label: '算法与桥接', href: '/docs/backend#replay-processing', page: 'backend', anchor: '#replay-processing', parentAnchor: '#replay', description: '历史算法重算与 Core Frame 恢复', keywords: 'applyAlgorithms backendFrameToCoreFrame Heatmap' },
] satisfies readonly DocNavItem[];

const csvNavigationItems = [
  { label: '导出范围', href: '/docs/backend#csv-scope', page: 'backend', anchor: '#csv-scope', parentAnchor: '#csv', description: '按采集、通道、时间与分页筛选', keywords: 'captureId captureName channel timestamp limit offset' },
  { label: '字段结构', href: '/docs/backend#csv-fields', page: 'backend', anchor: '#csv-fields', parentAnchor: '#csv', description: '统计、原始帧、算法结果与 JSON 字段', keywords: 'columns stats raw HEX JSON algorithmResults' },
  { label: '文件与兼容', href: '/docs/backend#csv-output', page: 'backend', anchor: '#csv-output', parentAnchor: '#csv', description: '输出路径、中英文表头与 Excel 边界', keywords: 'outputPath directory language UTF-8 Excel BOM' },
] satisfies readonly DocNavItem[];

const algorithmNavigationItems = [
  { label: '执行位置', href: '/docs/backend#algorithms-pipeline', page: 'backend', anchor: '#algorithms-pipeline', parentAnchor: '#algorithms', description: '算法在标准 Frame 与采集之间执行', keywords: 'pipeline algorithmResults realtime capture' },
  { label: '注册与隔离', href: '/docs/backend#algorithms-registration', page: 'backend', anchor: '#algorithms-registration', parentAnchor: '#algorithms', description: '注册、启停、条件选择与失败策略', keywords: 'registerAlgorithm enable disable select when strict' },
  { label: '性能与数值', href: '/docs/backend#algorithms-boundaries', page: 'backend', anchor: '#algorithms-boundaries', parentAnchor: '#algorithms', description: '同步耗时、序列化和数值尺度边界', keywords: 'valueScale synchronous JSON Python GPU worker' },
] satisfies readonly DocNavItem[];

export const docsNavigation: readonly DocNavGroup[] = [
  {
    title: '开始',
    items: [
      { label: 'SDK 概览', href: '/docs#top', page: 'sdk', anchor: '#top', description: '定位、版本与最短接入链路' },
      { label: '选择接入方式', href: '/docs#products', page: 'sdk', anchor: '#products', description: 'Mock、浏览器或 Node' },
      { label: '快速开始', href: '/docs#quick-start', page: 'sdk', anchor: '#quick-start', description: '按运行环境查看核心接入片段' },
    ],
  },
  {
    title: '核心概念',
    items: [
      { label: '当前能力', href: '/docs#capabilities', page: 'sdk', anchor: '#capabilities', description: '当前 ZIP 已包含的能力' },
      { label: 'Frame 数据', href: '/docs#frame', page: 'sdk', anchor: '#frame', description: '字段、统计值与协议假设' },
    ],
  },
  {
    title: '运行环境',
    items: [
      { label: 'Mock 演示', href: '/docs#web-lab', page: 'sdk', anchor: '#web-lab', description: '没有硬件时先验证数据流' },
      { label: '兼容与下载', href: '/docs#downloads', page: 'sdk', anchor: '#downloads', description: '浏览器、Node、驱动与下载' },
    ],
  },
  {
    title: '后端与串口',
    label: '后端能力',
    collapsible: true,
    items: [
      { label: '能力总览', href: '/docs/backend#overview', page: 'backend', anchor: '#overview', description: '六项本地 Node 后端能力', keywords: '后端 本地 Node 数据链' },
      { label: '串口', href: '/docs/backend#serial', page: 'backend', anchor: '#serial', description: '枚举、连接、写入、断开、状态与异常恢复', keywords: 'COM WCH CH34 端口 connect disconnect close write 串口连接 主动断开 写入 状态 事件 异常 错误码 stale 重扫 rescan', children: serialNavigationItems },
      { label: '采集', href: '/docs/backend#capture', page: 'backend', anchor: '#capture', description: '限频、批量入库与磁盘保护', keywords: '录制 flush frequency Hz', children: captureNavigationItems },
      { label: '存储', href: '/docs/backend#storage', page: 'backend', anchor: '#storage', description: 'SQLite 与内存存储', keywords: '落盘 数据库 分页 查询 删除', children: storageNavigationItems },
      { label: '回放', href: '/docs/backend#replay', page: 'backend', anchor: '#replay', description: '播放、定位、逐帧、倍速与循环', keywords: 'Replay seek step speed loop', children: replayNavigationItems },
      { label: 'CSV', href: '/docs/backend#csv', page: 'backend', anchor: '#csv', description: '按采集、通道与时间导出', keywords: 'export 文件 表格', children: csvNavigationItems },
      { label: '简单算法通道', href: '/docs/backend#algorithms', page: 'backend', anchor: '#algorithms', description: '同步算法注册、启停与错误隔离', keywords: 'Algorithm pressure stats 同步', children: algorithmNavigationItems },
    ],
  },
  {
    title: '参考',
    items: [
      { label: 'API 参考', href: '/docs#docs', page: 'sdk', anchor: '#docs', description: 'Shroom、Device 与 Heatmap' },
      { label: '限制与排障', href: '/docs#tools', page: 'sdk', anchor: '#tools', description: '已知边界和常见问题' },
      { label: 'AI 与 Skill', href: '/docs#skill', page: 'sdk', anchor: '#skill', description: '当前做法与规划状态' },
    ],
  },
] as const;

function flattenDocItems(items: readonly DocNavItem[]): DocNavItem[] {
  return items.flatMap((item) => [item, ...flattenDocItems(item.children || [])]);
}

export const allDocsItems: readonly DocNavItem[] = docsNavigation.flatMap((group) => flattenDocItems(group.items));

export const pageTableOfContents: Readonly<Record<DocsPageId, readonly DocNavItem[]>> = {
  sdk: allDocsItems.filter((item) => item.page === 'sdk'),
  backend: allDocsItems.filter((item) => item.page === 'backend'),
};

export const codeSamples = {
  mock: {
    label: 'Mock',
    requirement: '无需硬件',
    note: '核心片段假设脚本位于解压后的 shroom-sdk 根目录，页面中已有 id="view" 的 Canvas。',
    code: `import { Shroom } from './web/index.js'

const heatmap = Shroom.createHeatmap('#view')
const device = Shroom.mock({ rows: 32, cols: 32, fps: 30 })

const off = device.onFrame((frame) => {
  heatmap.render(frame)
  console.log(frame.max, frame.area, frame.center)
})

// 结束时清理
// off()
// await device.close()`,
  },
  web: {
    label: '浏览器',
    requirement: 'Chrome / Edge',
    note: '核心片段假设页面已有 connect、disconnect 和 view 元素。完整页面请运行包内 web/index.html。',
    code: `import { Shroom } from './web/index.js'

const connectButton = document.querySelector('#connect')
const disconnectButton = document.querySelector('#disconnect')
const heatmap = Shroom.createHeatmap('#view')
let device

connectButton.addEventListener('click', async () => {
  device = await Shroom.connect({
    baudRate: 1_000_000,
    rows: 32,
    cols: 32,
  })

  device.onFrame((frame) => heatmap.render(frame))
})

disconnectButton.addEventListener('click', async () => {
  await device?.close()
  device = undefined
})`,
  },
  node: {
    label: 'Node / Electron',
    requirement: 'Node 18+ · ESM',
    note: '脚本放在解压后的 shroom-sdk 根目录。先执行 npm i serialport，再把 path 替换为实际串口。',
    code: `import { Shroom } from './node/index.js'

const device = await Shroom.connect({
  path: 'COM3',
  baudRate: 1_000_000,
  rows: 32,
  cols: 32,
})

const off = device.onFrame((frame) => {
  console.log(Shroom.renderAscii(frame, { width: 32 }))
})

process.once('SIGINT', async () => {
  off()
  await device.close()
  process.exit(0)
})`,
  },
} as const;

export type CodeSampleId = keyof typeof codeSamples;
