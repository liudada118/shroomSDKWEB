import { createProductFlow } from '../../sdk/examples/product-flow.js';
import { workspaceReady, type WorkspaceProduct, type WorkspaceState } from './product-workspace-model.ts';
import { getCatalogProduct } from '../product-catalog.ts';

export function workspaceFlow(state: WorkspaceState) {
  const product = getCatalogProduct(state.product);
  const steps = createProductFlow({
    product: state.product, platform: state.platform,
    importStyle: 'package',
    ...(product.requiresSide ? { side: state.side ?? 'left' } : {}),
    ...(product.protocols.length ? { protocol: state.protocol } : {}),
  });
  if (!workspaceReady(state)) steps[0].blocks[0].code = `// 阅读演示：请先按实物确认${product.sideNames?.left}或${product.sideNames?.right}。\n${steps[0].blocks[0].code}`;
  return steps;
}

/** 自动模式省略串口与侧别；只展示所选分包产品实际返回的数据。 */
export function workspaceAutomaticReadCode(product: WorkspaceProduct): string | null {
  if (product !== 'glove' && product !== 'foot') return null;
  const foot = product === 'foot';
  const sideNames = foot ? '左右脚' : '左右手';
  const fields = foot ? 'data.side, data.packetType, data.pressure, data.imu.raw, data.rawPackets' : 'data.side, data.fingers, data.palm';
  return [
    "import { readProduct } from 'shroom-sdk/quick-flow';", '',
    `// 先激活 SDK 授权；自动扫描唯一${foot ? '触觉足底' : '分包手套'}并识别${sideNames}。`,
    ...(foot ? ['// 包类型 3=左脚、4=右脚；原始压力 60 点，6 列 × 10 行（rows=10、cols=6）。', '// rawPackets 保留完整串口包，imu.raw 保留原始 16 字节。'] : []),
    'let device;', 'try {', '  device = await readProduct({',
    `    product: '${product}',`,
    `    // ${sideNames}同时连接时，加 side: 'left' 或 'right' 筛选。`,
    `    onData: data => console.log(${fields}),`,
    '    onError: error => console.error(error.code, error.message),',
    '    onStateChange: status => console.log(status.state),',
    '  });', '} catch (error) {',
    '  console.error(error.code, error.message); // 无匹配、多匹配或授权错误。',
    '  throw error; // 连接失败时，不继续创建 WS。', '}',
    '// 后面四步继续使用 device；结束使用时 await device.close()。',
  ].join('\n');
}
