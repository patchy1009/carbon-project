"use client";

import React, { useState } from "react";
import Link from "next/link";
import AuthModal from "@/components/AuthModal";

export default function OrganizationLayout({children,}: {children: React.ReactNode;}) {
  // State สำหรับเปิด/ปิด Pop-up เข้าสู่ระบบ
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-800 font-sans">
      {/* ================= NAVBAR ฝั่ง USER (อยู่คงที่ทุกหน้า) ================= */}
      <nav className="bg-[#1c5d41] text-white px-8 py-4 flex justify-between items-center shadow-md sticky top-0 z-50">
        {/* โลโก้ฝั่งซ้าย */}
        <Link 
          href="/organization/homepage" 
          className="text-xl font-bold tracking-wide hover:opacity-90 transition"
        >
          Carbon Calculator
        </Link>

        {/* เมนูตรงกลาง */}
        <div className="hidden md:flex space-x-6 text-sm font-medium">
          <Link href="/organization/homepage" className="hover:text-gray-200 transition">
            หน้าหลัก
          </Link>
          <Link href="/organization/footprint" className="hover:text-gray-200 transition">
            คาร์บอนฟุตพริ้นท์
          </Link>
          <Link href="/organization/tver-simulation" className="hover:text-gray-200 transition">
            จำลองโครงการ T-VER
          </Link>
          <Link href="/organization/tax-calculator" className="hover:text-gray-200 transition">
            คำนวณภาษี
          </Link>
          <Link href="/organization/documents" className="hover:text-gray-200 transition">
            เอกสาร
          </Link>
        </div>

        {/* ปุ่มเข้าสู่ระบบฝั่งขวา (เปลี่ยนเป็น button เรียก Pop-up) */}
        <div>
          <button
            type="button"
            onClick={() => setIsAuthOpen(true)}
            className="bg-white text-[#1c5d41] font-semibold px-5 py-2 rounded-full text-sm shadow hover:bg-gray-100 transition"
          >
            เข้าสู่ระบบ
          </button>
        </div>
      </nav>

      {/* ================= เนื้อหาของแต่ละหน้า ================= */}
      <main>{children}</main>

      {/* ================= Pop-up เข้าสู่ระบบ / ลงทะเบียน ================= */}
      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
      />
    </div>
  );
}