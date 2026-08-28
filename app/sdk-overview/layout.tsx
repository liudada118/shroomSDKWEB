import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Shroom Sensor SDK｜从串口到统一压力帧',
  description: '用 Web Serial、Node serialport 或 Mock 获得统一 Frame，并将压力数据渲染为 Canvas 热力图。',
  alternates: {
    canonical: '/sdk-overview',
  },
  openGraph: {
    title: 'Shroom Sensor SDK｜从串口到统一压力帧',
    description: '连接数据源，订阅统一 Frame，渲染压力热力图。',
    type: 'website',
    url: '/sdk-overview',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Shroom Sensor SDK：从串口到统一压力帧。',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shroom Sensor SDK｜从串口到统一压力帧',
    description: '连接数据源，订阅统一 Frame，渲染压力热力图。',
    images: ['/og.png'],
  },
};

export default function SdkOverviewLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
