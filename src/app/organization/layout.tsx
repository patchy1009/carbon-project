'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthModal from '@/components/AuthModal';
import { supabase } from '@/lib/supabaseClient';

const navItems = [
  { label: 'หน้าหลัก', href: '/organization/dashboard' },
  { label: 'คาร์บอนฟุตพรินท์', href: '/organization/footprint' },
  { label: 'จำลองโครงการ T-VER', href: '/organization/tver-simulation' },
  { label: 'คำนวณภาษี', href: '/organization/tax-calculator' },
  { label: 'เอกสาร', href: '/organization/documents' },
];

export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // State สำหรับเปิด/ปิด Pop-up เข้าสู่ระบบ
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  // อีเมลของบัญชีที่ล็อกอินอยู่ (null = ยังไม่ล็อกอิน)
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

useEffect(() => {
  // 1. ดึงอีเมลของผู้ใช้ปัจจุบัน
  supabase.auth.getUser().then(({ data }: { data: any }) => {
    setEmail(data?.user?.email ?? null);
  });

  // 2. ติดตามการเปลี่ยนแปลงสถานะ Auth
  const { data: sub } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
    setEmail(session?.user?.email ?? null);
  });

  return () => sub.subscription.unsubscribe();
}, []);

  async function handleLogout() {
    await supabase.auth.signOut(); // ลบ session ใน cookie
    router.replace('/organization/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-white text-gray-800 font-sans">
      {/* ================= NAVBAR ฝั่ง USER (อยู่คงที่ทุกหน้า) ================= */}
      <nav
        className="h-[84px] px-8 flex items-center justify-between rounded-bl-[50px] sticky top-0 z-50"
        style={{
          background: 'linear-gradient(90deg, #2D4A63 0%, #32885F 100%)',
          boxShadow: '-1px 6px 12.1px rgba(0, 63, 66, 0.81)',
        }}
      >
        {/* โลโก้ฝั่งซ้าย */}
        <Link
          href="/organization/dashboard"
          className="text-white font-bold text-[28px] font-['Prompt'] hover:opacity-90 transition"
          style={{ textShadow: '3px 2px 2.8px rgba(0,0,0,0.25)' }}
        >
          Carbon Calculator
        </Link>

        {/* เมนูตรงกลาง */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-white text-[20px] font-medium font-['Lato'] text-center hover:opacity-80 transition"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* ปุ่มขวาสุด — ล็อกอินแล้วแสดงอีเมล + ออกจากระบบ / ยังไม่ล็อกอินเปิด Pop-up */}
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
          onClick={() => !email && setIsAuthOpen(true)}
          aria-label={email ? 'บัญชีผู้ใช้' : 'เข้าสู่ระบบ'}
          className="w-[55px] h-[55px] rounded-full bg-white border-[3px] border-[#6FB898] shadow-[0px_1px_6px_rgba(0,0,0,0.25)] flex items-center justify-center"
        >
          <svg
            width="20"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6FB898"
            strokeWidth="2"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        </button>
        </div>
      </nav>

      {/* ================= เนื้อหาของแต่ละหน้า ================= */}
      <main>{children}</main>

      {/* ================= Pop-up เข้าสู่ระบบ / ลงทะเบียน ================= */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}