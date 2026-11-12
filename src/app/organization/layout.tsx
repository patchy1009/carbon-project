/* ===================== [MERGE aom + cyn2] =====================
 * ไฟล์นี้ = โค้ด cyn2 ทั้งไฟล์ (ตามที่ตกลง: Navbar ฝั่งองค์กรใช้ของ cyn2) — แก้แค่ฟอนต์ [MERGE-FIX] ให้ตรงกับฝั่งแอดมิน
 *   - navbar ของ aom (NavUser.tsx: วงกลมผู้ใช้ + เมนูอีเมล/ออกจากระบบ) ไม่ได้ใช้ในฝั่งองค์กรแล้ว
 *     แต่ยังใช้ที่ src/app/admin/layout.tsx ของ aom จึงไม่ได้ลบไฟล์ NavUser.tsx
 *   - ลิงก์เมนูของ cyn2 เข้ากับหน้าของ aom ได้เลยโดยไม่ต้องแก้:
 *       แดชบอร์ด/คาร์บอนฟุตพรินต์/จำลอง T-VER (/organization/tver-simulation)/เอกสาร = หน้าของ aom
 *       คำนวณภาษี (/organization/tax_calculator) และไอคอนบัญชี (/organization/account_user) = หน้าของ cyn2
 * ============================================================== */
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthModal from '@/components/AuthModal';
import { supabase } from '@/lib/supabaseClient';

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

  // กำหนดรายการเมนูตรงกลาง โดยเปลี่ยนตามสถานะการล็อกอินของ email
  const navItems = [
    { 
      label: email ? 'แดชบอร์ด' : 'หน้าหลัก', 
      href: email ? '/organization/dashboard' : '/' // ปรับลิงก์หน้าหลักตามต้องการ เช่น '/' หรือหน้า Home ทั่วไป
    },
    { label: 'คาร์บอนฟุตพรินต์', href: '/organization/footprint' },
    { label: 'จำลองโครงการ T-VER', href: '/organization/tver-simulation' },
    { label: 'คำนวณภาษี', href: '/organization/tax_calculator' },
    { label: 'เอกสาร', href: '/organization/documents' },
  ];

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
        {/* โลโก้ฝั่งซ้าย
            [MERGE-FIX] ฟอนต์: เดิม font-['Prompt'] แต่เว็บไม่ได้โหลดฟอนต์ชื่อนี้ไว้ (เครื่องส่วนใหญ่ไม่มี)
            จึงแสดงเป็นฟอนต์สำรองของเครื่อง -> เปลี่ยนเป็น font-display (Prompt ที่โหลดไว้ใน src/app/layout.tsx)
            ให้ตรงกับฝั่งแอดมิน ขนาด 28px ตัวหนาคงเดิม */}
        <Link
          href="/organization/dashboard"
          className="text-white font-bold text-[28px] font-display hover:opacity-90 transition"
          style={{ textShadow: '3px 2px 2.8px rgba(0,0,0,0.25)' }}
        >
          Carbon Calculator
        </Link>

        {/* เมนูตรงกลาง
            [MERGE-FIX] ฟอนต์: เดิม font-['Lato'] ซึ่งไม่ได้โหลดไว้เหมือนกัน -> เอาออก ให้ใช้ฟอนต์หลักของเว็บ (font-sans)
            เหมือนเมนูฝั่งแอดมิน ขนาด 20px คงเดิม */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-white text-[20px] font-medium text-center hover:opacity-80 transition"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* ปุ่มขวาสุด — รูปคน (คลิกไปหน้า account_user หากล็อกอินแล้ว / เปิด Pop-up หากยังไม่ล็อกอิน) */}
        <div className="flex items-center gap-3">
          {email ? (
            <Link
              href="/organization/account_user"
              aria-label="บัญชีผู้ใช้"
              className="w-[55px] h-[55px] rounded-full bg-white border-[3px] border-[#6FB898] shadow-[0px_1px_6px_rgba(0,0,0,0.25)] flex items-center justify-center hover:bg-gray-50 transition"
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
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              aria-label="เข้าสู่ระบบ"
              className="w-[55px] h-[55px] rounded-full bg-white border-[3px] border-[#6FB898] shadow-[0px_1px_6px_rgba(0,0,0,0.25)] flex items-center justify-center hover:bg-gray-50 transition"
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
          )}
        </div>
      </nav>

      {/* ================= เนื้อหาของแต่ละหน้า ================= */}
      <main>{children}</main>

      {/* ================= Pop-up เข้าสู่ระบบ / ลงทะเบียน ================= */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}