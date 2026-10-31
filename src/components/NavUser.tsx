'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

/* [เพิ่ม] ส่วนแสดงผู้ใช้ที่ล็อกอินบน navbar ใช้ร่วมกันทั้งฝั่ง organization และ admin (หน้าตาเหมือนกัน)
 * - ล็อกอินแล้ว: อีเมล + ปุ่ม "ออกจากระบบ" + วงกลมไอคอนผู้ใช้
 * - ยังไม่ล็อกอิน: กดวงกลมเพื่อเปิด Pop-up เข้าสู่ระบบ (onLoginClick ส่งมาจากฝั่ง organization) */
export default function NavUser({ onLoginClick }: { onLoginClick?: () => void }) {
  const router = useRouter();
  // อีเมลของบัญชีที่ล็อกอินอยู่ (null = ยังไม่ล็อกอิน)
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut(); // ลบ session ใน cookie
    router.replace('/organization/login');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {email && (
        <>
          <span className="text-white text-sm hidden md:inline">{email}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-white text-sm underline hover:opacity-80"
          >
            ออกจากระบบ
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => !email && onLoginClick?.()}
        aria-label={email ? 'บัญชีผู้ใช้' : 'เข้าสู่ระบบ'}
        className="w-[55px] h-[55px] rounded-full bg-white border-[3px] border-[#6FB898] shadow-[0px_1px_6px_rgba(0,0,0,0.25)] flex items-center justify-center"
      >
        <svg width="20" height="21" viewBox="0 0 24 24" fill="none" stroke="#6FB898" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      </button>
    </div>
  );
}
