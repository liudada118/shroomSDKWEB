import sdkPackage from './sdk-package.generated.json' with { type: 'json' };

/** 下载 URL 带内容哈希，客户锁文件指向明确字节；上线、预览与本地使用各自站点。 */
export function sdkInstallCommand(origin = 'https://sdk.jq-industries.com'): string {
  const site = new URL(origin);
  if (!['http:', 'https:'].includes(site.protocol)) throw new Error('SDK 安装地址需要 HTTP 或 HTTPS 站点');
  return `npm install --save-exact "${new URL(sdkPackage.url, site.origin).href}"`;
}
