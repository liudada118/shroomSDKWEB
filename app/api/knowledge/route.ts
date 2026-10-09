import {
  createKnowledgeAnswerResponse,
  KnowledgeServiceError,
  parseKnowledgeRequest,
} from '../../../server/zhipu-knowledge.ts';

export const dynamic = 'force-dynamic';

async function readJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new KnowledgeServiceError('INVALID_JSON', 400, '请求内容必须是有效的 JSON。');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64 * 1024) {
        void reader.cancel().catch(() => {});
        throw new KnowledgeServiceError('REQUEST_TOO_LARGE', 413, '请求内容过大。');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new KnowledgeServiceError('INVALID_JSON', 400, '请求内容必须是有效的 JSON。'); }
}

function jsonError(error: KnowledgeServiceError): Response {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    },
    {
      status: error.status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return jsonError(new KnowledgeServiceError('FORBIDDEN_ORIGIN', 403, '不允许跨站调用此接口。'));
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return jsonError(new KnowledgeServiceError('REQUEST_TOO_LARGE', 413, '请求内容过大。'));
  }

  const apiKey = process.env.ZAI_API_KEY?.trim();
  const knowledgeId = process.env.ZHIPU_KNOWLEDGE_ID?.trim();
  const model = process.env.ZHIPU_MODEL?.trim() || 'glm-4.7-flash';

  if (!apiKey || !knowledgeId) {
    return jsonError(new KnowledgeServiceError(
      'KNOWLEDGE_NOT_CONFIGURED',
      503,
      '知识库问答正在配置中，请稍后再试。',
      true,
    ));
  }

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]);
  try {
    const body = await readJson(request);

    const input = parseKnowledgeRequest(body);
    return await createKnowledgeAnswerResponse(
      input,
      { apiKey, knowledgeId, model },
      signal,
    );
  } catch (error) {
    if (error instanceof KnowledgeServiceError) return jsonError(error);
    if (request.signal.aborted) {
      return jsonError(new KnowledgeServiceError('REQUEST_CANCELLED', 499, '请求已取消。'));
    }
    if (signal.aborted) return jsonError(new KnowledgeServiceError('PROVIDER_TIMEOUT', 504, '知识库响应超时，请稍后重试。', true));
    console.error('[knowledge-api] Unexpected failure', error instanceof Error ? error.message : error);
    return jsonError(new KnowledgeServiceError(
      'INTERNAL_ERROR',
      500,
      '知识库问答暂时不可用，请稍后再试。',
      true,
    ));
  }
}
