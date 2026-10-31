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

        {/* ปุ่มขวาสุด — ล็อกอินแล้วแสดงอีเมล + ออกจากระบบ / ยังไม่ล็อกอินเปิด Pop-up
            [แก้ไข] ย้ายไปเป็น component กลาง NavUser ให้ฝั่ง admin ใช้หน้าตาเดียวกัน */}
        <NavUser onLoginClick={() => setIsAuthOpen(true)} />
      </nav>

      {/* ================= เนื้อหาของแต่ละหน้า ================= */}
      <main>{children}</main>

      {/* ================= Pop-up เข้าสู่ระบบ / ลงทะเบียน ================= */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}