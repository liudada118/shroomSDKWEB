import type { ReactNode } from 'react';
import Link from 'next/link';
import { SDK_DOWNLOAD, SDK_VERSION, type DocsPageId } from '../docs-data';
import DocsHeader from './docs-header';
import DocsNavigation from './docs-navigation';
import SectionLocateFlash from './section-locate-flash';

export default function DocsPageShell({
  page,
  skipTarget,
  footerTitle,
  footerDescription,
  tocStatus,
  children,
}: {
  page: DocsPageId;
  skipTarget: `#${string}`;
  footerTitle: string;
  footerDescription: string;
  tocStatus: string;
  children: ReactNode;
}) {
  const relatedDocs = page === 'backend'
    ? { href: '/docs#top', label: '基础文档' }
    : { href: '/docs/backend#overview', label: '后端能力' };

  return (
    <>
      <a className="skip-link" href={skipTarget}>跳到主要内容</a>
      <SectionLocateFlash />
      <DocsHeader page={page} />

      <main className="min-h-[100dvh] bg-[var(--page)] text-[var(--text)]">
        <div className="mx-auto grid max-w-[1500px] pt-[72px] lg:grid-cols-[248px_minmax(0,1fr)] 2xl:grid-cols-[248px_minmax(0,1fr)_220px]">
          <aside className="sticky top-[72px] hidden h-[calc(100dvh-72px)] overflow-y-auto border-r border-[var(--line)] bg-[var(--surface-muted)] px-4 py-8 lg:block">
            <DocsNavigation page={page} instance="sidebar" />
          </aside>

          <article className="relative min-w-0 overflow-hidden bg-[var(--surface)] px-5 py-10 sm:px-8 sm:py-14 lg:px-10 xl:px-14">
            <div className="hero-grid pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-60" />
            <div className="pointer-events-none absolute left-1/2 top-[-300px] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[#e9f2ff] blur-3xl" />
            <div className="relative mx-auto max-w-4xl">{children}</div>
          </article>

          <aside className="sticky top-[72px] hidden h-[calc(100dvh-72px)] overflow-y-auto border-l border-[var(--line)] bg-[var(--surface-muted)] px-5 py-8 2xl:block">
            <p className="mb-4 text-xs font-semibold text-[var(--text-subtle)]">本页目录</p>
            <DocsNavigation page={page} compact instance="toc" />
            <div className="mt-8 border-t border-[var(--line)] pt-5 text-xs leading-5 text-[var(--text-subtle)]">
              <p>版本 {SDK_VERSION}</p>
              <p className="mt-1">{tocStatus}</p>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-fill)] text-xs font-black text-[var(--on-accent)]">S</span>
            <div>
              <p className="text-sm font-bold text-[var(--text-strong)]">Shroom Developer</p>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{footerTitle} · {footerDescription}</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--text-muted)]" aria-label="页脚导航">
            <Link href="/" className="transition hover:text-[var(--accent-strong)]">展示首页</Link>
            <Link href="/sdk-overview" className="transition hover:text-[var(--accent-strong)]">SDK 功能页</Link>
            <Link href={relatedDocs.href} className="transition hover:text-[var(--accent-strong)]">{relatedDocs.label}</Link>
            <a href={skipTarget} className="transition hover:text-[var(--accent-strong)]">返回顶部</a>
            <a href={SDK_DOWNLOAD} download className="font-semibold text-[var(--accent-strong)]">下载 SDK</a>
          </nav>
          <p className="text-xs text-[var(--text-muted)]">© 2026 Shroom</p>
        </div>
      </footer>
    </>
  );
}
