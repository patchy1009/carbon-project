'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

/* ส่วนผู้ใช้บน navbar ใช้ร่วมกันทั้งฝั่ง organization และ admin
 * ปรับตามแบบที่ออกแบบไว้: บน navbar มีแค่วงกลมไอคอนผู้ใช้ (เดิมมีอีเมล + ลิงก์ออกจากระบบวางเรียงอยู่ข้างๆ)
 *   - ล็อกอินแล้ว: กดวงกลม -> เมนูเล็กแสดงอีเมล + ปุ่ม "ออกจากระบบ" (คลิกนอกเมนูหรือกด Esc = ปิด)
 *   - ยังไม่ล็อกอิน: กดวงกลม -> เปิด Pop-up เข้าสู่ระบบ (onLoginClick ส่งมาจากฝั่ง organization) */
export default function NavUser({ onLoginClick }: { onLoginClick?: () => void }) {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  // อีเมลของบัญชีที่ล็อกอินอยู่ (null = ยังไม่ล็อกอิน)
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ปิดเมนูเมื่อคลิกนอกเมนู หรือกด Esc
  useEffect(() => {
    if (!open) return;
    // คลิกนอกเมนูแล้วปิดเมนู
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // กด Esc แล้วปิดเมนู
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // ออกจากระบบ แล้วพากลับไปหน้าเข้าสู่ระบบ
  async function handleLogout() {
    setOpen(false);
    await supabase.auth.signOut(); // ลบ session ใน cookie
    router.replace('/organization/login');
    router.refresh();
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => (email ? setOpen((v) => !v) : onLoginClick?.())}
        aria-label={email ? 'เมนูบัญชีผู้ใช้' : 'เข้าสู่ระบบ'}
        aria-expanded={email ? open : undefined}
        aria-haspopup={email ? 'menu' : undefined}
        className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-[#6FB898] bg-white shadow-[0_1px_6px_rgba(0,0,0,0.2)] transition hover:scale-[1.03]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4E9E7B" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      </button>

      {/* เมนูบัญชี (แทนอีเมล + ลิงก์ออกจากระบบที่เคยวางบน navbar) */}
      {open && email && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+10px)] w-64 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white text-left shadow-lg"
        >
          <div className="border-b border-[#F1F5F9] px-4 py-3">
            <p className="text-xs text-[#94A3B8]">เข้าสู่ระบบด้วย</p>
            <p className="truncate text-sm font-medium text-[#1E293B]" title={email}>{email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-[#B91C1C] hover:bg-[#FEF2F2]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5M21 12H9" />
            </svg>
            ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  );
}
