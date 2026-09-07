import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createKnowledgeAnswerResponse,
  KnowledgeServiceError,
  normalizeRetrievalPayload,
  parseKnowledgeRequest,
} from './zhipu-knowledge.ts';

const config = {
  apiKey: 'test-api-key',
  knowledgeId: 'test-knowledge-id',
  model: 'glm-4.7-flash',
};

test('parseKnowledgeRequest validates the official 1000-character retrieval limit', () => {
  assert.equal(parseKnowledgeRequest({ question: '问'.repeat(1_000) }).question.length, 1_000);
  assert.throws(
    () => parseKnowledgeRequest({ question: '问'.repeat(1_001) }),
    (error: unknown) => error instanceof KnowledgeServiceError && error.code === 'QUESTION_TOO_LONG',
  );
  assert.throws(
    () => parseKnowledgeRequest({ question: '  ' }),
    (error: unknown) => error instanceof KnowledgeServiceError && error.code === 'QUESTION_REQUIRED',
  );
});

test('normalizeRetrievalPayload keeps distinct chunks, deduplicates sources, and rejects unsafe URLs', () => {
  const normalized = normalizeRetrievalPayload({
    code: 200,
    data: [
      {
        text: '第一段内容',
        score: 0.91,
        metadata: { doc_id: 'doc-1', doc_name: '<SDK 指南>', doc_url: 'javascript:alert(1)' },
      },
      {
        text: '第二段内容',
        score: 0.82,
        metadata: { doc_id: 'doc-1', doc_name: '<SDK 指南>', doc_url: 'javascript:alert(1)' },
      },
      {
        text: '第二段内容',
        score: 0.82,
        metadata: { doc_id: 'doc-1', doc_name: '<SDK 指南>', doc_url: 'javascript:alert(1)' },
      },
    ],
  });

  assert.equal(normalized.sources.length, 1);
  assert.equal(normalized.chunks.length, 2);
  assert.equal(normalized.sources[0].title, '<SDK 指南>');
  assert.equal(normalized.sources[0].url, undefined);
  assert.deepEqual(normalized.chunks.map((chunk) => chunk.sourceId), [1, 1]);
});

test('createKnowledgeAnswerResponse does not call the model when retrieval has no hits', async () => {
  let calls = 0;
  const fetcher = (async () => {
    calls += 1;
    return Response.json({ code: 200, data: [] });
  }) as typeof fetch;

  const response = await createKnowledgeAnswerResponse(
    { question: '不存在的问题', history: [] },
    config,
    new AbortController().signal,
    fetcher,
  );
  const body = await response.text();

  assert.equal(calls, 1);
  assert.match(response.headers.get('content-type') || '', /text\/event-stream/);
  assert.match(body, /event: sources/);
  assert.match(body, /当前知识库没有找到/);
  assert.match(body, /event: done/);
});

test('createKnowledgeAnswerResponse preserves split UTF-8 chunks and emits stable sources', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const encoder = new TextEncoder();
  const upstreamText = [
    'data: {"choices":[{"delta":{"role":"assistant","content":""},"finish_reason":null}]}\r\n\r\n',
    'data: {"choices":[{"delta":{"content":"请先运行"},"finish_reason":null}]}\r\n\r\n',
    'data: {"choices":[{"delta":{"content":" Mock [1]"},"finish_reason":null}]}\r\n\r\n',
    'data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}]}\r\n\r\n',
    'data: [DONE]\r\n\r\n',
  ].join('');
  const bytes = encoder.encode(upstreamText);
  const cutPoints = [7, 41, 83, 121, bytes.length];
  let offset = 0;
  const upstreamBody = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = cutPoints.shift();
      if (next === undefined) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, next));
      offset = next;
    },
  });

  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (calls.length === 1) {
      return Response.json({
        code: 200,
        data: [
          {
            text: '运行 node start.mjs 后可使用 Mock 数据。',
            score: 0.93,
            metadata: {
              doc_id: 'sdk-readme',
              doc_name: 'SDK README',
              doc_url: 'https://example.com/docs',
            },
          },
        ],
      });
    }
    return new Response(upstreamBody, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }) as typeof fetch;

  const response = await createKnowledgeAnswerResponse(
    { question: '如何使用 Mock？', history: [] },
    config,
    new AbortController().signal,
    fetcher,
  );
  const body = await response.text();

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /knowledge\/retrieve$/);
  assert.match(calls[1].url, /chat\/completions$/);
  assert.equal(new Headers(calls[0].init?.headers).get('authorization'), 'Bearer test-api-key');
  assert.match(body, /SDK README/);
  assert.match(body, /请先运行/);
  assert.match(body, /Mock \[1\]/);
  assert.match(body, /event: done/);
  assert.doesNotMatch(body, /test-api-key/);

  const modelRequest = JSON.parse(String(calls[1].init?.body)) as { messages: Array<{ content: string }> };
  assert.match(modelRequest.messages.at(-1)?.content || '', /\[1\] 来源：SDK README/);
});

