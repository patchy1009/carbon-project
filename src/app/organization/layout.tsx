
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User as UserIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabaseClient";

export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const isForgotPasswordPage =
    pathname === "/organization/forgot_password";

  // ตรวจสอบสถานะการเข้าสู่ระบบจาก Supabase
  useEffect(() => {
    let mounted = true;

    const checkUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (!mounted) return;

        if (error) {
          setUser(null);
        } else {
          setUser(data.user ?? null);
        }
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setAuthChecked(true);
      }
    };

    void checkUser();

    // อัปเดต Navbar เมื่อ Login หรือ Logout
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        setUser(null);
        setIsAuthOpen(false);
        return;
      }

      if (session?.user) {
        setUser(session.user);
      } else if (event === "INITIAL_SESSION") {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // หน้าลืมรหัสผ่านให้แสดงปุ่มเข้าสู่ระบบ
  // แม้ Supabase จะมี recovery session อยู่ก็ตาม
  const displayUser = isForgotPasswordPage ? null : user;

  // กำหนดหน้าหลักตามสถานะ Login
  const homeHref = displayUser
    ? "/organization/dashboard"
    : "/organization/homepage";

  const isActive = (path: string) => {
    if (path === "/organization/dashboard") {
      return pathname === path || pathname.startsWith(`${path}/`);
    }

    if (path === "/organization/homepage") {
      return pathname === path;
    }

    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const getMenuClass = (path: string) =>
    `whitespace-nowrap transition-colors duration-200 hover:text-emerald-200 ${
      isActive(path)
        ? "font-semibold text-emerald-200 underline underline-offset-8"
        : "text-white"
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="w-full bg-[#1F3E35] text-white shadow-md">
        <nav className="mx-auto grid min-h-20 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-4">
          {/* Logo */}
          <Link
            href={homeHref}
            className="justify-self-start whitespace-nowrap text-xl font-bold tracking-wide sm:text-2xl"
          >
            Carbon Calculator
          </Link>

          {/* เมนูตรงกลาง */}
          <div className="flex items-center justify-center gap-4 text-sm sm:gap-6 lg:gap-8 lg:text-base">
            <Link href={homeHref} className={getMenuClass(homeHref)}>
              {displayUser ? "แดชบอร์ด" : "หน้าหลัก"}
            </Link>

            <Link
              href="/organization/footprint"
              className={getMenuClass("/organization/footprint")}
            >
              คาร์บอนฟุตพริ้นท์
            </Link>

            <Link
              href="/organization/tver_simulation"
              className={getMenuClass("/organization/tver_simulation")}
            >
              จำลองโครงการ T-VER
            </Link>

            <Link
              href="/organization/tax_calculator"
              className={getMenuClass("/organization/tax_calculator")}
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

          {/* ด้านขวา: Login หรือไอคอนบัญชี */}
          <div className="flex justify-self-end items-center">
            {!authChecked ? (
              // รอตรวจสอบ Session เพื่อป้องกัน Navbar
              // แสดงสถานะผิดชั่วคราว
              <div className="h-10 w-10" />
            ) : displayUser ? (
              <Link
                href="/organization/account_user"
                aria-label="บัญชีผู้ใช้"
                title="บัญชีผู้ใช้"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white bg-white transition-colors duration-200 hover:bg-emerald-50"
              >
                <UserIcon
                  size={21}
                  strokeWidth={2}
                  className="text-[#1F3E35]"
                />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                className="whitespace-nowrap rounded-lg bg-white px-4 py-2 font-semibold text-[#1F3E35] transition-colors duration-200 hover:bg-emerald-100"
              >
                เข้าสู่ระบบ
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* เนื้อหาของแต่ละหน้า */}
      <main>{children}</main>

      {/* ใช้ Login Modal ร่วมกันทั้งส่วน Organization */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
}
