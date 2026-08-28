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
  title: 'Shroom Sensor SDK｜从串口到统一压力帧',
  description: '用 Web Serial、Node serialport 或 Mock 获得统一 Frame，并将压力数据渲染为 Canvas 热力图。',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Shroom Sensor SDK｜从串口到统一压力帧',
    description: '连接数据源，订阅统一 Frame，渲染压力热力图。',
    type: 'website',
    url: '/',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Shroom Developer - 从串口到统一压力帧。',
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
