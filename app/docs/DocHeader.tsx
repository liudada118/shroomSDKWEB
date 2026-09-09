import Link from 'next/link';

/** 文档站共用顶栏。刻意做得比首页那条轻，只保留回首页和三篇之间互跳 */
export default function DocHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#eaecf0] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Shroom Developer 首页">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#2563eb] text-sm font-black text-white shadow-[0_8px_22px_rgba(37,99,235,0.28)]">
            S
          </span>
          <span className="text-[15px] font-bold tracking-[-0.02em]">
            Shroom <span className="font-medium text-[#667085]">Developer</span>
          </span>
        </Link>

        <div className="flex items-center gap-2.5 text-sm font-medium">
          {/* 左上角那个 logo 也回首页，但没人会把它当按钮看 —— 这里给一个写着字的 */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d0d5dd] bg-white px-3 py-2 font-semibold text-[#344054] shadow-sm transition hover:border-[#84adff] hover:text-[#175cd3]"
          >
            <span aria-hidden>←</span>
            返回首页
          </Link>
          <Link href="/docs" className="hidden text-[#475467] transition hover:text-[#175cd3] sm:inline">
            文档中心
          </Link>
          <a
            href="/lab.html"
            className="hidden rounded-lg border border-[#d0d5dd] bg-white px-4 py-2 font-semibold text-[#344054] shadow-sm transition hover:border-[#84adff] hover:text-[#175cd3] sm:inline-flex"
          >
            网页测试台
          </a>
          <Link
            href="/#downloads"
            className="rounded-lg bg-[#2563eb] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#175cd3]"
          >
            获取 SDK
          </Link>
        </div>
      </div>
    </header>
  );
}
