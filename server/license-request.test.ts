import test from 'node:test';
import assert from 'node:assert/strict';
import { submitSdkLicenseRequest } from '../app/license-request.ts';

const application = { name: '测试', phone: '13800000000', email: 'test@example.invalid', organization: '测试机构', sdkVersion: '0.1.0' };
const endpoint = 'https://example.invalid/sdk-requests';

test('license application uses the existing backend contract and a separate source', async () => {
  const request: typeof fetch = async (url, options) => {
    assert.equal(url, endpoint);
    assert.equal(options?.method, 'POST');
    assert.deepEqual(JSON.parse(String(options?.body)), { ...application, source: 'sdk-license' });
    assert.ok(options?.signal);
    return Response.json({ ok: true, id: 123 });
  };
  await submitSdkLicenseRequest(endpoint, application, request);
});

test('license application refuses HTTP errors even if a body claims success', async () => {
  await assert.rejects(submitSdkLicenseRequest(endpoint, application,
    async () => Response.json({ ok: true }, { status: 500 })), /申请尚未提交成功/);
});

test('license application refuses rejected or malformed responses', async () => {
  for (const response of [Response.json({ ok: false }), Response.json({}), new Response('<html>proxy error</html>')]) {
    await assert.rejects(submitSdkLicenseRequest(endpoint, application, async () => response), /申请尚未提交成功/);
  }
});

test('license application reports network failures and timeouts as failed submission', async () => {
  for (const error of [new TypeError('network'), new DOMException('timeout', 'TimeoutError')]) {
    await assert.rejects(submitSdkLicenseRequest(endpoint, application, async () => { throw error; }), /检查网络后重试/);
  }
});
