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
  description: '一个函数拿到产品数据。按语言下载 Shroom SDK，按平台获取上位机与串口驱动；通过文档中心按需接入采集和下载。',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Shroom Developer｜SDK 开发中心',
    description: '调用 readProduct() 拿到产品数据，按需扩展网页传输、采集和下载。',
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
          <SiteShell
            pageTitles={{ '/': '开发概览', '/docs': '文档中心', '/docs/products': '产品接口参考', '/docs/skills': '用 Skill 快速接入', '/knowledge': 'AI 知识问答', ...Object.fromEntries(docPages.map((doc) => [`/docs/${doc.slug}`, doc.label])) }}
            docOutlines={Object.fromEntries(docPages.map((doc) => [`/docs/${doc.slug}`, doc.toc]))}
          >
            {children}
          </SiteShell>
        </DownloadProvider>
      </body>
    </html>
  );
}
