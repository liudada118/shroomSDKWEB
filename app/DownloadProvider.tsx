'use client';

import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { SDK_VARIANTS, type DownloadTarget } from './downloads';

// 只登记下载线索，不是付费鉴权；所有页面复用同一流程。
const SDK_REGISTRY_URL = process.env.NEXT_PUBLIC_SDK_REGISTRY_URL ?? 'https://shroom.jq-industries.com/sdk-requests';
const REGISTERED_KEY = 'shroom-sdk-registered';
const DownloadContext = createContext<((target: DownloadTarget) => void) | null>(null);

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
    const fd = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      await fetch(SDK_REGISTRY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 登记接口要是卡住（网络不通、服务没起来），按钮会一直停在「下载中…」，
        // 用户以为在排队审批。给 8 秒上限，超时就当登记失败，直接放行下载
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          name: String(fd.get('name') ?? '').trim(),
          phone: String(fd.get('phone') ?? '').trim(),
          email: String(fd.get('email') ?? '').trim(),
          organization: String(fd.get('organization') ?? '').trim(),
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

            <form onSubmit={submitGate} onChange={(event) => {
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
                <input data-initial-focus required name="name" defaultValue={draft.name} autoComplete="name" placeholder="怎么称呼你" className="h-11 rounded-lg border border-[#d0d5dd] px-3.5 text-base font-normal outline-none transition placeholder:text-[#98a2b3] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]" />
              </label>
              <label className="grid gap-2 text-xs font-semibold text-[#344054]">
                手机号（必填）
                <input required type="tel" name="phone" defaultValue={draft.phone} autoComplete="tel" placeholder="用于接入沟通" className="h-11 rounded-lg border border-[#d0d5dd] px-3.5 text-base font-normal outline-none transition placeholder:text-[#98a2b3] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]" />
              </label>
              <label className="grid gap-2 text-xs font-semibold text-[#344054] sm:col-span-2">
                邮箱 <span className="font-normal text-[#98a2b3]">（选填）</span>
                <input type="email" name="email" defaultValue={draft.email} autoComplete="email" placeholder="用于接收更新通知" className="h-11 rounded-lg border border-[#d0d5dd] px-3.5 text-base font-normal outline-none transition placeholder:text-[#98a2b3] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]" />
              </label>
              <label className="grid gap-2 text-xs font-semibold text-[#344054] sm:col-span-2">
                所在公司 / 学校 / 机构 <span className="font-normal text-[#98a2b3]">（选填）</span>
                <input name="organization" defaultValue={draft.organization} autoComplete="organization" placeholder="请输入机构名称" className="h-11 rounded-lg border border-[#d0d5dd] px-3.5 text-base font-normal outline-none transition placeholder:text-[#98a2b3] focus:border-[#84adff] focus:ring-4 focus:ring-[#eff4ff]" />
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
