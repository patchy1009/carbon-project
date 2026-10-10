"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, ShieldCheck, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ตรวจสอบความแข็งแกร่งของรหัสผ่าน
function validatePassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ กรุณาลองใหม่อีกครั้ง";
}

export default function ForgotPasswordPage() {
  const router = useRouter();

  // สถานะขั้นตอน: 'request' (กรอกอีเมล) | 'reset' (ตั้งรหัสผ่านใหม่) | 'success' (สำเร็จ)
  const [step, setStep] = useState<"request" | "reset" | "success">("request");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // ดักจับว่าผู้ใช้กดเข้ามาจากลิงก์ในอีเมลหรือไม่ (Supabase จะแนบ Session หรือ Event PASSWORD_RECOVERY มา)
  useEffect(() => {
    const checkRecoverySession = async () => {
      // 1. ตรวจสอบว่ามี Event การกู้คืนรหัสผ่านหรือไม่
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setStep("reset");
        }
      });

      // 2. เช็ก Session ปัจจุบัน
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // หากกดเข้ามาจากลิงก์ Reset Password ในอีเมล จะสลับไปหน้าตั้งรหัสผ่านใหม่อัตโนมัติ
        setStep("reset");
      }

      return () => {
        authListener.subscription.unsubscribe();
      };
    };

    checkRecoverySession();
  }, []);

  // STEP 1: ส่งอีเมลเพื่อขอตั้งรหัสผ่านใหม่
  const handleRequestReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage("กรุณากรอกอีเมล");
      return;
    }

    setLoading(true);

    try {
      // ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมล (ระบุ URL หน้าปัจจุบันกลับมา)
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/organization/forgot_password`,
      });

      if (error) throw error;

      setSuccessMessage("ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบ Inbox หรือ Spam");
    } catch (error: unknown) {
      console.error("Request reset error:", error);
      setErrorMessage(`ไม่สามารถส่งอีเมลได้: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: ตั้งรหัสผ่านใหม่และอัปเดตลง Supabase
  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!validatePassword(password)) {
      setErrorMessage("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรภาษาอังกฤษกับตัวเลข");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);

    try {
      // อัปเดตรหัสผ่านใหม่ของผู้ใช้ใน Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setStep("success");
      setSuccessMessage("เปลี่ยนรหัสผ่านสำเร็จแล้ว คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที");
    } catch (error: unknown) {
      console.error("Update password error:", error);
      setErrorMessage(`ไม่สามารถเปลี่ยนรหัสผ่านได้: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white w-full max-w-lg rounded-3xl p-8 lg:p-10 shadow-xl border border-slate-200/85 mx-auto my-10">
      {/* ----------------- STEP 1: ขอส่งลิงก์เปลี่ยนรหัสผ่าน ----------------- */}
      {step === "request" && (
        <form onSubmit={handleRequestReset} className="space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-[#11221C]">
              ลืมรหัสผ่าน
            </h1>
            <p className="text-xs text-slate-500">
              กรอกอีเมลที่ใช้ลงทะเบียน เพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl text-center font-medium break-words">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl text-center font-medium break-words">
              {successMessage}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="text-xs font-bold text-slate-700">
                อีเมล (email)
              </label>
              <div className="relative">
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@company.co.th"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage("");
                  }}
                  className="w-full px-4 py-3 pl-10 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 text-slate-800"
                />
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#1F3E35] hover:bg-[#152C25] disabled:opacity-60 text-white font-semibold rounded-2xl text-sm transition shadow-md flex items-center justify-center space-x-2"
          >
            <span>{loading ? "กำลังส่งลิงก์..." : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

          <div className="text-center pt-2">
            <Link
              href="/organization/login"
              className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>กลับไปหน้าเข้าสู่ระบบ</span>
            </Link>
          </div>
        </form>
      )}

      {/* ----------------- STEP 2: ตั้งรหัสผ่านใหม่ ----------------- */}
      {step === "reset" && (
        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center mb-2">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-[#11221C]">
              ตั้งรหัสผ่านใหม่
            </h1>
            <p className="text-xs text-slate-500">
              กรุณากำหนดรหัสผ่านใหม่สำหรับบัญชีของคุณ
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl text-center font-medium break-words">
              {errorMessage}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-xs font-bold text-slate-700">
                รหัสผ่านใหม่
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="อย่างน้อย 8 ตัวอักษร มีตัวอักษรและตัวเลข"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage("");
                  }}
                  className="w-full px-4 py-3 pl-10 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 text-slate-800"
                />
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-xs font-bold text-slate-700">
                ยืนยันรหัสผ่านใหม่
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrorMessage("");
                  }}
                  className="w-full px-4 py-3 pl-10 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 text-slate-800"
                />
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#1F3E35] hover:bg-[#152C25] disabled:opacity-60 text-white font-semibold rounded-2xl text-sm transition shadow-md"
          >
            {loading ? "กำลังบันทึกรหัสผ่านใหม่..." : "บันทึกรหัสผ่านใหม่"}
          </button>
        </form>
      )}

      {/* ----------------- STEP 3: ทำรายการสำเร็จ ----------------- */}
      {step === "success" && (
        <div className="text-center space-y-6 py-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">
              เปลี่ยนรหัสผ่านสำเร็จ!
            </h2>
            <p className="text-xs text-slate-500">
              {successMessage || "รหัสผ่านของคุณถูกอัปเดตเรียบร้อยแล้ว"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/organization/login")}
            className="w-full py-3.5 bg-[#1F3E35] text-white font-semibold rounded-2xl text-sm hover:bg-[#152C25] transition shadow-md"
          >
            ไปที่หน้าเข้าสู่ระบบ
          </button>
        </div>
      )}
    </div>
  );
}