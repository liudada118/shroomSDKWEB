import { createProductExample } from '../../sdk/examples/product-examples.js';
import { workspaceReady, type WorkspaceState } from './product-workspace-model.ts';

/** 可阅读的示例参数不代表实物确认；具体复制/下载仍由 workspaceReady 独立约束。 */
export function workspaceReadingPreview(state: WorkspaceState): string {
  const ready = workspaceReady(state);
  const source = createProductExample({
    product: state.product,
    ...(state.product === 'glove' ? { side: state.side ?? 'left' } : {}),
    env: state.env, platform: state.platform, kind: state.codeKind,
  });
  if (ready) return source;
  const note = `代码阅读预览：以${state.side === 'right' ? '右手' : '左手'}参数演示，尚未确认实物手侧。请在顶部按实物确认手侧，再复制或下载示例。`;
  // 完整 Web 例程使用 HTML 注释，保持页面中展示的完整源码语法有效。
  return `${state.env === 'web' && state.codeKind === 'complete' ? `<!-- ${note} -->` : `// ${note}`}\n${source}`;
}
