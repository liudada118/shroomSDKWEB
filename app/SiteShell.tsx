'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SiteNavigation from './SiteNavigation';
import KnowledgeWidget from './components/knowledge-widget';
import { consumePendingAnchor } from './components/knowledge-jump';

export default function SiteShell({ children, pageTitles }: {
  children: ReactNode;
  pageTitles: Record<string, string>;
}) {
  const pathname = usePathname();
  useEffect(() => { consumePendingAnchor(); }, [pathname]);

  return (
    <div className="min-h-screen bg-white text-[#101828]">
      <SiteNavigation key={pathname} pathname={pathname} pageTitle={pageTitles[pathname] ?? '页面未找到'} />
      <main id="main-content" tabIndex={-1} className="sdk-content min-h-[calc(100dvh-160px)] min-w-0 overflow-x-clip pt-[72px] lg:ml-60">
        {children}
      </main>
      <footer className="border-t border-[#e4e7ec] bg-white lg:ml-60">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8 xl:flex-row xl:items-center xl:justify-between lg:px-10">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#2563eb] text-xs font-black text-white">S</span>
            <div>
              <p className="text-sm font-bold">Shroom Developer</p>
              <p className="mt-0.5 text-[11px] text-[#667085]">Build with sensor data.</p>
            </div>
          </div>
          <nav aria-label="页脚导航" className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-[#667085]">
            <Link href="/#capabilities" className="hover:text-[#175cd3]">产品能力</Link>
            <Link href="/#downloads" className="hover:text-[#175cd3]">SDK 与上位机</Link>
            <Link href="/docs" className="hover:text-[#175cd3]">文档中心</Link>
            <Link href="/knowledge" className="hover:text-[#175cd3]">AI 知识问答</Link>
            <a href="/lab.html" target="_blank" rel="noreferrer" className="hover:text-[#175cd3]">网页测试台</a>
            <Link href="/docs/readme" className="hover:text-[#175cd3]">排错与支持</Link>
          </nav>
          <p className="text-[11px] text-[#667085]">© 2026 Shroom. All rights reserved.</p>
        </div>
      </footer>
      <KnowledgeWidget />
    </div>
  );
}
