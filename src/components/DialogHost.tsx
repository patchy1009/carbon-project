'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { closeDialog, currentDialog, subscribeDialog, type DialogTone } from '@/lib/dialog';

/* [เพิ่ม] ตัวแสดงกล่องแจ้งเตือน/ยืนยัน (คู่กับ src/lib/dialog.ts) วางครั้งเดียวใน root layout
 * - Esc / คลิกพื้นหลัง = ยกเลิก (กล่องแจ้งเตือน = ปิด)
 * - Enter = กดปุ่มหลัก (โฟกัสอยู่ที่ปุ่มหลักตั้งแต่เปิด) */

const TONE: Record<DialogTone, { ring: string; icon: string; button: string }> = {
  info: { ring: 'bg-[#E0F2FE]', icon: 'text-[#0284C7]', button: 'bg-[#32885F] hover:bg-[#2A7550]' },
  success: { ring: 'bg-[#DCFCE7]', icon: 'text-[#16A34A]', button: 'bg-[#32885F] hover:bg-[#2A7550]' },
  warning: { ring: 'bg-[#FEF3C7]', icon: 'text-[#D97706]', button: 'bg-[#32885F] hover:bg-[#2A7550]' },
  error: { ring: 'bg-[#FEE2E2]', icon: 'text-[#DC2626]', button: 'bg-[#32885F] hover:bg-[#2A7550]' },
  danger: { ring: 'bg-[#FEE2E2]', icon: 'text-[#DC2626]', button: 'bg-[#DC2626] hover:bg-[#B91C1C]' },
};

function ToneIcon({ tone }: { tone: DialogTone }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-6 w-6',
    'aria-hidden': true,
  };
  if (tone === 'success')
    return (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  if (tone === 'danger')
    return (
      <svg {...common}>
        <path d="M3 6h18" />
        <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      </svg>
    );
  if (tone === 'info')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </svg>
    );
  // warning / error
  return (
    <svg {...common}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export default function DialogHost() {
  const dialog = useSyncExternalStore(subscribeDialog, currentDialog, () => null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!dialog) return;
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDialog(dialog.id, false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  if (!dialog) return null;
  const tone = TONE[dialog.tone];
  const cancel = () => closeDialog(dialog.id, false);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/45 p-4 backdrop-blur-[2px] animate-[dialog-fade_120ms_ease-out]"
      onClick={cancel}
      role="presentation"
    >
      <div
        role={dialog.kind === 'confirm' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={`dialog-title-${dialog.id}`}
        aria-describedby={`dialog-msg-${dialog.id}`}
        className="w-full max-w-[420px] rounded-2xl bg-white p-6 font-sans shadow-[0_20px_50px_rgba(15,23,42,0.25)] animate-[dialog-pop_140ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone.ring} ${tone.icon}`}>
            <ToneIcon tone={dialog.tone} />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h2 id={`dialog-title-${dialog.id}`} className="text-lg font-semibold text-[#0F172A]">
              {dialog.title}
            </h2>
            <p id={`dialog-msg-${dialog.id}`} className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-[#475569]">
              {dialog.message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {dialog.kind === 'confirm' && (
            <button
              type="button"
              onClick={cancel}
              className="h-10 rounded-full border border-[#CBD5E1] px-5 text-sm font-medium text-[#334155] hover:bg-[#F1F5F9]"
            >
              {dialog.cancelText}
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            onClick={() => closeDialog(dialog.id, true)}
            className={`h-10 rounded-full px-6 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#32885F] ${tone.button}`}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
