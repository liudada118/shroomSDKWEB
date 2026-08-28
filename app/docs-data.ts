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
};

type DocNavGroup = {
  title: string;
  label?: string;
  collapsible?: boolean;
  items: readonly DocNavItem[];
};

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
      { label: '串口', href: '/docs/backend#serial', page: 'backend', anchor: '#serial', description: '自动波特率、重试、写入与状态', keywords: 'COM WCH CH34 端口 重扫 错误码' },
      { label: '采集', href: '/docs/backend#capture', page: 'backend', anchor: '#capture', description: '限频、批量入库与磁盘保护', keywords: '录制 flush frequency Hz' },
      { label: '存储', href: '/docs/backend#storage', page: 'backend', anchor: '#storage', description: 'SQLite 与内存存储', keywords: '落盘 数据库 分页 查询 删除' },
      { label: '回放', href: '/docs/backend#replay', page: 'backend', anchor: '#replay', description: '播放、定位、逐帧、倍速与循环', keywords: 'Replay seek step speed loop' },
      { label: 'CSV', href: '/docs/backend#csv', page: 'backend', anchor: '#csv', description: '按采集、通道与时间导出', keywords: 'export 文件 表格' },
      { label: '简单算法通道', href: '/docs/backend#algorithms', page: 'backend', anchor: '#algorithms', description: '同步算法注册、启停与错误隔离', keywords: 'Algorithm pressure stats 同步' },
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

export const allDocsItems: readonly DocNavItem[] = docsNavigation.flatMap((group) => group.items);

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
