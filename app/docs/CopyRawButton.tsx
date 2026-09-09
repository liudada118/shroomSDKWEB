'use client';

import { useState } from 'react';

/**
 * 把整篇 Markdown 原文复制到剪贴板，直接粘给 AI。
 *
 * 复制的是原文而不是页面上渲染出来的 HTML —— AI 读 Markdown 比读一堆标签准得多，
 * 而且原文里的表格和代码块结构不会在复制时被压扁。
 */
export default function CopyRawButton({ raw, label }: { raw: string; label: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(raw);
      setState('done');
    } catch {
      // http 明文页面或旧浏览器里 clipboard 可能不可用，别假装成功
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 2400);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#175cd3]"
    >
      {state === 'done' ? '已复制，去粘给 AI' : state === 'failed' ? '复制失败，请手动全选' : label}
    </button>
  );
}
