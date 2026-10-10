"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import {
  User as UserIcon,
  Menu,
  X,
  LogIn,
} from "lucide-react";

export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ตรวจสอบสถานะ Login และติดตามการเปลี่ยนแปลง Auth
  useEffect(() => {
    let mounted = true;

    const checkUser = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("Session error:", error);
        setUser(null);
        return;
      }

      setUser(data.session?.user ?? null);
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ตรวจสอบเมนูที่กำลังใช้งาน
  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);

  // รูปแบบ CSS ของเมนู
  const getMenuClass = (path: string) =>
    `transition hover:text-gray-200 ${
      isActive(path)
        ? "font-bold underline underline-offset-4 text-emerald-200"
        : ""
    }`;

  return (
    <div className="min-h-screen bg-white text-gray-800 font-sans flex flex-col">
      {/* Navbar */}
      <nav className="bg-[#1c5d41] text-white px-4 md:px-8 py-4 flex justify-between items-center shadow-md sticky top-0 z-50">
        {/* Logo */}
        <Link
          href={
            user
              ? "/organization/dashboard"
              : "/organization/homepage"
          }
          className="text-lg md:text-xl font-bold tracking-wide hover:opacity-90 transition flex items-center gap-2"
        >
          Carbon Calculator
        </Link>

        {/* เมนูหลัก Desktop */}
        <div className="hidden md:flex space-x-6 text-sm font-medium">
          {/* สลับเมนูแรกตามสถานะการล็อกอิน */}
          {user ? (
            <Link
              href="/organization/dashboard"
              className={getMenuClass("/organization/dashboard")}
            >
              แดชบอร์ด
            </Link>
          ) : (
            <Link
              href="/organization/homepage"
              className={getMenuClass("/organization/homepage")}
            >
              หน้าแรก
            </Link>
          )}

          <Link
            href="/organization/footprint"
            className={getMenuClass("/organization/footprint")}
          >
            คาร์บอนฟุตพริ้นท์
          </Link>

          <Link
            href="/organization/tver-simulation"
            className={getMenuClass("/organization/tver-simulation")}
          >
            จำลองโครงการ T-VER
          </Link>

          <Link
            href="/organization/tax-calculator"
            className={getMenuClass("/organization/tax-calculator")}
          >
            คำนวณภาษี
          </Link>

          <Link
            href="/organization/documents"
            className={getMenuClass("/organization/documents")}
          >
            เอกสาร
          </Link>
        </div>

        {/* ส่วนผู้ใช้ (ขวาบน) */}
        <div className="flex items-center space-x-3">
          {user ? (
            /* เมื่อล็อกอินแล้ว: ปุ่มวงกลมรูปไอคอนคน (แบบรูปขวา) กดแล้วไปหน้า /organization/account_user */
            <Link
              href="/organization/account_user"
              className="w-10 h-10 rounded-full bg-white hover:bg-emerald-50 text-[#1c5d41] flex items-center justify-center shadow-md transition-all transform hover:scale-105 border border-emerald-100"
              title="ตั้งค่าข้อมูลองค์กร"
            >
              <UserIcon className="w-5 h-5 text-[#1c5d41]" />
            </Link>
          ) : (
            /* เมื่อยังไม่ได้ล็อกอิน: ปุ่มเข้าสู่ระบบแบบเดิมที่กดแล้วเปิด AuthModal */
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="bg-white text-[#1c5d41] font-semibold px-4 md:px-5 py-2 rounded-full text-sm shadow hover:bg-emerald-50 transition flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>เข้าสู่ระบบ</span>
            </button>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-white hover:bg-emerald-800/50 rounded-xl transition"
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Dropdown Menu (แสดงบนมือถือ) */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[#154631] text-white px-4 py-4 space-y-3 border-b border-emerald-800 shadow-lg">
          {user ? (
            <Link
              href="/organization/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block py-2 text-sm font-medium ${getMenuClass("/organization/dashboard")}`}
            >
              แดชบอร์ด
            </Link>
          ) : (
            <Link
              href="/organization/homepage"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block py-2 text-sm font-medium ${getMenuClass("/organization/homepage")}`}
            >
              หน้าแรก
            </Link>
          )}

          <Link
            href="/organization/footprint"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`block py-2 text-sm font-medium ${getMenuClass("/organization/footprint")}`}
          >
            คาร์บอนฟุตพริ้นท์
          </Link>
          <Link
            href="/organization/tver-simulation"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`block py-2 text-sm font-medium ${getMenuClass("/organization/tver-simulation")}`}
          >
            จำลองโครงการ T-VER
          </Link>
          <Link
            href="/organization/tax-calculator"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`block py-2 text-sm font-medium ${getMenuClass("/organization/tax-calculator")}`}
          >
            คำนวณภาษี
          </Link>
          <Link
            href="/organization/documents"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`block py-2 text-sm font-medium ${getMenuClass("/organization/documents")}`}
          >
            เอกสาร
          </Link>

          {user && (
            <Link
              href="/organization/account_user"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-emerald-200 border-t border-emerald-800/80 pt-3"
            >
              จัดการบัญชีองค์กร
            </Link>
          )}
        </div>
      )}

      {/* เนื้อหาของแต่ละหน้า */}
      <main className="flex-grow min-h-[calc(100vh-72px)]">
        {children}
      </main>

      {/* Auth Modal (Login / Register Popup) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
}