"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

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

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ กรุณาลองใหม่อีกครั้ง";
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

const STORAGE_KEY = "pw_reset_expiry_time";
const FLOW_KEY = "is_in_reset_flow";
const TEN_MINUTES_MS = 10 * 60 * 1000; // 10 นาที (600 วินาที)

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<"request" | "reset" | "success">(
    "request"
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [timeLeft, setTimeLeft] = useState(600);

  // ระบบนับถอยหลัง 10 นาที (อิงจากเวลาจริง และจำค่าไว้แม้รีเฟรชหน้าเว็บ)
  useEffect(() => {
    if (step !== "reset") return;

    let expiryTime = sessionStorage.getItem(STORAGE_KEY);

    if (!expiryTime) {
      expiryTime = (Date.now() + TEN_MINUTES_MS).toString();
      sessionStorage.setItem(STORAGE_KEY, expiryTime);
    }

    const targetTime = parseInt(expiryTime, 10);

    const updateTimer = () => {
      const now = Date.now();
      const remainingSecs = Math.max(0, Math.floor((targetTime - now) / 1000));
      setTimeLeft(remainingSecs);

      if (remainingSecs === 0) {
        clearInterval(timer);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [step]);

  // ตรวจสอบสถานะและลิงก์กู้คืนรหัสผ่าน (รองรับการกดรีเฟรชหน้าเว็บไม่ให้เด้งกลับ)
  useEffect(() => {
    let mounted = true;
    let recoveryDetected = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY") {
        recoveryDetected = true;
        setStep("reset");
        setErrorMessage("");
        setSuccessMessage("");
        sessionStorage.setItem(FLOW_KEY, "true");

        if (!sessionStorage.getItem(STORAGE_KEY)) {
          sessionStorage.setItem(STORAGE_KEY, (Date.now() + TEN_MINUTES_MS).toString());
        }
      }
    });

    const checkRecoveryUrl = async () => {
      try {
        const hash = window.location.hash;

        if (hash) {
          const params = new URLSearchParams(hash.replace(/^#/, ""));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          const type = params.get("type");

          if (
            type === "recovery" &&
            accessToken &&
            refreshToken
          ) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) throw error;

            if (mounted) {
              recoveryDetected = true;
              setStep("reset");
              setErrorMessage("");
              sessionStorage.setItem(FLOW_KEY, "true");

              if (!sessionStorage.getItem(STORAGE_KEY)) {
                sessionStorage.setItem(STORAGE_KEY, (Date.now() + TEN_MINUTES_MS).toString());
              }

              window.history.replaceState(
                null,
                "",
                window.location.pathname + window.location.search
              );
            }

            return;
          }
        }

        // ตรวจสอบ Session ปัจจุบัน
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted || recoveryDetected) return;

        // ถ้าผู้ใช้เคยเข้ามาถูกต้องแล้ว และกดรีเฟรชหน้าเว็บ (ยังมี session และอยู่ใน Flow reset)
        const isInResetFlow = sessionStorage.getItem(FLOW_KEY) === "true";
        if (isInResetFlow && data.session) {
          // ตรวจสอบว่าหมดอายุหรือยัง
          const expiryTime = sessionStorage.getItem(STORAGE_KEY);
          if (expiryTime) {
            const targetTime = parseInt(expiryTime, 10);
            if (Date.now() >= targetTime) {
              sessionStorage.removeItem(STORAGE_KEY);
              sessionStorage.removeItem(FLOW_KEY);
              await supabase.auth.signOut();
              setStep("request");
              return;
            }
          }

          setStep("reset");
          return;
        }

        setStep("request");
      } catch (error: unknown) {
        console.error("Check recovery session error:", error);

        if (mounted) {
          setStep("request");
          setErrorMessage(
            "ลิงก์ตั้งรหัสผ่านอาจหมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่จากหน้าเข้าสู่ระบบ"
          );
        }
      }
    };

    void checkRecoveryUrl();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // STEP 1: ส่งอีเมลเพื่อขอตั้งรหัสผ่านใหม่
  const handleRequestReset = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // ล้างค่าเก่าทิ้งเมื่อขอลิงก์ใหม่
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(FLOW_KEY);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("กรุณากรอกอีเมล");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/organization/forgot_password`,
        }
      );

      if (error) throw error;

      setSuccessMessage(
        "ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบอีเมล"
      );
    } catch (error: unknown) {
      console.error("Request reset error:", error);
      setErrorMessage(
        `ไม่สามารถส่งอีเมลได้: ${getErrorMessage(error)}`
      );
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: ตั้งรหัสผ่านใหม่
  const handleUpdatePassword = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!validatePassword(password)) {
      setErrorMessage(
        "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรภาษาอังกฤษกับตัวเลข"
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);

    try {
      const { data, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!data.session) {
        throw new Error(
          "ไม่พบ session สำหรับตั้งรหัสผ่านใหม่ กรุณาขอลิงก์ใหม่จากหน้าเข้าสู่ระบบ"
        );
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      // เคลียร์ค่า Session Storage ทั้งหมดเมื่อทำรายการสำเร็จ
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(FLOW_KEY);

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        console.error(
          "Sign out after password reset error:",
          signOutError
        );
      }

      setPassword("");
      setConfirmPassword("");
      setStep("success");
      setSuccessMessage(
        "เปลี่ยนรหัสผ่านสำเร็จแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่"
      );
    } catch (error: unknown) {
      console.error("Update password error:", error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white w-full max-w-lg rounded-3xl p-8 lg:p-10 shadow-xl border border-slate-200/85 mx-auto my-10">
      {/* STEP 1: ขอส่งลิงก์เปลี่ยนรหัสผ่าน */}
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

          <div className="space-y-1.5">
            <label
              htmlFor="reset-email"
              className="text-xs font-bold text-slate-700"
            >
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
                  setSuccessMessage("");
                }}
                className="w-full px-4 py-3 pl-10 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 text-slate-800"
              />
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#1F3E35] hover:bg-[#152C25] disabled:opacity-60 text-white font-semibold rounded-2xl text-sm transition shadow-md flex items-center justify-center space-x-2"
          >
            <span>
              {loading ? "กำลังส่งลิงก์..." : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
            </span>
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

      {/* STEP 2: ตั้งรหัสผ่านใหม่ */}
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

            {/* แสดงเวลานับถอยหลัง */}
            <div className="pt-2 flex justify-center">
              <div
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  timeLeft > 60
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-red-50 text-red-600 border border-red-200 animate-pulse"
                }`}
              >
                ลิงก์นี้จะหมดอายุใน {formatTime(timeLeft)} นาที
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl text-center font-medium break-words">
              {errorMessage}
            </div>
          )}

          {/* เงื่อนไขเมื่อเวลาหมด (timeLeft === 0) */}
          {timeLeft === 0 ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl text-center space-y-3">
              <p className="font-bold text-sm">ลิงก์เปลี่ยนรหัสผ่านหมดอายุแล้ว</p>
              <p className="text-slate-500">
                กรุณาขอลิงก์ใหม่อีกครั้งเพื่อความปลอดภัย
              </p>
              <button
                type="button"
                onClick={async () => {
                  sessionStorage.removeItem(STORAGE_KEY);
                  sessionStorage.removeItem(FLOW_KEY);
                  await supabase.auth.signOut();
                  setPassword("");
                  setConfirmPassword("");
                  setErrorMessage("");
                  setSuccessMessage("");
                  setStep("request");
                }}
                className="block w-full py-3 bg-[#1F3E35] hover:bg-[#152C25] text-white rounded-xl font-semibold transition cursor-pointer"
              >
                ขอลิงก์ใหม่อีกครั้ง
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="new-password"
                    className="text-xs font-bold text-slate-700"
                  >
                    รหัสผ่านใหม่
                  </label>

                  <div className="relative">
                    <input
                      id="new-password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="อย่างน้อย 8 ตัวอักษร มีตัวอักษรและตัวเลข"
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setPassword(e.target.value);
                        setErrorMessage("");
                      }}
                      className="w-full px-4 py-3 pl-10 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 text-slate-800"
                    />
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="confirm-password"
                    className="text-xs font-bold text-slate-700"
                  >
                    ยืนยันรหัสผ่านใหม่
                  </label>

                  <div className="relative">
                    <input
                      id="confirm-password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                      value={confirmPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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
                {loading
                  ? "กำลังบันทึกรหัสผ่านใหม่..."
                  : "บันทึกรหัสผ่านใหม่"}
              </button>
            </>
          )}
        </form>
      )}

      {/* STEP 3: ทำรายการสำเร็จ */}
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
              {successMessage ||
                "รหัสผ่านของคุณถูกอัปเดตเรียบร้อยแล้ว"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem(STORAGE_KEY);
              sessionStorage.removeItem(FLOW_KEY);
              router.replace("/organization/login");
            }}
            className="w-full py-3.5 bg-[#1F3E35] text-white font-semibold rounded-2xl text-sm hover:bg-[#152C25] transition shadow-md"
          >
            ไปที่หน้าเข้าสู่ระบบ
          </button>
        </div>
      )}
    </div>
  );
}