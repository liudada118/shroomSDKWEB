import {
  createKnowledgeAnswerResponse,
  KnowledgeServiceError,
  parseKnowledgeRequest,
} from '@/server/zhipu-knowledge';

export const dynamic = 'force-dynamic';

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

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new KnowledgeServiceError('INVALID_JSON', 400, '请求内容必须是有效的 JSON。');
    }

    const input = parseKnowledgeRequest(body);
    return await createKnowledgeAnswerResponse(
      input,
      { apiKey, knowledgeId, model },
      request.signal,
    );
  } catch (error) {
    if (error instanceof KnowledgeServiceError) return jsonError(error);
    if (request.signal.aborted) {
      return jsonError(new KnowledgeServiceError('REQUEST_CANCELLED', 499, '请求已取消。'));
    }
    console.error('[knowledge-api] Unexpected failure', error instanceof Error ? error.message : error);
    return jsonError(new KnowledgeServiceError(
      'INTERNAL_ERROR',
      500,
      '知识库问答暂时不可用，请稍后再试。',
      true,
    ));
  }
}
