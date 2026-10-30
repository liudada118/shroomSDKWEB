/** 兼容官网原构建命令；实际构建规则只维护在独立 SDK 仓库。 */
import { syncSdkAssets } from './sdk-source.mjs';

syncSdkAssets({ bundleOnly: true }).catch(error => { console.error(error.message); process.exitCode = 1; });
