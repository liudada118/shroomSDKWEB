'use client';

import { useId, useRef, useState } from 'react';
import { sdkInstallCommand } from './sdk-install';

/** 官网和文档复用同一 npm 安装命令；无需处理下载地址或本机文件路径。 */
export default function SdkInstall() {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState('');
  const command = sdkInstallCommand();

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setNotice('已复制，在项目终端粘贴并执行。');
    } catch {
      field.current?.focus();
      field.current?.select();
      setNotice('已选中命令，请手动复制。');
    }
  }

  return <div className="min-w-0 rounded-xl border border-[#d0d5dd] bg-[#f8fafc] p-4">
    <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#344054]">在你的项目目录执行</label>
    <input ref={field} id={id} aria-label="SDK 安装命令" spellCheck={false} readOnly value={command}
      className="block h-11 w-full min-w-0 rounded-lg border border-[#d0d5dd] bg-white px-3 font-mono text-xs text-[#344054] focus:outline-2 focus:outline-offset-2 focus:outline-[#2563eb]" />
    <button type="button" onClick={() => void copy()} className="mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#175cd3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">复制安装命令</button>
    <p role="status" aria-live="polite" className="mb-0 mt-2 text-xs leading-5 text-[#667085]">{notice || '自动安装到 node_modules，无需解压或复制源码。'}</p>
  </div>;
}
