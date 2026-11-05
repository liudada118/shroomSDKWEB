'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ChatMessage } from './knowledge-chat';
import { jumpToSection, pageForPathname } from './knowledge-jump';

/**
 * 回答下方不再展示检索依据，正文里残留的来源编号（模型偶尔仍会输出、会话里也存着旧回答）一并去掉。
 * 只去掉对得上来源的编号，代码块和行内代码里的 arr[1] 原样保留；未闭合的代码块按代码处理。
 */
function stripCitations(message: ChatMessage): string {
  const sourceIds = new Set((message.sources || []).map((source) => source.id));
  if (!sourceIds.size) return message.content;
  return message.content
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g)
    .map((part, index) => index % 2 === 1
      ? part
      : part.replace(/ ?\[(\d+)\]/g, (marker, id: string) => sourceIds.has(Number(id)) ? '' : marker))
    .join('');
}

function SectionJumps({
  message,
  onJump,
}: {
  message: ChatMessage;
  onJump?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const currentPage = pageForPathname(pathname);
  const sections = message.sections || [];
  if (!sections.length) return null;

  return (
    <div className="mt-3">
      <p className="mb-2 text-[11px] font-semibold text-[var(--text-subtle)]">跳转到文档章节</p>
      <div className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            key={`${message.id}-${section.anchor}`}
            type="button"
            onClick={() => {
              jumpToSection(section, currentPage, (href) => router.push(href));
              onJump?.();
            }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-white"
          >
            <span aria-hidden="true">↳</span>
            <span>{section.label}</span>
            {section.page !== currentPage && (
              <span className="font-normal text-[var(--text-muted)]">
                {section.page === 'python' ? 'Python 文档' : 'SDK 文档'}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function KnowledgeMessage({
  message,
  compact = false,
  onJump,
}: {
  message: ChatMessage;
  compact?: boolean;
  onJump?: () => void;
}) {
  return (
    <article className={`flex gap-3 sm:gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      {message.role === 'assistant' && (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-fill)] text-[10px] font-bold text-white">AI</span>
      )}
      <div className={message.role === 'user' ? 'max-w-[86%] sm:max-w-[74%]' : 'min-w-0 max-w-[calc(100%-44px)] flex-1'}>
        <div className={message.role === 'user'
          ? 'rounded-2xl rounded-br-md bg-[#101828] px-4 py-3 text-sm leading-7 text-white'
          : `rounded-2xl rounded-tl-md border px-4 py-4 text-sm leading-7 ${compact ? '' : 'sm:px-5'} ${message.status === 'error' ? 'border-[#fecdca] bg-[#fffbfa] text-[#912018]' : 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-strong)]'}`}
        >
          {message.role === 'assistant' && message.status === 'streaming' && !message.content ? (
            <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
              正在检索并整理答案…
            </span>
          ) : (
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
              {message.role === 'assistant' ? stripCitations(message) : message.content}
            </p>
          )}
        </div>

        {message.role === 'assistant' && <SectionJumps message={message} onJump={onJump} />}
      </div>
    </article>
  );
}
