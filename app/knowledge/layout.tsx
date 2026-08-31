import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'SDK 知识库问答｜Shroom Developer',
  description: '基于 Shroom SDK 与 Backend 文档的智谱 GLM 知识库问答，提供可核对的文档来源。',
  alternates: {
    canonical: '/knowledge',
  },
  openGraph: {
    title: 'SDK 知识库问答｜Shroom Developer',
    description: '从 Shroom SDK 文档中检索并回答开发问题，保留命中文档作为依据。',
    url: '/knowledge',
  },
  twitter: {
    title: 'SDK 知识库问答｜Shroom Developer',
    description: '从 Shroom SDK 文档中检索并回答开发问题，保留命中文档作为依据。',
  },
};

export default function KnowledgeLayout({ children }: { children: ReactNode }) {
  return children;
}
