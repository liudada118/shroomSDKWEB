import { inspectSdkSource } from './sdk-source.mjs';

inspectSdkSource().then(sdk => console.log(`SDK 来源正确：${sdk.version} / ${sdk.commit}`))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
