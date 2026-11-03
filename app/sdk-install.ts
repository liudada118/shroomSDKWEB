/** 客户通过 npm 包名安装；官网 TGZ 继续作为直接下载与历史锁文件的兼容入口。 */
export function sdkInstallCommand(): string {
  return 'npm install shroom-sdk';
}
