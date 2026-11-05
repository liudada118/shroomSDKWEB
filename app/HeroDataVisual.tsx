'use client';

import { useId } from 'react';
import styles from './HeroDataVisual.module.css';

// 固定的触觉分布样本，仅用于解释数据流，不代表实时设备读数。
const pressureSample = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 1, 2, 3, 2, 1, 0, 0, 0],
  [0, 1, 3, 5, 4, 2, 1, 0, 0],
  [0, 1, 2, 4, 5, 3, 2, 1, 0],
  [0, 0, 1, 2, 3, 4, 4, 2, 0],
  [0, 0, 0, 1, 2, 4, 5, 3, 1],
  [0, 0, 0, 0, 1, 2, 3, 2, 0],
  [0, 0, 0, 0, 0, 0, 1, 0, 0],
] as const;

const pressureColors = ['#e8effb', '#d3e2fc', '#a9c7fb', '#78a7f8', '#4381ee', 'var(--blue, #2563eb)'];

function PressureCells({ size, gap }: { size: number; gap: number }) {
  return pressureSample.flatMap((row, rowIndex) => row.map((intensity, columnIndex) => (
    <rect key={`${rowIndex}-${columnIndex}`} x={columnIndex * (size + gap)} y={rowIndex * (size + gap)}
      width={size} height={size} rx={size > 10 ? 2 : 1.25} fill={pressureColors[intensity]} />
  )));
}

/** A static, illustrative path from a tactile matrix through the SDK to an application. */
export default function HeroDataVisual() {
  const id = useId();
  const background = `${id}-background`;
  const surface = `${id}-surface`;
  const shadow = `${id}-shadow`;

  return <figure className={styles.visual} aria-label="传感器压力数据经 SDK 接入应用的示意图">
    <span className={styles.sample}>数据示意</span>
    <svg className={styles.scene} viewBox="0 0 520 400" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={background} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#eaf2ff" stopOpacity=".9" />
          <stop offset="1" stopColor="#f8fbff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={surface} x1="26" y1="213" x2="217" y2="288" gradientUnits="userSpaceOnUse">
          <stop stopColor="#dfeafb" /><stop offset="1" stopColor="#c0d3f2" />
        </linearGradient>
        <filter id={shadow} x="-30%" y="-30%" width="170%" height="180%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#294e89" floodOpacity=".09" />
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#294e89" floodOpacity=".05" />
        </filter>
      </defs>

      <ellipse cx="272" cy="216" rx="255" ry="181" fill={`url(#${background})`} />

      <path d="M151 138 252 92M62 300l44 20M383 306l63-37" stroke="#e6edf8" strokeWidth="1" />
      <path d="M206 271h30c25 0 25 39 50 39h4" stroke="#dce7f8" strokeWidth="5" strokeLinecap="round" />
      <path d="M206 271h30c25 0 25 39 50 39h4" stroke="#83a9ec" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M321 291h13c31 0 16-65 48-65h13" stroke="#dce7f8" strokeWidth="5" strokeLinecap="round" />
      <path d="M321 291h13c31 0 16-65 48-65h13" stroke="#83a9ec" strokeWidth="1.5" strokeLinecap="round" />
      <path d="m246 276 1 7-7-2m120-22 5-5 3 6" stroke="#3976d9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      <g filter={`url(#${shadow})`}>
        <path d="m133 180 122 56v13l-122 56L11 249v-13Z" fill={`url(#${surface})`} />
        <path d="m133 180 122 56-122 56L11 236Z" fill="#f4f8ff" stroke="#cbdbf4" />
        <path d="M133 292v13m0-13L11 236m122 56 122-56" stroke="#b7cdef" />
        <path d="m133 158 122 56v11l-122 56L11 225v-11Z" fill="#d7e4f8" />
        <path d="m133 158 122 56-122 56L11 214Z" fill="white" stroke="#c5d8f5" />
        <g transform="matrix(.78 .36 -.78 .36 133 160)">
          <PressureCells size={13} gap={4} />
        </g>
      </g>

      <g filter={`url(#${shadow})`}>
        <rect x="272" y="61" width="230" height="166" rx="12" fill="white" stroke="#d6e2f4" />
        <rect x="285" y="88" width="112" height="112" rx="7" fill="#f8faff" stroke="#edf2fa" />
        <g transform="translate(294 97)"><PressureCells size={8} gap={2.75} /></g>

        <path d="M410 103h76m-76 20h76m-76 20h76m-76 20h76m-76 20h76" stroke="#edf2fa" />
        <path d="M410 94v99h76" stroke="#dce7f7" />
        <path d="M410 178c7 0 7-4 13-4 5 0 6 7 11 7 6 0 7-35 14-35 5 0 5 13 10 13s5 17 10 17 6-7 10-7 4 4 8 4v20h-76Z"
          fill="#eff5ff" />
        <path d="M410 178c7 0 7-4 13-4 5 0 6 7 11 7 6 0 7-35 14-35 5 0 5 13 10 13s5 17 10 17 6-7 10-7 4 4 8 4"
          stroke="var(--blue, #2563eb)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <g filter={`url(#${shadow})`}>
        <path d="M275 267v-7m12 7v-7m12 7v-7m12 7v-7m-36 68v-7m12 7v-7m12 7v-7m12 7v-7M264 279h-7m7 12h-7m7 12h-7m72-24h-7m7 12h-7m7 12h-7"
          stroke="#b0c8ee" strokeWidth="2" strokeLinecap="round" />
        <rect x="264" y="267" width="58" height="54" rx="11" fill="white" stroke="#bdd2f5" />
        <rect x="269" y="272" width="48" height="44" rx="7" fill="#f3f7ff" stroke="#e2ebfb" />
        <text x="293" y="298" fill="var(--blue, #2563eb)" textAnchor="middle" className={styles.sdk}>SDK</text>
      </g>
    </svg>
    <div className={styles.labels} aria-hidden="true">
      <span className={styles.sensorLabel}>传感器</span>
      <span className={styles.sdkLabel}>SDK</span>
      <span className={styles.applicationLabel}>应用</span>
    </div>
  </figure>;
}
