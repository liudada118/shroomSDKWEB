import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Shroom SDK 文档｜快速开始与 API 参考',
  description: 'Shroom Sensor SDK 的快速开始、Frame 数据合同、Web Serial、Node/Electron、Mock、API 与兼容性说明。',
  alternates: {
    canonical: '/docs',
  },
  openGraph: {
    title: 'Shroom SDK 文档｜快速开始与 API 参考',
    description: '从第一次 Mock Frame 到 Web Serial 与 Node 串口接入。',
    type: 'website',
    url: '/docs',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Shroom SDK 文档。',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shroom SDK 文档｜快速开始与 API 参考',
    description: '从第一次 Mock Frame 到 Web Serial 与 Node 串口接入。',
    images: ['/og.png'],
  },
};

export default function DocsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
