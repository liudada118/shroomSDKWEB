'use client';

import Link from 'next/link';
import { FormEvent, KeyboardEvent, useEffect, useRef } from 'react';
import { SDK_VERSION } from './docs-data';
import { suggestedQuestions, useKnowledgeChat } from './components/knowledge-chat';
import KnowledgeMessage from './components/knowledge-message';

export default function KnowledgePage() {
  const { messages, input, setInput, busy, announcement, ask, stop, clear } = useKnowledgeChat();
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: messages.some((message) => message.status === 'streaming') ? 'auto' : 'smooth',
    });
  }, [messages]);

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
                onClick={clear}
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
                <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--text-muted)]">可以直接描述目标、报错或接口名称。回答会标注 [1] [2]，点击编号即可定位到检索依据，下方还会给出可跳转的文档章节。</p>
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
                  <KnowledgeMessage key={message.id} message={message} />
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
                    onClick={stop}
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
