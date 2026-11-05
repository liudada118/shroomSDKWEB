/** 官网镜像锁定 SDK 的下载包；版本发布由 shroomSDK 仓库负责。 */
import { syncSdkAssets } from './sdk-source.mjs';

syncSdkAssets().catch(error => { console.error(error.message); process.exitCode = 1; });
