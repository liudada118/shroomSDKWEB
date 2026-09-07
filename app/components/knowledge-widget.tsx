'use client';

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { suggestedQuestions, useKnowledgeChat, type ChatMessage } from './knowledge-chat';
import { pageForPathname } from './knowledge-jump';
import KnowledgeMessage from './knowledge-message';

const STORAGE_KEY = 'shroom-knowledge-widget';
const MAX_STORED_MESSAGES = 20;

type StoredState = {
  open: boolean;
  messages: ChatMessage[];
};

function readStoredState(): StoredState {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { open: false, messages: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return { open: false, messages: [] };

    const { open, messages } = parsed as Partial<StoredState>;
    return {
      open: open === true,
      messages: Array.isArray(messages)
        ? messages
          .filter((message): message is ChatMessage => Boolean(message) && typeof message.content === 'string')
          .slice(-MAX_STORED_MESSAGES)
          .map((message) => ({ ...message, status: message.status === 'streaming' ? 'complete' : message.status }))
        : [],
    };
  } catch {
    return { open: false, messages: [] };
  }
}

function writeStoredState(state: StoredState): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      open: state.open,
      messages: state.messages.slice(-MAX_STORED_MESSAGES),
    }));
  } catch {
    // Storage may be unavailable; the widget still works for this page view.
  }
}

/** Session storage is client-only, so the stored state is read once after hydration. */
const subscribeToNothing = () => () => {};

export default function KnowledgeWidget() {
  const pathname = usePathname();
  const storedRef = useRef<StoredState | null>(null);
  const getStored = useCallback(() => {
    if (!storedRef.current) storedRef.current = readStoredState();
    return storedRef.current;
  }, []);
  const initial = useSyncExternalStore<StoredState | null>(subscribeToNothing, getStored, () => null);

  // The dedicated /knowledge page already is the full conversation.
  if (pathname === '/knowledge' || !initial) return null;

  return <KnowledgeWidgetPanel key="knowledge-widget" initial={initial} pathname={pathname} />;
}

function KnowledgeWidgetPanel({ initial, pathname }: { initial: StoredState; pathname: string }) {
  const page = pageForPathname(pathname);
  const [open, setOpen] = useState(initial.open);
  const { messages, input, setInput, busy, announcement, ask, stop, clear } = useKnowledgeChat({
    page,
    initialMessages: initial.messages,
  });
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    writeStoredState({ open, messages });
  }, [open, messages]);

  useEffect(() => {
    if (!open) return;
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: messages.some((message) => message.status === 'streaming') ? 'auto' : 'smooth',
    });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      launcherRef.current?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void ask(input);
    }
  }

  function handleJump() {
    // On phones the sheet covers the whole page, so it has to get out of the way.
    if (window.matchMedia('(max-width: 639px)').matches) setOpen(false);
  }

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        aria-expanded={open}
        aria-controls="knowledge-widget-panel"
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-5 right-5 z-50 inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--accent-fill)] px-4 text-sm font-semibold text-[var(--on-accent)] shadow-[0_14px_34px_rgba(37,99,235,0.34)] transition hover:bg-[var(--accent-fill-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:bottom-6 sm:right-6"
      >
        <span aria-hidden="true">{open ? '×' : 'AI'}</span>
        <span>{open ? '收起' : '问文档'}</span>
      </button>

      {open && (
        <section
          id="knowledge-widget-panel"
          role="dialog"
          aria-label="Shroom 文档 AI 问答"
          className="fixed inset-0 z-50 flex flex-col border-[var(--line)] bg-[var(--surface)] sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(640px,78dvh)] sm:w-[400px] sm:rounded-2xl sm:border sm:shadow-[0_26px_70px_rgba(16,24,40,0.22)]"
        >
          <div className="flex min-h-[60px] items-center justify-between gap-3 border-b border-[var(--line)] px-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-strong)]">问 Shroom Docs</p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">检索文档后回答，并给出章节跳转</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clear}
                  disabled={busy}
                  className="min-h-9 rounded-lg px-2 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  清空
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  launcherRef.current?.focus();
                }}
                className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]"
                aria-label="关闭 AI 问答"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </div>

          <div
            ref={conversationRef}
            role="log"
            aria-label="知识问答记录"
            aria-busy={busy}
            className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5"
          >
            {messages.length === 0 ? (
              <div>
                <p className="text-sm font-semibold text-[var(--text-strong)]">想找文档里的哪一段？</p>
                <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">
                  直接描述目标、报错或接口名称。回答下方会给出可以直接跳转的文档章节。
                </p>
                <div className="mt-4 grid gap-2">
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => void ask(question)}
                      className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-left text-xs font-medium leading-5 text-[var(--text-strong)] transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]"
                    >
                      {question}
                    </button>
                  ))}
                </div>
                <Link
                  href="/knowledge"
                  className="mt-4 inline-flex text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                >
                  打开完整问答页 →
                </Link>
              </div>
            ) : (
              messages.map((message) => (
                <KnowledgeMessage key={message.id} message={message} compact onJump={handleJump} />
              ))
            )}
          </div>

          <div className="border-t border-[var(--line)] bg-white p-3">
            <form onSubmit={submit}>
              <label htmlFor="knowledge-widget-question" className="sr-only">输入知识库问题</label>
              <div className="flex items-end gap-2 rounded-xl border border-[#d0d5dd] bg-white p-1.5 focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent-soft)]">
                <textarea
                  ref={inputRef}
                  id="knowledge-widget-question"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  maxLength={1_000}
                  rows={1}
                  disabled={busy}
                  placeholder="例如：怎么导出 CSV？"
                  className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-[var(--text-strong)] outline-none placeholder:text-[var(--text-subtle)] disabled:cursor-not-allowed"
                />
                {busy ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="min-h-10 shrink-0 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[var(--text-strong)] transition hover:bg-[var(--surface-muted)]"
                  >
                    停止
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="min-h-10 shrink-0 rounded-lg bg-[var(--accent-fill)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--accent-fill-hover)] disabled:cursor-not-allowed disabled:bg-[#98a2b3]"
                  >
                    发送
                  </button>
                )}
              </div>
            </form>
          </div>

          <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
        </section>
      )}
    </>
  );
}
