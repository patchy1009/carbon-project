"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { supabase } from "@/lib/supabaseClient";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({
  isOpen,
  onClose,
}: AuthModalProps) {
  const router = useRouter();

  // state ฟอร์ม Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrorMessage, setLoginErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleNavigateToRegister = () => {
    onClose();
    router.push("/organization/register");
  };

  const handleNavigateToForgotPassword = () => {
    onClose();
    router.push("/organization/forgot_password");
  };

  // =====================================================
  // LOGIN SUBMIT (Supabase Auth & Check Role from 'user' table)
  // =====================================================
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrorMessage("");

    if (!loginEmail || !loginPassword) {
      setLoginErrorMessage("กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน");
      return;
    }

    setIsLoading(true);

    try {
      // 1. ล็อกอินผ่าน Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });

      if (error) throw error;
      if (!data.user) throw new Error("ไม่พบข้อมูลผู้ใช้งาน");

      // 2. ตรวจสอบ Role จากตาราง user
      const { data: userData, error: userError } = await supabase
        .from("user")
        .select("role")
        .eq("acc_id", data.user.id)
        .single();

      if (userError || !userData) {
        throw new Error("ไม่พบข้อมูลสิทธิ์การใช้งานในระบบ");
      }

      onClose();

      // 3. แยกเส้นทางตาม Role
      if (userData.role === "admin") {
        router.push("/admin/recommendation");
      } else {
        router.push("/organization/dashboard");
      }
    } catch (err: any) {
      console.error("Login error:", err);

      // ดักจับ Error รวมถึง Rate Limit / Brute Force ตามมาตรฐาน Supabase Auth
      if (err?.message?.includes("Invalid login credentials")) {
        setLoginErrorMessage("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      } else if (err?.message?.includes("Too many requests")) {
        setLoginErrorMessage("มีการพยายามเข้าสู่ระบบถี่เกินไป กรุณารองใหม่อีกครั้งในภายหลัง");
      } else {
        setLoginErrorMessage(err?.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setIsLoading(false);
    }
  };

  <div className="flex justify-end">
    <button
      type="button"
      onClick={handleNavigateToForgotPassword}
      className="text-sm text-emerald-600 hover:underline"
    >
      ลืมรหัสผ่าน?
    </button>
  </div>

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-2xl">
        <div>
          <h2 className="text-2xl font-bold mb-4 text-center text-slate-800">
            เข้าสู่ระบบองค์กร
          </h2>

          {loginErrorMessage && (
            <div className="mb-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
              {loginErrorMessage}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                อีเมล
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#1c5d41] focus:border-transparent outline-none transition text-sm"
                placeholder="name@company.com"
                required
              />
            </div>
            
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-600">
                  รหัสผ่าน (password)
                </label>

                <button
                  type="button"
                  onClick={handleNavigateToForgotPassword}
                  className="text-xs font-medium text-emerald-500 hover:text-emerald-700 hover:underline"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>

              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none transition focus:border-[#1c5d41] focus:ring-2 focus:ring-[#1c5d41]"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-[#1c5d41] hover:bg-[#154631] text-white font-medium rounded-xl shadow-md transition duration-200 disabled:bg-slate-300 text-sm"
            >
              {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          <p className="mt-5 text-xs text-center text-slate-600">
            ยังไม่มีบัญชีองค์กร?{" "}
            <button
              type="button"
              onClick={handleNavigateToRegister}
              className="text-[#1c5d41] hover:underline font-semibold"
            >
              สมัครสมาชิก
            </button>
          </p>
        </div>
      </div>
    </Modal>
  );
}