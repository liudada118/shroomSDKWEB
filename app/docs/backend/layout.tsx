import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '后端与串口｜Shroom SDK 文档',
  description: 'Shroom 本地 Node 后端能力：增强串口、采集、SQLite 与内存存储、回放、CSV 和简单算法通道。',
  alternates: { canonical: '/docs/backend' },
  openGraph: {
    title: '后端与串口｜Shroom SDK 文档',
    description: '从串口 Frame 到采集、存储、回放、CSV 和同步算法的本地 Node 数据链。',
    url: '/docs/backend',
    type: 'website',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: '后端与串口｜Shroom SDK 文档',
    description: 'Shroom SDK 本地 Node 后端能力与接入边界。',
    images: [],
  },
};

export default function BackendDocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
