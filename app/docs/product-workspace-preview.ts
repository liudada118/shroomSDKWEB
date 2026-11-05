import { createProductFlow } from '../../sdk/examples/product-flow.js';
import { workspaceReady, type WorkspaceState } from './product-workspace-model.ts';
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