function streamFromDeltas(deltas: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const text = [
    ...deltas.map((content) => `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] })}\n\n`),
    `data: ${JSON.stringify({ choices: [{ delta: { content: '' }, finish_reason: 'stop' }] })}\n\n`,
    'data: [DONE]\n\n',
  ].join('');

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function answerFetcher(deltas: readonly string[]): typeof fetch {
  let call = 0;
  return (async () => {
    call += 1;
    if (call === 1) {
      return Response.json({
        code: 200,
        data: [{ text: '串口会话可以调用 session.close() 主动断开。', score: 0.9, metadata: { doc_id: 'backend', doc_name: 'BACKEND' } }],
      });
    }
    return new Response(streamFromDeltas(deltas), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }) as typeof fetch;
}

function readStream(body: string): { text: string; sections: unknown } {
  let text = '';
  let sections: unknown = null;

  for (const block of body.split('\n\n')) {
    if (!block.trim()) continue;
    const event = /^event: (.+)$/m.exec(block)?.[1];
    const dataLine = /^data: (.*)$/m.exec(block)?.[1];
    if (!event || dataLine === undefined) continue;
    const data = JSON.parse(dataLine) as Record<string, unknown>;
    if (event === 'delta' && typeof data.text === 'string') text += data.text;
    if (event === 'sections') sections = data.sections;
  }

  return { text, sections };
}

test('parseKnowledgeRequest keeps a valid docs page and drops anything else', () => {
  assert.equal(parseKnowledgeRequest({ question: '在哪断开串口', page: 'backend' }).page, 'backend');
  assert.equal(parseKnowledgeRequest({ question: '在哪断开串口', page: 'marketing' }).page, undefined);
  assert.equal(parseKnowledgeRequest({ question: '在哪断开串口' }).page, undefined);
});

test('section marker never reaches the client and resolves to validated anchors', async () => {
  const response = await createKnowledgeAnswerResponse(
    { question: '怎么主动断开串口？', history: [], page: 'backend' },
    config,
    new AbortController().signal,
    // The marker is deliberately split across two deltas.
    answerFetcher(['调用 session.close() 即可。', '\n\n@@SEC', 'TIONS: serial-disconnect, not-a-section, csv, serial-disconnect, capture, storage']),
  );
  const { text, sections } = readStream(await response.text());

  assert.equal(text, '调用 session.close() 即可。');
  assert.doesNotMatch(text, /@@|SECTIONS/);
  assert.deepEqual(
    (sections as Array<{ anchor: string }>).map((section) => section.anchor),
    ['serial-disconnect', 'csv', 'capture'],
  );
  assert.deepEqual(
    (sections as Array<{ href: string; page: string }>)[0],
    { anchor: 'serial-disconnect', label: '断开与释放', href: '/docs/backend#serial-disconnect', page: 'backend' },
  );
});

test('answers without a section marker emit no sections event', async () => {
  const response = await createKnowledgeAnswerResponse(
    { question: '怎么主动断开串口？', history: [] },
    config,
    new AbortController().signal,
    answerFetcher(['调用 session.close() 即可。']),
  );
  const body = await response.text();

  assert.equal(readStream(body).text, '调用 session.close() 即可。');
  assert.doesNotMatch(body, /event: sections/);
});

test('the model is given the section catalog and the current page', async () => {
  const calls: RequestInit[] = [];
  const inner = answerFetcher(['好的。']);
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    if (init) calls.push(init);
    return inner(input as string, init);
  }) as typeof fetch;

  await createKnowledgeAnswerResponse(
    { question: '导出 CSV', history: [], page: 'backend' },
    config,
    new AbortController().signal,
    fetcher,
  );

  const modelRequest = JSON.parse(String(calls[1]?.body)) as { messages: Array<{ content: string }> };
  const systemPrompt = modelRequest.messages[0]?.content || '';
  assert.match(systemPrompt, /serial-disconnect \| 断开与释放/);
  assert.match(systemPrompt, /用户当前正在阅读「后端能力」文档页/);
  assert.match(systemPrompt, /@@SECTIONS:/);
});

test('provider rate limits map to a stable public error', async () => {
  const fetcher = (async () => Response.json(
    { code: 1302, message: 'provider details' },
    { status: 429 },
  )) as typeof fetch;

  await assert.rejects(
    () => createKnowledgeAnswerResponse(
      { question: '测试限流', history: [] },
      config,
      new AbortController().signal,
      fetcher,
    ),
    (error: unknown) => error instanceof KnowledgeServiceError
      && error.code === 'RATE_LIMITED'
      && error.status === 429
      && !error.message.includes('provider details'),
  );
});
