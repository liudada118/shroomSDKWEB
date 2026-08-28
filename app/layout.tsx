import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://shroom-developer-center.stelmachtemme1632.chatgpt.site'),
  title: 'Shroom Developer｜SDK 开发中心',
  description: '通过 Shroom Skill 规划快速接入统一 SDK，并获取本地 Node 后端、上位机、驱动、网页调试和 Mapping 工具。',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Shroom Developer｜SDK 开发中心',
    description: '以统一 SDK、本地 Node 后端、Skill 规划和开发工具组织硬件接入资源。',
    type: 'website',
    url: '/',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Shroom Developer：让硬件数据，更快抵达应用。',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shroom Developer｜SDK 开发中心',
    description: '以统一 SDK、本地 Node 后端、Skill 规划和开发工具组织硬件接入资源。',
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
        {children}
      </body>
    </html>
  );
}
