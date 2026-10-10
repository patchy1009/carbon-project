"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Mail,
  Lock,
  ChevronDown,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const industries = [
  "สำนักงานและบริการทั่วไป",
  "การผลิต อุตสาหกรรม และแปรรูป",
  "การขนส่ง โลจิสติกส์ และคลังสินค้า",
  "โรงแรม การท่องเที่ยว งานบริการ",
  "ค้าปลีก ค้าส่ง และการจัดการสินค้า",
  "ก่อสร้าง อสังหาริมทรัพย์ และโครงสร้างพื้นฐาน",
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ กรุณาลองใหม่อีกครั้ง";
}

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<"form" | "otp" | "success">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState(industries[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // STEP 1: Create Supabase Auth account and send signup confirmation OTP.
  // (ยังไม่มีการบันทึกข้อมูลเข้าตาราง Database จนกว่าจะผ่าน OTP)
  const handleSendOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCompanyName = companyName.trim();

    if (!normalizedEmail || !password || !normalizedCompanyName) {
      setErrorMessage("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    // Require at least 8 characters, including an English letter and a digit.
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
      setErrorMessage("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรภาษาอังกฤษกับตัวเลข");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            company_name: normalizedCompanyName,
            industry,
          },
        },
      });

      if (error) throw error;

      setEmail(normalizedEmail);
      setCompanyName(normalizedCompanyName);
      setOtpInput("");
      setStep("otp");
      setSuccessMessage("ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบ Inbox และ Spam");
    } catch (error: unknown) {
      console.error("Register error:", error);
      const message = getErrorMessage(error);

      if (message.toLowerCase().includes("already registered")) {
        setErrorMessage("อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ");
      } else {
        setErrorMessage(`ไม่สามารถสมัครสมาชิกได้: ${message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP, and insert user & organization records directly matching schema
  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const token = otpInput.trim();

    if (!/^\d{6}$/.test(token)) {
      setErrorMessage("กรุณากรอกรหัส OTP ให้ครบ 6 หลัก");
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // 1. ยืนยัน OTP ผ่าน Supabase Auth
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token,
        type: "signup",
      });

      if (error) throw error;

      const authUser = data.user;
      if (!authUser || !data.session) {
        throw new Error("ยืนยัน OTP ไม่สำเร็จหรือไม่มี session ที่ยืนยันตัวตนแล้ว จึงยังไม่บันทึกข้อมูล");
      }

      const metadata = authUser.user_metadata ?? {};
      const company = metadata.company_name || companyName.trim();
      const bizType = metadata.industry || industry;

      // 2. บันทึกข้อมูลลงตาราง public.user ตาม Schema
      const { error: userError } = await supabase
        .from("user")
        .insert({
          acc_id: authUser.id,
          email: normalizedEmail,
          username: normalizedEmail.split("@")[0], // สร้าง username เริ่มต้นจากส่วนหน้าของ email
          role: "organization",
          status: "active",
        });

      if (userError) {
        throw new Error(`บันทึกข้อมูลผู้ใช้ไม่สำเร็จ: ${userError.message}`);
      }

      // 3. บันทึกข้อมูลลงตาราง public.organization ตาม Schema
      const { error: organizationError } = await supabase
        .from("organization")
        .insert({
          acc_id: authUser.id,
          org_name: company,
          business_type: bizType,
        });

      if (organizationError) {
        throw new Error(
          `ยืนยันอีเมลสำเร็จ แต่บันทึกข้อมูลองค์กรไม่สำเร็จ: ${organizationError.message}`
        );
      }

      setStep("success");
      setSuccessMessage("ยืนยันอีเมลและบันทึกข้อมูลองค์กรเรียบร้อยแล้ว");
    } catch (error: unknown) {
      const details = error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error && typeof error === "object"
          ? Object.fromEntries(
            ["message", "code", "status", "details", "hint"].flatMap((key) =>
              key in error ? [[key, (error as Record<string, unknown>)[key]]] : []
            )
          )
          : { message: String(error) };
      console.error("Verify OTP error details:", details);
      setErrorMessage(`ยืนยัน OTP ไม่สำเร็จ: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
      });

      if (error) throw error;

      setOtpInput("");
      setSuccessMessage("ส่ง OTP ใหม่ไปยังอีเมลของคุณแล้ว");
    } catch (error: unknown) {
      console.error("Resend OTP error:", error);
      setErrorMessage(`ไม่สามารถส่ง OTP ใหม่ได้: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToForm = () => {
    setErrorMessage("");
    setSuccessMessage("");
    setOtpInput("");
    setStep("form");
  };

  const handleGoDashboard = () => {
    router.push("/organization/dashboard");
  };

  return (
    <div className="bg-white w-full max-w-lg rounded-3xl p-8 lg:p-10 shadow-xl border border-slate-200/85">
      {step === "form" && (
        <form onSubmit={handleSendOtp} className="space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-[#11221C]">
              ลงทะเบียนองค์กร
            </h1>
            <p className="text-xs text-slate-500">
              สร้างบัญชีองค์กรเพื่อเริ่มบริหารจัดการการปล่อยก๊าซเรือนกระจก
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl text-center font-medium break-words">
              {errorMessage}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="register-email" className="text-xs font-bold text-slate-700">
                อีเมล (email)
              </label>
              <div className="relative">
                <input
                  id="register-email"
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

            <div className="space-y-1.5">
              <label htmlFor="register-password" className="text-xs font-bold text-slate-700">
                รหัสผ่าน (password)
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
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
              <label htmlFor="register-company" className="text-xs font-bold text-slate-700">
                ชื่อองค์กร / บริษัท
              </label>
              <div className="relative">
                <input
                  id="register-company"
                  type="text"
                  required
                  placeholder="บริษัท ตัวอย่าง จำกัด"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    setErrorMessage("");
                  }}
                  className="w-full px-4 py-3 pl-10 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 text-slate-800"
                />
                <Building2 className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-slate-700">
                ประเภทอุตสาหกรรม
              </label>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((open) => !open)}
                aria-expanded={isDropdownOpen}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm bg-slate-50/50 flex items-center justify-between cursor-pointer text-slate-800"
              >
                <span>{industry}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg z-30 overflow-hidden">
                  {industries.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => {
                        setIndustry(item);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-medium transition ${
                        industry === item
                          ? "bg-[#1F3E35] text-white"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#1F3E35] hover:bg-[#152C25] disabled:opacity-60 text-white font-semibold rounded-2xl text-sm transition shadow-md flex items-center justify-center space-x-2"
          >
            <span>
              {loading ? "กำลังส่งรหัส OTP ไปที่อีเมล..." : "ถัดไป: ยืนยันอีเมล"}
            </span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="space-y-6 text-center">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">
              ตรวจสอบอีเมลของคุณ
            </h2>
            <p className="text-xs text-slate-500">
              ระบบได้ส่งรหัสยืนยัน 6 หลักไปที่อีเมลของคุณแล้ว
              <br />
              <strong className="text-slate-800">{email}</strong>
            </p>
            <p className="text-[11px] text-amber-700 bg-amber-50 py-1.5 px-3 rounded-xl inline-block border border-amber-200">
              กรุณาตรวจสอบกล่องข้อความ Inbox และ Spam
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium break-words">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-medium break-words">
              {successMessage}
            </div>
          )}

          <div className="max-w-xs mx-auto">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoComplete="one-time-code"
              aria-label="รหัส OTP 6 หลัก"
              placeholder="• • • • • •"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
              className="w-full text-center tracking-[0.8em] text-xl font-bold py-3.5 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50 text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#1F3E35] hover:bg-[#152C25] disabled:opacity-60 text-white font-semibold rounded-2xl text-sm transition shadow-md"
          >
            {loading ? "กำลังตรวจสอบรหัส OTP..." : "ยืนยันและสมัครสมาชิก"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleResendOtp}
            className="text-[11px] text-[#1c5d41] font-semibold hover:underline disabled:opacity-50"
          >
            ส่ง OTP ใหม่อีกครั้ง
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleBackToForm}
            className="block mx-auto text-[11px] text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            ← กลับไปแก้ไขข้อมูล
          </button>
        </form>
      )}

      {step === "success" && (
        <div className="text-center space-y-6 py-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">
              ลงทะเบียนสำเร็จ!
            </h2>
            <p className="text-xs text-slate-500">
              {successMessage ||
                "บัญชีองค์กรของคุณได้รับการยืนยันอีเมลและบันทึกเรียบร้อยแล้ว"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoDashboard}
            className="w-full py-3.5 bg-[#1F3E35] text-white font-semibold rounded-2xl text-sm hover:bg-[#152C25] transition shadow-md flex items-center justify-center space-x-2"
          >
            <UserCheck className="w-4 h-4" />
            <span>เข้าสู่หน้า Dashboard</span>
          </button>
        </div>
      )}
    </div>
  );
}