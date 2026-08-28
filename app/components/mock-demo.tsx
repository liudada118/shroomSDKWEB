'use client';

import { useEffect, useMemo, useState } from 'react';

function createPressureFrame(frame: number, size: number) {
  const centerX = size * 0.58 + Math.sin(frame * 0.16) * size * 0.12;
  const centerY = size * 0.43 + Math.cos(frame * 0.13) * size * 0.1;
  const secondX = size * 0.3 + Math.cos(frame * 0.11) * size * 0.06;
  const secondY = size * 0.69 + Math.sin(frame * 0.09) * size * 0.08;
  const pulse = 0.86 + Math.sin(frame * 0.18) * 0.1;

  return Array.from({ length: size * size }, (_, index) => {
    const x = index % size;
    const y = Math.floor(index / size);
    const primary = Math.exp(-(((x - centerX) ** 2) / (size * 0.55) + ((y - centerY) ** 2) / (size * 0.74))) * pulse;
    const secondary = Math.exp(-(((x - secondX) ** 2) / (size * 0.3) + ((y - secondY) ** 2) / (size * 0.38))) * 0.57;
    return Math.min(1, primary + secondary);
  });
}

function calculateStats(values: number[], size: number) {
  const threshold = 0.02;
  let total = 0;
  let xTotal = 0;
  let yTotal = 0;
  let max = 0;
  let area = 0;

  values.forEach((value, index) => {
    const x = index % size;
    const y = Math.floor(index / size);
    max = Math.max(max, value);
    if (value > threshold) {
      area += 1;
      total += value;
      xTotal += x * value;
      yTotal += y * value;
    }
  });

  return {
    max,
    area,
    centerX: total ? xTotal / total / Math.max(1, size - 1) : 0.5,
    centerY: total ? yTotal / total / Math.max(1, size - 1) : 0.5,
  };
}

const PRESSURE_LEVELS = [
  'bg-[#102343] opacity-[0.55]',
  'bg-[#164e63] opacity-[0.62]',
  'bg-[#0e7490] opacity-[0.68]',
  'bg-[#0d9488] opacity-[0.74]',
  'bg-[#65a30d] opacity-[0.80]',
  'bg-[#eab308] opacity-[0.86]',
  'bg-[#f97316] opacity-[0.92]',
  'bg-[#ef4444] opacity-[0.98]',
] as const;

export default function MockDemo() {
  const size = 16;
  const [running, setRunning] = useState(false);
  const [frame, setFrame] = useState(0);
  const [gain, setGain] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setReducedMotion(media.matches);
      if (media.matches) setRunning(false);
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!running || reducedMotion) return;
    const timer = window.setInterval(() => setFrame((current) => current + 1), 160);
    return () => window.clearInterval(timer);
  }, [running, reducedMotion]);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) setRunning(false);
    };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);

  const values = useMemo(
    () => createPressureFrame(frame, size).map((value) => Math.min(1, value * gain)),
    [frame, gain],
  );
  const stats = useMemo(() => calculateStats(values, size), [values]);

  function toggle() {
    if (reducedMotion) {
      setFrame((current) => current + 1);
      return;
    }
    setRunning((current) => !current);
  }

  function step() {
    setRunning(false);
    setFrame((current) => current + 1);
  }

  return (
    <div onFocusCapture={() => setRunning(false)} className="mt-7 grid overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] lg:grid-cols-[minmax(0,1.08fr)_minmax(250px,0.92fr)]">
      <div className="bg-[#07101f] p-4 sm:p-6">
        <div
          role="img"
          aria-label="模拟压力 Frame 的 16 乘 16 热力图"
          className="grid aspect-square gap-[3px] rounded-lg bg-[#050b15] p-3"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {values.map((value, index) => (
            <span
              key={index}
              className={`rounded-[3px] ${PRESSURE_LEVELS[Math.min(PRESSURE_LEVELS.length - 1, Math.floor(value * PRESSURE_LEVELS.length))]}`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--text-strong)]">Mock Grid</p>
            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">页面内按默认 threshold=0.02 计算的结构演示，不代表 SDK 运行时或真实设备遥测。</p>
          </div>
          <span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--accent-strong)]">MOCK</span>
        </div>

        <dl className="mt-7 grid grid-cols-2 gap-x-5 gap-y-6">
          <div><dt className="font-mono text-[10px] text-[var(--text-subtle)]">demo.max</dt><dd className="mt-1 font-mono text-lg font-semibold text-[var(--text-strong)]">{stats.max.toFixed(3)}</dd></div>
          <div><dt className="font-mono text-[10px] text-[var(--text-subtle)]">demo.area</dt><dd className="mt-1 font-mono text-lg font-semibold text-[var(--text-strong)]">{stats.area}</dd></div>
          <div><dt className="font-mono text-[10px] text-[var(--text-subtle)]">demo.center.x</dt><dd className="mt-1 font-mono text-lg font-semibold text-[var(--text-strong)]">{stats.centerX.toFixed(2)}</dd></div>
          <div><dt className="font-mono text-[10px] text-[var(--text-subtle)]">demo.center.y</dt><dd className="mt-1 font-mono text-lg font-semibold text-[var(--text-strong)]">{stats.centerY.toFixed(2)}</dd></div>
        </dl>

        <label className="mt-8 block text-xs font-semibold text-[var(--text-muted)]">
          显示增益 <span className="font-mono text-[var(--text-strong)]">{gain.toFixed(1)}x</span>
          <input
            type="range"
            min="0.6"
            max="1.8"
            step="0.1"
            value={gain}
            onChange={(event) => setGain(Number(event.target.value))}
            className="mt-3 w-full accent-[var(--accent)]"
          />
        </label>

        <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
          <button type="button" onClick={toggle} className="min-h-11 rounded-lg bg-[var(--accent-fill)] px-4 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-fill-hover)]">
            {reducedMotion ? '下一帧' : running ? '暂停' : '开始'}
          </button>
          <button type="button" onClick={step} className="min-h-11 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold text-[var(--text-strong)] transition hover:border-[var(--focus)] hover:text-[var(--accent-strong)]">
            单帧
          </button>
        </div>
      </div>
    </div>
  );
}
