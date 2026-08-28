'use client';

import { type KeyboardEvent, useEffect, useState } from 'react';
import { codeSamples, type CodeSampleId } from '../docs-data';

const SAMPLE_IDS = Object.keys(codeSamples) as CodeSampleId[];

export default function CodeSamples() {
  const [activeSample, setActiveSample] = useState<CodeSampleId>('mock');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const current = codeSamples[activeSample];
  const sampleIds = SAMPLE_IDS;

  useEffect(() => {
    const syncFromHash = () => {
      const id = window.location.hash.replace('#quick-start-', '') as CodeSampleId;
      if (SAMPLE_IDS.includes(id)) setActiveSample(id);
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  async function copyCode() {
    if (!navigator.clipboard) {
      setCopyState('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(current.code);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1600);
    } catch {
      setCopyState('error');
    }
  }

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % sampleIds.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + sampleIds.length) % sampleIds.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = sampleIds.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextId = sampleIds[nextIndex];
    setActiveSample(nextId);
    setCopyState('idle');
    document.getElementById(`quick-start-${nextId}`)?.focus();
  }

  return (
    <div className="mt-7 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="选择运行环境" className="flex min-w-0 gap-1 overflow-x-auto">
          {sampleIds.map((id, index) => {
            const sample = codeSamples[id];
            const active = id === activeSample;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`quick-start-${id}`}
                aria-selected={active}
                aria-controls="sample-code-panel"
                tabIndex={active ? 0 : -1}
                onKeyDown={(event) => moveTab(event, index)}
                onClick={() => {
                  setActiveSample(id);
                  setCopyState('idle');
                  window.history.replaceState(null, '', `#quick-start-${id}`);
                }}
                className={`min-h-11 shrink-0 scroll-mt-24 rounded-lg px-3 text-sm font-semibold transition ${active ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'}`}
              >
                {sample.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-live="polite"
          onClick={copyCode}
          className="min-h-11 shrink-0 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[var(--text-strong)] transition hover:border-[var(--focus)] hover:text-[var(--accent-strong)]"
        >
          {copyState === 'copied' ? '已复制' : copyState === 'error' ? '复制不可用' : '复制代码'}
        </button>
      </div>

      <div className="flex flex-col gap-2 border-b border-[var(--line)] bg-[var(--surface-muted)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-[var(--text-muted)]">{current.note}</p>
        <span className="shrink-0 font-mono text-xs font-semibold text-[var(--text-subtle)]">{current.requirement}</span>
      </div>

      <div
        id="sample-code-panel"
        role="tabpanel"
        aria-labelledby={`quick-start-${activeSample}`}
        className="overflow-x-auto bg-[#09111f] p-5 sm:p-6"
      >
        <pre className="min-w-[680px] font-mono text-[13px] leading-7 text-[#d7e2f0]"><code>{current.code}</code></pre>
      </div>
    </div>
  );
}
