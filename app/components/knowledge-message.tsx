'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { ChatMessage } from './knowledge-chat';
import { jumpToSection, pageForPathname } from './knowledge-jump';

function renderAnswerWithCitations(message: ChatMessage): ReactNode[] {
  const sources = new Map((message.sources || []).map((source) => [source.id, source]));
  return message.content.split(/(\[\d+\])/g).map((part, index) => {
    const match = /^\[(\d+)\]$/.exec(part);
    if (!match) return part;
    const sourceId = Number(match[1]);
    if (!sources.has(sourceId)) return part;

    return (
      <a
        key={`${part}-${index}`}
        href={`#source-${message.id}-${sourceId}`}
        aria-label={`查看来源 ${sourceId}`}
        className="mx-0.5 inline-flex rounded bg-[var(--accent-soft)] px-1 font-mono text-[0.78em] font-semibold text-[var(--accent-strong)] underline-offset-2 hover:underline"
      >
        {part}
      </a>
    );
  });
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
                {section.page === 'backend' ? '后端文档' : 'SDK 文档'}
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
  const sources = message.sources || [];

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
            <p className="whitespace-pre-wrap break-words">
              {message.role === 'assistant' ? renderAnswerWithCitations(message) : message.content}
            </p>
          )}
        </div>

        {message.role === 'assistant' && <SectionJumps message={message} onJump={onJump} />}

        {message.role === 'assistant' && sources.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-[11px] font-semibold text-[var(--text-subtle)]">检索依据</p>
            <ol className={`grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
              {sources.map((source) => (
                <li key={`${message.id}-${source.id}`} id={`source-${message.id}-${source.id}`} className="scroll-mt-24">
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block h-full rounded-xl border border-[var(--line)] bg-white p-3 transition hover:border-[var(--accent-border)] hover:shadow-sm"
                    >
                      <span className="flex items-center gap-2 text-xs font-semibold text-[var(--text-strong)]">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-[var(--accent-soft)] font-mono text-[9px] text-[var(--accent-strong)]">{source.id}</span>
                        <span className="truncate">{source.title}</span>
                        <span className="ml-auto text-[var(--accent-strong)]" aria-hidden="true">↗</span>
                      </span>
                      <span className="mt-2 line-clamp-2 block text-[11px] leading-5 text-[var(--text-muted)]">{source.excerpt}</span>
                    </a>
                  ) : (
                    <div className="h-full rounded-xl border border-[var(--line)] bg-white p-3">
                      <span className="flex items-center gap-2 text-xs font-semibold text-[var(--text-strong)]">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-[var(--accent-soft)] font-mono text-[9px] text-[var(--accent-strong)]">{source.id}</span>
                        <span className="truncate">{source.title}</span>
                      </span>
                      <span className="mt-2 line-clamp-2 block text-[11px] leading-5 text-[var(--text-muted)]">{source.excerpt}</span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </article>
  );
}
