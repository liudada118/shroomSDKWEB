import { createProductFlow } from '../../sdk/examples/product-flow.js';
import { workspaceReady, type WorkspaceState } from './product-workspace-model.ts';

export function workspaceFlow(state: WorkspaceState) {
  const steps = createProductFlow({
    product: state.product, platform: state.platform,
    ...(state.product === 'glove' ? { side: state.side ?? 'left' } : {}),
  });
  if (!workspaceReady(state)) steps[0].blocks[0].code = `// 阅读演示：请先按实物确认左手或右手。\n${steps[0].blocks[0].code}`;
  return steps;
}
