'use client';

import { useState } from 'react';

export default function DocCodeBlock({ label, code }: { label: string; code: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  async function copyCode() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
    window.setTimeout(() => setCopyState('idle'), 1800);
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-[#24344e] bg-[#09111f]">
      <figcaption className="flex min-h-11 items-center justify-between gap-4 border-b border-white/10 px-5 py-2 text-[#a9b7ca]">
        <span className="font-mono text-[11px]">{label}</span>
        <button
          type="button"
          onClick={copyCode}
          className="min-h-11 rounded-lg border border-white/15 px-3 font-mono text-[11px] text-[#d7e2f0] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84adff]"
        >
          {copyState === 'copied' ? '已复制' : copyState === 'error' ? '复制失败' : '复制代码'}
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {copyState === 'copied' ? `${label} 已复制` : copyState === 'error' ? `${label} 复制失败，请手动选择代码` : ''}
        </span>
      </figcaption>
      <div className="overflow-x-auto p-5 sm:p-6">
        <pre className="min-w-[620px] font-mono text-[13px] leading-7 text-[#d7e2f0]"><code>{code}</code></pre>
      </div>
    </figure>
  );
}
