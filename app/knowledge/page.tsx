'use client';

import { useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { suggestedQuestions, useKnowledgeChat } from '../components/knowledge-chat';
import KnowledgeMessage from '../components/knowledge-message';

export default function KnowledgePage() {
  const { messages, input, setInput, busy, announcement, ask, stop, clear } = useKnowledgeChat();
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: 'auto' });
  }, [messages]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void ask(input);
    }
  }

  return (
    <div className="knowledge-ui mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12 lg:px-10">
      <p className="text-sm font-semibold text-[#2563eb]">AI 知识问答</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">从 SDK 文档里，找到答案。</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-[#667085]">智谱检索你配置的知识库后生成回答，并展示检索依据。可询问 Python、Node.js 或浏览器接入；回答范围取决于已上传的资料，请以当前版本文档为准。</p>

      <section aria-label="SDK 知识问答" className="mt-8 flex h-[min(760px,78dvh)] min-h-[480px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-sm">
        <div className="flex min-h-16 items-center justify-between gap-3 border-b border-[#e4e7ec] px-4 sm:px-6">
          <div><h2 className="font-semibold">问 Shroom Docs</h2><p className="mt-1 text-xs text-[#667085]">智谱 GLM · 文档检索与来源引用</p></div>
          {messages.length > 0 && <button type="button" disabled={busy} onClick={clear} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-[#475467] hover:bg-[#f2f4f7] disabled:opacity-40">清空对话</button>}
        </div>
        <div ref={conversationRef} role="log" aria-label="知识问答记录" aria-busy={busy} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-3xl py-4 sm:py-8">
              <h3 className="text-xl font-semibold">今天想查哪项 SDK 能力？</h3>
              <p className="mt-3 text-sm leading-7 text-[#667085]">描述你的开发语言、设备型号和目标，也可以粘贴报错。不要发送密钥或其他敏感信息。</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {suggestedQuestions.map((question) => <button key={question} type="button" onClick={() => void ask(question)} className="min-h-[72px] rounded-xl border border-[#d0d5dd] px-4 py-3 text-left text-sm leading-6 transition-colors hover:border-[#84adff] hover:bg-[#eff4ff]">{question}<span aria-hidden="true" className="ml-2 text-[#2563eb]">→</span></button>)}
              </div>
              <Link href="/docs/python" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-[#175cd3] hover:underline">查看 Python 接入指南 →</Link>
            </div>
          ) : <div className="mx-auto max-w-3xl space-y-6">{messages.map((message) => <KnowledgeMessage key={message.id} message={message} />)}</div>}
        </div>
        <form onSubmit={submit} className="border-t border-[#e4e7ec] p-4 sm:p-5">
          <label htmlFor="knowledge-question" className="mb-2 block text-xs font-semibold text-[#475467]">你的问题</label>
          <div className="flex items-end gap-2 rounded-xl border border-[#d0d5dd] p-2 focus-within:border-[#84adff] focus-within:ring-4 focus-within:ring-[#eff4ff]">
            <textarea id="knowledge-question" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKey} disabled={busy} maxLength={1000} rows={2} placeholder="例如：Python SDK 如何连接串口？" className="min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-base leading-6 outline-none disabled:opacity-60" />
            {busy ? <button type="button" onClick={stop} className="min-h-11 shrink-0 rounded-lg border border-[#d0d5dd] px-4 text-sm font-semibold hover:bg-[#f2f4f7]">停止</button> : <button type="submit" disabled={!input.trim()} className="min-h-11 shrink-0 rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white hover:bg-[#175cd3] disabled:cursor-not-allowed disabled:opacity-40">发送</button>}
          </div>
          <p className="mt-2 flex justify-between gap-2 text-xs text-[#667085]"><span>Enter 发送 · Shift + Enter 换行</span><span>{Array.from(input).length}/1000</span></p>
        </form>
      </section>
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </div>
  );
}
