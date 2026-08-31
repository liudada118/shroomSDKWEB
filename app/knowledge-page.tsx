'use client';

import Link from 'next/link';
import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { SDK_VERSION } from './docs-data';

type Source = {
  id: number;
  docId?: string;
  title: string;
  url?: string;
  score?: number;
  excerpt: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  status?: 'streaming' | 'complete' | 'error';
};

type StreamEventErrorOptions = {
  reset?: boolean;
  retryable?: boolean;
};

class StreamEventError extends Error {
  readonly reset: boolean;
  readonly retryable: boolean;

  constructor(message: string, options: StreamEventErrorOptions = {}) {
    super(message);
    this.name = 'StreamEventError';
    this.reset = Boolean(options.reset);
    this.retryable = Boolean(options.retryable);
  }
}

const suggestedQuestions = [
  '没有硬件时，怎样先跑通 Mock 示例？',
  '浏览器连接设备时需要哪些参数？',
  'Backend SDK 如何采集并导出 CSV？',
  'Core Frame 包含哪些字段？',
];

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

function parseEventBlock(block: string): { event: string; data: unknown } | null {
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }

  if (!dataLines.length) return null;
  return { event, data: JSON.parse(dataLines.join('\n')) as unknown };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export default function KnowledgePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const conversationRef = useRef<HTMLDivElement>(null);

  const completedHistory = useMemo(() => messages
    .filter((message) => message.status !== 'streaming' && message.content.trim())
    .slice(-8)
    .map(({ role, content }) => ({ role, content })), [messages]);

  useEffect(() => {
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: messages.some((message) => message.status === 'streaming') ? 'auto' : 'smooth',
    });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function updateAssistant(id: string, updater: (message: ChatMessage) => ChatMessage) {
    setMessages((current) => current.map((message) => message.id === id ? updater(message) : message));
  }

  async function ask(questionValue: string) {
    const question = questionValue.trim();
    if (!question || busyRef.current) return;

    const userMessage: ChatMessage = {
      id: createMessageId('user'),
      role: 'user',
      content: question,
      status: 'complete',
    };
    const assistantId = createMessageId('assistant');
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      sources: [],
      status: 'streaming',
    };

    busyRef.current = true;
    setBusy(true);
    setInput('');
    setAnnouncement('正在检索知识库并生成回答');
    setMessages((current) => [...current, userMessage, assistantMessage]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history: completedHistory }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as unknown;
        const message = isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
          ? payload.error.message
          : '知识库问答暂时不可用，请稍后重试。';
        const retryable = isRecord(payload) && isRecord(payload.error) && payload.error.retryable === true;
        throw new StreamEventError(message, { retryable });
      }
      if (!response.body) throw new StreamEventError('没有收到回答内容，请重试。', { retryable: true });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completed = false;

      while (!completed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n');

        let boundary = buffer.indexOf('\n\n');
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');

          const parsed = parseEventBlock(block);
          if (!parsed || !isRecord(parsed.data)) continue;

          if (parsed.event === 'sources') {
            const sources = Array.isArray(parsed.data.sources) ? parsed.data.sources as Source[] : [];
            updateAssistant(assistantId, (message) => ({ ...message, sources }));
          }

          if (parsed.event === 'delta' && typeof parsed.data.text === 'string') {
            const deltaText = parsed.data.text;
            updateAssistant(assistantId, (message) => ({
              ...message,
              content: `${message.content}${deltaText}`,
            }));
          }

          if (parsed.event === 'done') {
            const truncated = parsed.data.truncated === true;
            updateAssistant(assistantId, (message) => ({
              ...message,
              content: truncated
                ? `${message.content}\n\n回答已达到长度上限，可缩小问题范围后继续提问。`
                : message.content,
              status: 'complete',
            }));
            completed = true;
            setAnnouncement('回答已完成');
            break;
          }

          if (parsed.event === 'error') {
            throw new StreamEventError(
              typeof parsed.data.message === 'string' ? parsed.data.message : '回答生成中断，请重试。',
              {
                reset: parsed.data.reset === true,
                retryable: parsed.data.retryable === true,
              },
            );
          }
        }
      }

      if (!completed) throw new StreamEventError('回答连接意外中断，请重试。', { retryable: true });
    } catch (error) {
      if (controller.signal.aborted) {
        updateAssistant(assistantId, (message) => ({
          ...message,
          content: message.content || '已停止生成。',
          status: 'complete',
        }));
        setAnnouncement('已停止生成');
      } else {
        const known = error instanceof StreamEventError
          ? error
          : new StreamEventError('知识库问答暂时不可用，请稍后重试。', { retryable: true });
        updateAssistant(assistantId, (message) => ({
          ...message,
          content: known.reset || !message.content
            ? known.message
            : `${message.content}\n\n${known.message}`,
          status: 'error',
        }));
        if (known.retryable) setInput(question);
        setAnnouncement(known.message);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      busyRef.current = false;
      setBusy(false);
    }
  }

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

  function clearConversation() {
    if (busy) return;
    setMessages([]);
    setInput('');
    setAnnouncement('对话已清空');
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--page)] text-[var(--text)]">
      <a className="skip-link" href="#knowledge-chat">跳到知识问答</a>

      <header className="fixed inset-x-0 top-0 z-40 border-b border-[var(--line)] bg-[var(--header)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="返回 Shroom Developer 首页">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-fill)] text-sm font-black text-[var(--on-accent)] shadow-[0_8px_22px_rgba(37,99,235,0.28)]">S</span>
            <span className="text-[15px] font-bold tracking-[-0.02em] text-[var(--text-strong)]">
              Shroom <span className="font-medium text-[var(--text-muted)]">Developer</span>
            </span>
            <span className="hidden h-4 w-px bg-[var(--line)] sm:block" aria-hidden="true" />
            <span className="hidden text-xs font-semibold text-[var(--text-muted)] sm:inline">AI 问答</span>
          </Link>

          <nav className="flex items-center gap-1" aria-label="知识问答导航">
            <Link href="/docs" className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--accent-strong)]">
              文档中心
            </Link>
            <Link href="/sdk-overview" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--accent-strong)] sm:inline-flex">
              SDK 功能
            </Link>
          </nav>
        </div>
      </header>

      <div className="relative mx-auto grid min-h-[100dvh] max-w-7xl gap-6 px-5 pb-8 pt-[96px] sm:px-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-10 lg:pb-10 lg:pt-[104px]">
        <div className="hero-grid pointer-events-none absolute inset-x-0 top-[72px] h-[360px] opacity-60" />
        <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[520px] w-[860px] -translate-x-1/2 rounded-full bg-[#e9f2ff] blur-3xl" />

        <aside className="relative hidden self-start lg:block">
          <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--accent-strong)]">SHROOM KNOWLEDGE</p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] text-[var(--text-strong)]">从文档里，直接找到答案。</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">智谱先检索当前 SDK 知识库，再由 GLM 组织回答，并保留命中文档作为依据。</p>

          <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_12px_34px_rgba(16,24,40,0.05)]">
            <p className="text-xs font-semibold text-[var(--text-strong)]">回答范围</p>
            <ul className="mt-4 space-y-3 text-sm text-[var(--text-muted)]">
              {['安装与快速开始', 'Web / Node SDK API', 'Backend 串口与采集', 'Frame、回放与 CSV'].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-[var(--line)] pt-4 font-mono text-[10px] leading-5 text-[var(--text-subtle)]">
              SDK VERSION<br />{SDK_VERSION}
            </div>
          </div>

          <p className="mt-5 text-xs leading-6 text-[var(--text-subtle)]">回答不会使用站外知识补全。重要实现请以对应版本的原始文档为准。</p>
        </aside>

        <section
          id="knowledge-chat"
          aria-labelledby="chat-title"
          className="relative flex min-h-[calc(100dvh-128px)] min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_22px_60px_rgba(16,24,40,0.10)]"
        >
          <div className="flex min-h-[72px] items-center justify-between gap-4 border-b border-[var(--line)] px-5 sm:px-6">
            <div>
              <div className="flex items-center gap-2">
                <h2 id="chat-title" className="font-semibold tracking-[-0.02em] text-[var(--text-strong)]">问 Shroom Docs</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ecfdf3] px-2 py-1 text-[10px] font-semibold text-[#067647]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#12b76a]" aria-hidden="true" /> 智谱 GLM
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">检索知识库后回答，并展示命中文档</p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearConversation}
                disabled={busy}
                className="min-h-10 rounded-lg px-3 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                清空对话
              </button>
            )}
          </div>

          <div
            ref={conversationRef}
            role="log"
            aria-label="知识问答记录"
            aria-busy={busy}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6 sm:py-8"
          >
            {messages.length === 0 ? (
              <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center py-8">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-fill)] text-sm font-bold text-white shadow-[0_10px_26px_rgba(37,99,235,0.24)]">AI</div>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.035em] text-[var(--text-strong)]">今天想查哪项 SDK 能力？</h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--text-muted)]">可以直接描述目标、报错或接口名称。回答会标注 [1] [2]，点击编号即可定位到检索依据。</p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => void ask(question)}
                      className="min-h-[72px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left text-sm font-medium leading-6 text-[var(--text-strong)] transition hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]"
                    >
                      {question}<span className="ml-2 text-[var(--accent-strong)]" aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto space-y-7 max-w-3xl">
                {messages.map((message) => (
                  <article key={message.id} className={`flex gap-3 sm:gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.role === 'assistant' && (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-fill)] text-[10px] font-bold text-white">AI</span>
                    )}
                    <div className={message.role === 'user' ? 'max-w-[86%] sm:max-w-[74%]' : 'min-w-0 max-w-[calc(100%-44px)] flex-1'}>
                      <div className={message.role === 'user'
                        ? 'rounded-2xl rounded-br-md bg-[#101828] px-4 py-3 text-sm leading-7 text-white'
                        : `rounded-2xl rounded-tl-md border px-4 py-4 text-sm leading-7 sm:px-5 ${message.status === 'error' ? 'border-[#fecdca] bg-[#fffbfa] text-[#912018]' : 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-strong)]'}`}
                      >
                        {message.role === 'assistant' && message.status === 'streaming' && !message.content ? (
                          <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                            正在检索并整理答案…
                          </span>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{message.role === 'assistant' ? renderAnswerWithCitations(message) : message.content}</p>
                        )}
                      </div>

                      {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-[11px] font-semibold text-[var(--text-subtle)]">检索依据</p>
                          <ol className="grid gap-2 sm:grid-cols-2">
                            {message.sources.map((source) => (
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
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--line)] bg-white p-4 sm:p-5">
            <form onSubmit={submit} className="mx-auto max-w-3xl">
              <label htmlFor="knowledge-question" className="sr-only">输入知识库问题</label>
              <div className="flex items-end gap-2 rounded-xl border border-[#d0d5dd] bg-white p-2 shadow-sm focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent-soft)]">
                <textarea
                  id="knowledge-question"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  maxLength={1_000}
                  rows={1}
                  disabled={busy}
                  placeholder="例如：如何订阅 Frame 并渲染热力图？"
                  className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm leading-6 text-[var(--text-strong)] outline-none placeholder:text-[var(--text-subtle)] disabled:cursor-not-allowed"
                />
                {busy ? (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="min-h-11 shrink-0 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold text-[var(--text-strong)] transition hover:bg-[var(--surface-muted)]"
                  >
                    停止
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="min-h-11 shrink-0 rounded-lg bg-[var(--accent-fill)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-fill-hover)] disabled:cursor-not-allowed disabled:bg-[#98a2b3]"
                  >
                    发送
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[10px] text-[var(--text-subtle)]">
                <span>Enter 发送 · Shift + Enter 换行</span>
                <span>{Array.from(input).length}/1000</span>
              </div>
            </form>
          </div>
        </section>
      </div>

      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </main>
  );
}
