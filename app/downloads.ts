import desktopRelease from './desktop-release.json';

export type DownloadTarget = {
  url: string;
  source: string;
  title: string;
  subtitle: string;
  sdkVersion?: string;
  sdkLanguage?: 'python' | 'node';
};

// SDK 由构建脚本打包；大型上位机压缩包由 Nginx / CDN 提供。
const DESKTOP_BASE = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_BASE ?? '/downloads';
export const DESKTOP_WIN_URL = `${DESKTOP_BASE}/${desktopRelease.fileName}`;

export const SDK_VARIANTS: (DownloadTarget & { label: string; description: string; contents: string; guideHref: string; details: string })[] = [
  {
    url: '/shroom-sdk-python.zip',
    source: 'sdk-python',
    sdkLanguage: 'python',
    sdkVersion: '0.1.0',
    label: 'Python',
    description: '数据采集、分析与算法开发',
    contents: 'Python 3.10+ · pySerial · 模拟数据与图形示例',
    guideHref: '/docs/python',
    details: '通过 pip 本地安装，不依赖 Node.js。提供同步逐帧读取、模拟设备和可选 Matplotlib 热力图示例。',
    title: '获取 Python SDK',
    subtitle: '已选择 Python 独立包。留个联系方式，提交后立即下载 ZIP，解压后通过 pip 本地安装。',
  },
  {
    url: '/shroom-sdk-node.zip',
    source: 'sdk-node',
    sdkLanguage: 'node',
    sdkVersion: '0.1.0',
    label: 'Node.js',
    description: 'Node.js / Electron 开发，也包含浏览器入口',
    contents: 'Node.js 18+ · serialport · Web Serial 示例',
    guideHref: '/docs/readme',
    details: '用于 Node.js、Electron 和网页开发。提供实时数据回调，同时包含浏览器串口接入和 Canvas 热力图示例。',
    title: '获取 Node.js SDK',
    subtitle: '已选择 Node.js 包（含浏览器入口）。留个联系方式，提交后立即下载 ZIP，包含源码、示例和 AI 接入指南。',
  },
];

export const DESKTOP_TARGET: DownloadTarget = {
  url: DESKTOP_WIN_URL,
  source: 'desktop-win',
  title: `下载 Windows 上位机 ${desktopRelease.version}`,
  subtitle: `免安装 zip，${desktopRelease.sizeLabel}，下载需要一点时间。留个联系方式，方便后续技术支持。`,
  sdkVersion: desktopRelease.version,
};
