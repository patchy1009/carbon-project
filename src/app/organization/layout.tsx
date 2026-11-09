// โครงหน้าฝั่งองค์กร: แถบเมนูด้านบนที่ใช้ร่วมกันทุกหน้า
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AuthModal from '@/components/AuthModal';
import NavUser from '@/components/NavUser';

const navItems = [
  { label: 'หน้าหลัก', href: '/organization/dashboard' },
  { label: 'คาร์บอนฟุตพรินท์', href: '/organization/footprint' },
  { label: 'จำลองโครงการ T-VER', href: '/organization/tver-simulation' },
  { label: 'คำนวณภาษี', href: '/organization/tax-calculator' },
  { label: 'เอกสาร', href: '/organization/documents' },
];

// แสดงแถบเมนู เนื้อหาของแต่ละหน้า และกล่องเข้าสู่ระบบ
export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // State สำหรับเปิด/ปิด Pop-up เข้าสู่ระบบ
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-800 font-sans">
      {/* ================= NAVBAR ฝั่ง USER (อยู่คงที่ทุกหน้า) ================= */}
      {/* ปรับ navbar ตามแบบที่ออกแบบไว้:
            - ความสูง 84px -> 76px, เงาใต้แถบนุ่มลง (เดิมเงาเข้มมาก)
            - โลโก้ 28px -> 26px ตัวหนาปานกลาง เอาเงาตัวอักษรออก
            - เมนู 20px -> 17px น้ำหนักปกติ ระยะห่างเท่ากัน
            - ฟอนต์: โลโก้ใช้ font-display (Prompt), เมนูใช้ฟอนต์มีหัวของทั้งเว็บ (IBM Plex Sans Thai Looped)
              เดิมเขียน font-['Prompt'] / font-['Lato'] แต่ไม่ได้โหลดฟอนต์ จึงแสดงเป็นฟอนต์ตัวมีเชิงของเครื่อง
            - ด้านขวาเหลือแค่วงกลมผู้ใช้ (อีเมล + ออกจากระบบย้ายไปอยู่ในเมนูของวงกลม ดู NavUser.tsx) */}
      <nav
        className="h-[76px] px-8 flex items-center justify-between rounded-bl-[50px] sticky top-0 z-50"
        style={{
          background: 'linear-gradient(90deg, #2D4A63 0%, #32885F 100%)',
          boxShadow: '0 6px 16px rgba(0, 50, 50, 0.35)',
        }}
      >
        {/* โลโก้ฝั่งซ้าย */}
        <Link
          href="/organization/dashboard"
          className="font-display text-white font-semibold text-[26px] tracking-tight hover:opacity-90 transition"
        >
          Carbon Calculator
        </Link>

        {/* เมนูตรงกลาง */}
        <div className="hidden md:flex items-center gap-10">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              // เมนูใช้ฟอนต์มีหัวของทั้งเว็บ + ชี้แล้วมีเส้นใต้เลื่อนออกมา (ลูกเล่นตอนชี้)
              className="relative text-white text-[17px] font-normal text-center transition after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-white/80 after:transition-transform hover:after:scale-x-100"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* ปุ่มขวาสุด — วงกลมผู้ใช้ (ล็อกอินแล้วกดดูอีเมล/ออกจากระบบ, ยังไม่ล็อกอินกดเปิด Pop-up เข้าสู่ระบบ)
            ใช้ component กลาง NavUser ร่วมกับฝั่ง admin */}
        <NavUser onLoginClick={() => setIsAuthOpen(true)} />
      </nav>

      {/* ================= เนื้อหาของแต่ละหน้า ================= */}
      <main>{children}</main>

      {/* ================= Pop-up เข้าสู่ระบบ / ลงทะเบียน ================= */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}