'use client';

import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { SDK_VARIANTS, type DownloadTarget } from './downloads';

// 只登记下载线索，不是付费鉴权；所有页面复用同一流程。
const SDK_REGISTRY_URL = process.env.NEXT_PUBLIC_SDK_REGISTRY_URL ?? 'https://shroom.jq-industries.com/sdk-requests';
const REGISTERED_KEY = 'shroom-sdk-registered';
const DownloadContext = createContext<((target: DownloadTarget) => void) | null>(null);

// 国内手机号：1 开头，第二位 3~9，共 11 位。
// 只挡明显填错的（位数不对、乱敲数字），不做真实性校验——那要发短信，见 todo。
const PHONE_RE = /^1[3-9][0-9]{9}$/;

// 邮箱只看一眼有没有 @ 和域名，不搞 RFC 那套长正则——
// 那玩意儿误杀正常地址比拦住错地址还多，反正真假得靠发信才知道
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 自动填充可能塞进来「+86 138-0000-0000」：先剃掉所有非数字，再剃掉 86 国家码
function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 13 && digits.startsWith('86') ? digits.slice(2) : digits;
}

// 登记弹窗的报错。浏览器原生那个气泡样式改不了、跟着系统走，所以表单上挂了 noValidate，
// 校验自己做，错在哪就在哪个框下面显示一行。
type GateErrors = { name?: string; phone?: string; email?: string; organization?: string };

const FIELD_BASE =
  'h-11 rounded-lg border px-3.5 text-base font-normal outline-none transition placeholder:text-[#98a2b3]';
const FIELD_OK = 'border-[#d0d5dd] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]';
const FIELD_BAD = 'border-[#fda29b] focus:border-[#f04438] focus:ring-4 focus:ring-[#fee4e2]';

function fieldClass(invalid?: string) {
  return `${FIELD_BASE} ${invalid ? FIELD_BAD : FIELD_OK}`;
}

/** 输入框下面那行红字。没错就什么都不渲染，不占位（外层是 grid gap，空节点也会撑开间距） */
function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <span id={id} role="alert" className="flex items-center gap-1.5 text-xs font-medium text-[#d92d20]">
      <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 shrink-0 fill-current">
        <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm-.75 3.25h1.5v4.5h-1.5v-4.5Zm0 5.75h1.5v1.5h-1.5v-1.5Z" />
      </svg>
      {text}
    </span>
  );
}

export function useDownload() {
  const openDownload = useContext(DownloadContext);
  if (!openDownload) throw new Error('useDownload requires DownloadProvider');
  return openDownload;
}

