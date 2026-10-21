'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import CopyRawButton from './CopyRawButton';
import { BACKEND_LANGUAGE_EVENT, backendMarkdownForLanguage, type BackendLanguage } from './backend-language';

const BackendContext = createContext<{
  raw: string;
  language: BackendLanguage;
  changeLanguage: (value: string) => void;
} | null>(null);

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
    window.dispatchEvent(new Event(BACKEND_LANGUAGE_EVENT));
  }

  return (
    <BackendContext.Provider value={{ raw, language, changeLanguage }}>
      <section className="backend-guide" data-language={language} aria-label="后端接入文档">
        <p role="status" aria-live="polite" className="sr-only">当前示例语言：{language === 'node' ? 'Node.js' : 'Python'}。串口、通讯、存储章节保持不变。</p>
        {children}
      </section>
    </BackendContext.Provider>
  );
}

export function BackendGuideToolbar() {
  const context = useContext(BackendContext);
  if (!context) return null;
  const { raw, language, changeLanguage } = context;
  return (
    <div className="docs-language-toolbar">
      <div className="docs-language-control">
        <label htmlFor="backend-language">示例语言</label>
        <select id="backend-language" value={language} onChange={(event) => changeLanguage(event.target.value)}>
          <option value="node">Node.js</option>
          <option value="python">Python</option>
        </select>
        <span className="docs-language-hint">切换整篇代码示例</span>
      </div>
      <CopyRawButton key={language} raw={backendMarkdownForLanguage(raw, language)} label={`复制 ${language === 'node' ? 'Node.js' : 'Python'} 文档`} />
    </div>
  );
}
