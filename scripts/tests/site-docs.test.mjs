import test from 'node:test';
import assert from 'node:assert/strict';
import { marked } from 'marked';
import { siteDocumentMarkdown } from '../site-docs.mjs';

test('hiding a language preserves adjacent install and JavaScript code blocks and old section anchors', () => {
  const source = '# 接入\n\n## 安装\n\n```bash\nnpm install shroom-sdk\n```\n\n```js\nimport { readProduct } from "shroom-sdk/quick-flow";\n```\n\n## Python\n\n```python\nfrom shroom_sdk import Shroom\n```\n\n## 取数\n\n```js\nawait readProduct({ product: "pad", onData: console.log });\n```\n';
  const visible = siteDocumentMarkdown(source);
  const snippets = text => marked.lexer(text).filter(token => token.type === 'code' && token.lang !== 'python')
    .map(({ lang, text }) => ({ lang, text }));
  assert.deepEqual(snippets(visible), snippets(source));
  assert.match(visible, /## 安装 \{#s1\}/);
  assert.match(visible, /## 取数 \{#s3\}/);
  assert.doesNotMatch(visible, /python|shroom_sdk/i);
});

test('mixed retrieved text keeps JavaScript facts while removing standalone Python snippets', () => {
  const source = 'Node.js 使用 readProduct 获取数据；Python 使用同步迭代。浏览器通过 WebSocket 接收。\n\n```python\nfrom shroom_sdk import Shroom\nprint(Shroom.version)\n```\n';
  const visible = siteDocumentMarkdown(source);
  assert.match(visible, /Node\.js 使用 readProduct 获取数据/);
  assert.match(visible, /浏览器通过 WebSocket 接收/);
  assert.doesNotMatch(visible, /python|shroom_sdk|print\(/i);
});
