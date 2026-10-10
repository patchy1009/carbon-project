"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabaseClient";
import { LogOut, User, ChevronDown } from "lucide-react";

export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // ตรวจสอบสถานะการล็อกอินของผู้ใช้ปัจจุบัน
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };

    checkUser();

    // ติดตามการเปลี่ยนแปลง Auth State
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ฟังก์ชันออกจากระบบ
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsDropdownOpen(false);
    router.push("/organization/homepage");
  };

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

        {/* ส่วนจัดการผู้ใช้ฝั่งขวา */}
        <div>
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 bg-emerald-800/60 hover:bg-emerald-800 px-4 py-2 rounded-full text-sm font-medium transition text-white"
              >
                <div className="w-7 h-7 rounded-full bg-white text-[#1c5d41] flex items-center justify-center font-bold text-xs">
                  {user.email ? user.email.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <span className="max-w-[120px] truncate">{user.email}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* Dropdown Menu เมื่อล็อกอินแล้ว */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 text-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      router.push("/organization/dashboard");
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 transition flex items-center space-x-2"
                  >
                    <User className="w-4 h-4 text-slate-500" />
                    <span>จัดการองค์กร / Dashboard</span>
                  </button>
                  <div className="h-px bg-slate-100 my-1"></div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition flex items-center space-x-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setIsAuthOpen(true);
                }}
                className="bg-white text-[#1c5d41] font-semibold px-5 py-2 rounded-full text-sm shadow hover:bg-gray-100 transition"
              >
                เข้าสู่ระบบ
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ================= เนื้อหาของแต่ละหน้า ================= */}
      <main>{children}</main>

      {/* ================= Pop-up เข้าสู่ระบบ / ลงทะเบียน ================= */}
      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        initialMode={authMode}
      />
    </div>
  );
}