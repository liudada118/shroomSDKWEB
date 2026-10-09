import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import DownloadProvider from './DownloadProvider';
import SiteShell from './SiteShell';
import { docPages } from './docs/generated';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://sdk.jq-industries.com'),
  title: 'Shroom Developer｜SDK 开发中心',
  description: '通过 Shroom Skill 快速接入统一 SDK，并获取对应系统的 Shroom 上位机、驱动、网页调试和 Mapping 工具。',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Shroom Developer｜SDK 开发中心',
    description: '用 AI Skill，更快接入统一 Shroom SDK。',
    type: 'website',
    url: '/',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Shroom Developer — 让硬件数据，更快抵达应用。',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shroom Developer｜SDK 开发中心',
    description: '用 AI Skill，更快接入统一 Shroom SDK。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DownloadProvider>
          <SiteShell pageTitles={{ '/': '开发概览', '/docs': '文档中心', '/knowledge': 'AI 知识问答', ...Object.fromEntries(docPages.map((doc) => [`/docs/${doc.slug}`, doc.label])) }}>
            {children}
          </SiteShell>
        </DownloadProvider>
      </body>
    </html>
  );
}
