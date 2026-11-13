import sdkPackage from '../sdk/package.json' with { type: 'json' };
import npmPackage from './sdk-package.generated.json' with { type: 'json' };

const sdkVersion = sdkPackage.version;
export const SDK_SOURCE_URL = 'https://github.com/liudada118/shroomSDK';

export type DownloadTarget = {
  url: string;
  source: string;
  title: string;
  subtitle: string;
  sdkVersion?: string;
  sdkLanguage?: 'python' | 'node';
  fileName?: string;
  /** 单独申请 SDK 产品密钥；提交完成后不触发下载。 */
  requestLicense?: true;
};

export const SDK_LICENSE_REQUEST: DownloadTarget = {
  url: '/docs/license',
  source: 'sdk-license',
  title: '申请 SDK 密钥',
  subtitle: '留下联系方式，我们会联系你确认接入需求并处理密钥申请。SDK 可直接安装或下载。',
  sdkVersion,
  requestLicense: true,
};

// 用户提供的 CH34x 串口驱动；驱动独立于 SDK 和上位机安装包，直接下载无需登记。
export const SERIAL_DRIVERS = [
  {
    id: 'windows', label: 'Windows', format: 'EXE',
    url: 'https://shroom.jq-industries.com/drive/CH341SER.EXE',
    installNote: '下载后运行安装程序，按提示完成驱动安装。',
  },
  {
    id: 'macos', label: 'macOS', format: 'ZIP',
    url: 'https://shroom.jq-industries.com/drive/CH34xVCPDriver.zip',
    installNote: '下载并解压，按包内说明安装；如系统提示允许驱动，请按提示完成。',
  },
] as const;

// SDK 由构建脚本打包；上位机安装包由独立下载站提供，不放入本站构建产物。
type DesktopRelease = {
  id: 'windows' | 'macos' | 'linux';
  label: string;
  badge: string;
  version: string;
  size: number;
  url: string;
  format: 'EXE' | 'DMG' | 'DEB';
  compatibility: string;
  description: string;
  installNote: string;
  driverNote: string;
};

// 版本与架构来自用户提供的文件名；体积来自 2026-10-13 的 HTTPS HEAD 响应。
// 不复用旧 Shroom Monitor ZIP 的发布日期、更新日志、签名状态或授权说明。
const desktopReleases: DesktopRelease[] = [
  {
    id: 'windows', label: 'Windows', badge: 'W', version: '1.1.36', size: 384672158,
    url: 'https://shroom.jq-industries.com/shroom1/Shroom%20Setup%201.1.36.exe',
    format: 'EXE', compatibility: 'Windows',
    description: '下载 Shroom Windows 安装程序，按安装向导完成安装。',
    installNote: '下载后运行 EXE，按安装向导操作；此包不是免安装 ZIP。',
    driverNote: '先安装 Windows CH34x 串口驱动，再在设备管理器中确认 COM 端口可见；安装后重插设备并重启采集程序。',
  },
  {
    id: 'macos', label: 'macOS', badge: 'M', version: '1.1.37', size: 437163541,
    url: 'https://shroom.jq-industries.com/shroom1/Shroom-1.1.37-arm64.dmg',
    format: 'DMG', compatibility: 'Apple Silicon · ARM64',
    description: '适用于 Apple Silicon Mac 的 Shroom 安装包，不适用于 Intel Mac。',
    installNote: '下载后打开 DMG，按包内提示安装；请先确认 Mac 使用 Apple Silicon 芯片。',
    driverNote: '先下载 macOS CH34x 驱动 ZIP，解压并按说明安装；按系统提示允许驱动后，重插设备并重新查询串口。',
  },
  {
    id: 'linux', label: 'Linux', badge: 'L', version: '1.1.38', size: 256686224,
    url: 'https://shroom.jq-industries.com/shroom1/Shroom-1.1.38-amd64.deb',
    format: 'DEB', compatibility: 'amd64 / x86_64',
    description: '适用于支持 DEB 软件包的 amd64 / x86_64 Linux 系统，不适用于 ARM64。',
    installNote: '通过系统软件包安装工具安装 DEB；请先确认系统支持 DEB，且 CPU 架构为 amd64 / x86_64。',
    driverNote: '确认当前用户有串口访问权限；若提示 Permission denied，请按发行版说明配置串口用户组。',
  },
];

export const DESKTOP_PLATFORMS = desktopReleases.map((release) => {
  const sizeLabel = `约 ${Math.round(release.size / 1_000_000)} MB`;
  const target: DownloadTarget = {
    url: release.url,
    source: release.id === 'windows' ? 'desktop-win' : `desktop-${release.id}`,
    title: `下载 ${release.label} 上位机 ${release.version}`,
    subtitle: `${release.compatibility} · ${release.format} · ${sizeLabel}。留个联系方式，方便后续技术支持。`,
    // 沿用现有登记接口字段，记录所选上位机版本。
    sdkVersion: release.version,
  };
  return { ...release, sizeLabel, target };
});

// 官网当前只展示 JavaScript / TypeScript；独立 SDK 的其他语言实现与历史下载保持不变。
export const SDK_VARIANTS: (DownloadTarget & { label: string; description: string; contents: string; guideHref: string; details: string })[] = [
  {
    url: npmPackage.url,
    source: 'sdk-node',
    sdkLanguage: 'node',
    sdkVersion,
    fileName: npmPackage.fileName,
    label: 'Node.js',
    description: 'Node.js / Electron 开发，也包含浏览器入口',
    contents: 'Node.js 18+ · JavaScript / TypeScript · 含浏览器入口',
    guideHref: '/docs/quick-start',
    details: '一个函数读取手套、手垫、鞋垫或人体全身数据。分包手套从 SDK 0.4.0 起支持，0.5.0 可自动识别串口和左右手；鞋垫与人体全身从 0.3.0 起支持。之后可按需创建 WS、采集与下载。',
    title: '获取 Node.js SDK',
    subtitle: '可通过 npm 安装的精简包，包含 Node.js 与浏览器入口。连接真实设备前另行申请 SDK 产品密钥。',
  },
];
