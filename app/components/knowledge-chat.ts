'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { rankDocSections, type DocSectionRef, type DocsPageId } from '../docs-data';

export type Source = {
  id: number;
  docId?: string;
  title: string;
  url?: string;
  score?: number;
  excerpt: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  sections?: DocSectionRef[];
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

export const suggestedQuestions = [
  '没有硬件时，怎样先跑通 Mock 示例？',
  '浏览器连接设备时需要哪些参数？',
  'Backend SDK 如何采集并导出 CSV？',
  'Core Frame 包含哪些字段？',
];

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function isSectionRef(value: unknown): value is DocSectionRef {
  return isRecord(value)
    && typeof value.anchor === 'string'
    && typeof value.label === 'string'
    && typeof value.href === 'string'
    && (value.page === 'sdk' || value.page === 'backend');
}

/** Keyword fallback for when the model does not name any section itself. */
function fallbackSections(question: string, sources: Source[] = []): DocSectionRef[] {
  const text = [question, ...sources.map((source) => source.title)].join(' ');
  return rankDocSections(text).map((entry) => ({
    anchor: entry.anchor,
    label: entry.label,
    href: entry.href,
    page: entry.page,
  }));
}

export function useKnowledgeChat({
  page,
  initialMessages,
}: {
  page?: DocsPageId;
  initialMessages?: ChatMessage[];
} = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  const completedHistory = useMemo(() => messages
    .filter((message) => message.status !== 'streaming' && message.content.trim())
    .slice(-8)
    .map(({ role, content }) => ({ role, content })), [messages]);

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
        body: JSON.stringify({ question, history: completedHistory, ...(page ? { page } : {}) }),
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

          if (parsed.event === 'sections') {
            const sections = Array.isArray(parsed.data.sections)
              ? parsed.data.sections.filter(isSectionRef)
              : [];
            if (sections.length) updateAssistant(assistantId, (message) => ({ ...message, sections }));
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
              sections: message.sections?.length
                ? message.sections
                : fallbackSections(question, message.sources),
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

  function stop() {
    abortRef.current?.abort();
  }

  function clear() {
    if (busyRef.current) return;
    setMessages([]);
    setInput('');
    setAnnouncement('对话已清空');
  }

  return { messages, input, setInput, busy, announcement, ask, stop, clear };
}
