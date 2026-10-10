'use client';

import { useState, type ReactNode } from 'react';
import CopyRawButton from './CopyRawButton';
import { backendMarkdownForLanguage, type BackendLanguage } from './backend-language';

export default function BackendGuide({ raw, initialLanguage, children }: {
  raw: string;
  initialLanguage: BackendLanguage;
  children: ReactNode;
}) {
  const [language, setLanguage] = useState(initialLanguage);

  function changeLanguage(value: string) {
    if (value !== 'node' && value !== 'python') return;
    setLanguage(value);
    const url = new URL(window.location.href);
    url.searchParams.set('language', value);
    window.history.replaceState(window.history.state, '', url);
  }

  return (
    <section className="backend-guide" data-language={language} aria-label="后端接入文档">
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e4e7ec] bg-[#f8fafc] p-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="backend-language" className="text-sm font-semibold text-[#344054]">示例语言</label>
          <select id="backend-language" value={language} onChange={(event) => changeLanguage(event.target.value)}
            className="min-h-11 min-w-36 cursor-pointer rounded-lg border border-[#d0d5dd] bg-white px-3 text-sm font-medium text-[#101828] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">
            <option value="node">Node.js</option>
            <option value="python">Python</option>
          </select>
          <span className="text-xs leading-5 text-[#667085]">整篇示例随语言切换</span>
        </div>
        <CopyRawButton key={language} raw={backendMarkdownForLanguage(raw, language)} label={`复制 ${language === 'node' ? 'Node.js' : 'Python'} 文档`} />
      </div>
      <p role="status" aria-live="polite" className="sr-only">当前示例语言：{language === 'node' ? 'Node.js' : 'Python'}。串口、通讯、存储章节保持不变。</p>
      {children}
    </section>
  );
}
