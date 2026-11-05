export type SdkLicenseApplication = {
  name: string;
  phone: string;
  email: string;
  organization: string;
  sdkVersion?: string;
};

/** 申请必须由后台确认保存；HTTP/业务失败不能当成已收到申请。 */
export async function submitSdkLicenseRequest(
  endpoint: string,
  application: SdkLicenseApplication,
  request: typeof fetch = fetch,
): Promise<void> {
  let response: Response;
  try {
    response = await request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ ...application, source: 'sdk-license' }),
    });
  } catch (error) {
    throw new Error('申请尚未提交成功。请检查网络后重试，已填写的信息会保留。', { cause: error });
  }
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== 'object' || !('ok' in result) || result.ok !== true) {
    throw new Error('申请尚未提交成功。服务暂不可用，请稍后重试。');
  }
}
