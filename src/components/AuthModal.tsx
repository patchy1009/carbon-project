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

  // State สำหรับฟอร์ม Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrorMessage, setLoginErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ไปหน้าสมัครสมาชิก
  const handleNavigateToRegister = () => {
    setLoginErrorMessage("");
    onClose();
    router.push("/organization/register");
  };

  // ไปหน้ารีเซ็ตรหัสผ่าน
  const handleNavigateToForgotPassword = () => {
    setLoginErrorMessage("");
    onClose();
    router.push("/organization/forgot_password");
  };

  // เข้าสู่ระบบด้วย Supabase
  const handleLoginSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setLoginErrorMessage("");

    if (!loginEmail.trim() || !loginPassword) {
      setLoginErrorMessage("กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน");
      return;
    }

    setIsLoading(true);

    try {
      // 1. เข้าสู่ระบบผ่าน Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("ไม่พบข้อมูลผู้ใช้งาน");
      }

      // 2. ตรวจสอบ Role จากตาราง user
      const { data: userData, error: userError } = await supabase
        .from("user")
        .select("role")
        .eq("acc_id", data.user.id)
        .single();

      if (userError || !userData) {
        throw new Error("ไม่พบข้อมูลสิทธิ์การใช้งานในระบบ");
      }

      // 3. ปิดหน้าต่าง Login
      onClose();

      // 4. เปลี่ยนหน้าตาม Role
      if (userData.role === "admin") {
        router.push("/admin/recommendation");
      } else {
        router.push("/organization/dashboard");
      }
    } catch (err: unknown) {
      console.error("Login error:", err);

      const errorMessage =
        err instanceof Error ? err.message : "";

      if (errorMessage.includes("Invalid login credentials")) {
        setLoginErrorMessage("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      } else if (errorMessage.includes("Too many requests")) {
        setLoginErrorMessage(
          "มีการพยายามเข้าสู่ระบบถี่เกินไป กรุณาลองใหม่อีกครั้งภายหลัง"
        );
      } else {
        setLoginErrorMessage(
          errorMessage ||
            "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div>
          {/* หัวข้อ */}
          <h2 className="mb-4 text-center text-2xl font-bold text-slate-800">
            เข้าสู่ระบบองค์กร
          </h2>

          {/* ข้อความแจ้งเตือน */}
          {loginErrorMessage && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {loginErrorMessage}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* อีเมล */}
            <div>
              <label
                htmlFor="login-email"
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                อีเมล
              </label>

              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#1c5d41] focus:ring-2 focus:ring-[#1c5d41]"
                placeholder="name@company.com"
                required
              />
            </div>

            {/* รหัสผ่าน */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-600"
                >
                  รหัสผ่าน
                </label>

                <button
                  type="button"
                  onClick={handleNavigateToForgotPassword}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>

              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#1c5d41] focus:ring-2 focus:ring-[#1c5d41]"
                placeholder="••••••••"
                required
              />
            </div>

            {/* ปุ่มเข้าสู่ระบบ */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-[#1c5d41] px-4 py-3 text-sm font-medium text-white shadow-md transition duration-200 hover:bg-[#154631] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isLoading
                ? "กำลังเข้าสู่ระบบ..."
                : "เข้าสู่ระบบ"}
            </button>
          </form>

          {/* สมัครสมาชิก */}
          <p className="mt-5 text-center text-xs text-slate-600">
            ยังไม่มีบัญชีองค์กร?{" "}
            <button
              type="button"
              onClick={handleNavigateToRegister}
              className="font-semibold text-[#1c5d41] hover:underline"
            >
              สมัครสมาชิก
            </button>
          </p>
        </div>
      </div>
    </Modal>
  );
}