export default function DownloadProvider({ children }: { children: ReactNode }) {
  const [gateOpen, setGateOpen] = useState(false);
  const [gateTarget, setGateTarget] = useState<DownloadTarget>(SDK_VARIANTS[0]);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [gateErrors, setGateErrors] = useState<GateErrors>({});

  // 原生模态框隔离背景、约束键盘焦点，并在关闭后还原触发按钮焦点。
  useEffect(() => {
    if (!gateOpen) return;
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      const trigger = triggerRef.current;
      window.requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }); });
    };
  }, [gateOpen]);

  useEffect(() => {
    if (gateOpen) dialogRef.current?.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
  }, [gateOpen]);

  // 程序化触发下载：造一个隐藏的 <a download> 点一下。
  // 不用 location.href，那样在部分浏览器里会先跳走再回来，页面闪一下
  function startDownload(target: DownloadTarget) {
    const a = document.createElement('a');
    a.href = target.url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function openGate(target: DownloadTarget) {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setGateTarget(target);
    // 上次没填完就关掉的，这次重新打开是干净的
    setGateErrors({});
    // 填过一次的老用户直接放行，别每次下载都问一遍
    try {
      if (window.localStorage.getItem(REGISTERED_KEY)) {
        setGateOpen(false);
        startDownload(target);
        return;
      }
    } catch {
      // 隐私模式下 localStorage 会抛错，那就当没填过，弹一次也无妨
    }
    setGateOpen(true);
  }

  async function submitGate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);

    const name = String(fd.get('name') ?? '').trim();
    const phone = normalizePhone(String(fd.get('phone') ?? ''));
    const email = String(fd.get('email') ?? '').trim();
    const organization = String(fd.get('organization') ?? '').trim();

    const errors: GateErrors = {};
    if (!name) errors.name = '请填写您的姓名';
    if (!phone) errors.phone = '请填写手机号';
    else if (!PHONE_RE.test(phone)) errors.phone = '请填写正确的手机号';
    if (!email) errors.email = '请填写邮箱';
    else if (!EMAIL_RE.test(email)) errors.email = '请填写正确的邮箱地址';
    if (!organization) errors.organization = '请填写所在公司 / 学校 / 机构';

    // 光标停到第一个出错的框上，用户不用自己找
    const firstBad = (['name', 'phone', 'email', 'organization'] as const).find((k) => errors[k]);
    if (firstBad) {
      setGateErrors(errors);
      form.querySelector<HTMLInputElement>(`[name="${firstBad}"]`)?.focus();
      return;
    }
    setGateErrors({});

    setSubmitting(true);
    try {
      await fetch(SDK_REGISTRY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 登记接口要是卡住（网络不通、服务没起来），按钮会一直停在「下载中…」，
        // 用户以为在排队审批。给 8 秒上限，超时就当登记失败，直接放行下载
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          name,
          phone,
          email,
          organization,
          source: gateTarget.source,
          sdkVersion: gateTarget.sdkVersion,
        }),
      });
    } catch {
      // 登记失败不挡下载——这本来就不是审批，密钥系统挂了也不能让人拿不到 SDK
    }
    try {
      window.localStorage.setItem(REGISTERED_KEY, '1');
    } catch {
      // 同上，存不下就下次再填一遍
    }
    setSubmitting(false);
    setGateOpen(false);
    startDownload(gateTarget);
  }


  return (
    <DownloadContext.Provider value={openGate}>
      {children}
      {/* 获取 SDK 前的登记弹窗。不是审批：提交完当场就开始下载，登记失败也照下不误 */}
      {gateOpen && (
        <dialog
          ref={dialogRef}
          className="sdk-download-dialog fixed m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-0 text-[#101828] shadow-2xl backdrop:bg-[#101828]/60 backdrop:backdrop-blur-sm"
          aria-modal="true"
          aria-labelledby="sdk-gate-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!submitting) setGateOpen(false);
          }}
          onClick={(e) => {
            // 只有点在遮罩本身（不是卡片）上才关
            if (e.target === e.currentTarget && !submitting) setGateOpen(false);
          }}
        >
          <div className="relative p-6 sm:p-8">
            <button
              type="button"
              aria-label="关闭"
              disabled={submitting}
              onClick={() => setGateOpen(false)}
              className="absolute right-3 top-3 grid h-11 w-11 cursor-pointer place-items-center rounded-lg text-xl text-[#667085] transition hover:bg-[#f2f4f7] hover:text-[#344054] disabled:opacity-40"
            >
              ×
            </button>

            <form noValidate onSubmit={submitGate} onChange={(event) => {
              setDraft(Object.fromEntries(Array.from(new FormData(event.currentTarget), ([key, value]) => [key, String(value)])));
            }}>
            <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-[#2563eb]">
              {gateTarget.source === 'desktop-win' ? 'DESKTOP DOWNLOAD' : 'SDK DOWNLOAD'}
            </p>
            <h2 id="sdk-gate-title" className="mt-2 pr-8 text-xl font-semibold">{gateTarget.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#667085]">{gateTarget.subtitle}</p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-xs font-semibold text-[#344054]">
                姓名（必填）
                <input data-initial-focus name="name" defaultValue={draft.name} autoComplete="name" placeholder="怎么称呼你" aria-invalid={!!gateErrors.name} aria-describedby={gateErrors.name ? 'gate-err-name' : undefined} className={fieldClass(gateErrors.name)} />
                <FieldError id="gate-err-name" text={gateErrors.name} />
              </label>
              <label className="grid gap-2 text-xs font-semibold text-[#344054]">
                手机号（必填）
                <input type="tel" name="phone" defaultValue={draft.phone} autoComplete="tel" placeholder="用于接入沟通" aria-invalid={!!gateErrors.phone} aria-describedby={gateErrors.phone ? 'gate-err-phone' : undefined} className={fieldClass(gateErrors.phone)} />
                <FieldError id="gate-err-phone" text={gateErrors.phone} />
              </label>
              <label className="grid gap-2 text-xs font-semibold text-[#344054] sm:col-span-2">
                邮箱（必填）
                <input type="email" name="email" defaultValue={draft.email} autoComplete="email" placeholder="用于接收更新通知" aria-invalid={!!gateErrors.email} aria-describedby={gateErrors.email ? 'gate-err-email' : undefined} className={fieldClass(gateErrors.email)} />
                <FieldError id="gate-err-email" text={gateErrors.email} />
              </label>
              <label className="grid gap-2 text-xs font-semibold text-[#344054] sm:col-span-2">
                所在公司 / 学校 / 机构（必填）
                <input name="organization" defaultValue={draft.organization} autoComplete="organization" placeholder="请输入机构名称" aria-invalid={!!gateErrors.organization} aria-describedby={gateErrors.organization ? 'gate-err-organization' : undefined} className={fieldClass(gateErrors.organization)} />
                <FieldError id="gate-err-organization" text={gateErrors.organization} />
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-lg bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#175cd3] disabled:opacity-60"
            >
              {submitting ? '下载中…' : `提交并下载${gateTarget.sdkLanguage === 'python' ? ' Python SDK' : gateTarget.sdkLanguage === 'node' ? ' Node.js SDK' : ''}`}
            </button>
            <p className="mt-3 text-center text-[11px] leading-5 text-[#98a2b3]">
              提交即表示你同意我们仅将信息用于产品相关的技术支持联系。
            </p>
            </form>
          </div>
        </dialog>
      )}

    </DownloadContext.Provider>
  );
}
