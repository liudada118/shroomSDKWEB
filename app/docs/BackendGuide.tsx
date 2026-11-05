'use client';

import { createContext, useContext, type ReactNode } from 'react';
import CopyRawButton from './CopyRawButton';
import { backendMarkdownForLanguage } from './backend-language';

const BackendContext = createContext<{
  raw: string;
} | null>(null);

export default function BackendGuide({ raw, children }: {
  raw: string;
  children: ReactNode;
}) {
  return (
    <BackendContext.Provider value={{ raw }}>
      <section className="backend-guide" data-language="node" aria-label="后端接入文档">
        {children}
      </section>
    </BackendContext.Provider>
  );
}

export function BackendGuideToolbar() {
  const context = useContext(BackendContext);
  if (!context) return null;
  const { raw } = context;
  return (
    <div className="docs-language-toolbar">
      <div className="docs-language-control">
        <span>Node.js 接入文档</span>
      </div>
      <CopyRawButton raw={backendMarkdownForLanguage(raw, 'node')} label="复制 Node.js 文档" />
    </div>
  );
}
