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

  // =====================================================
  // STEP 1 : ตรวจ Email + สมัครสมาชิก + ส่ง OTP
  // =====================================================
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!email || !password || !companyName) {
      setErrorMessage("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setLoading(true);

    try {
      // 1. เช็ก Email ใน organizations ก่อน
      const { data: existingOrganization, error: checkError } = await supabase
        .from("organizations")
        .select("email")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existingOrganization) {
        setErrorMessage("อีเมลนี้มีบัญชีองค์กรอยู่แล้ว กรุณาเข้าสู่ระบบ");
        return;
      }

      // 2. สร้าง Supabase Auth User
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            company_name: companyName,
            industry: industry,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("ไม่สามารถสร้างบัญชีได้");
      }

      if (data.session) {
        await supabase.auth.signOut();
        setErrorMessage(
          "กรุณาเปิด Confirm Email ใน Supabase ก่อนใช้งานระบบ OTP"
        );
        return;
      }

      // ไปหน้า OTP
      setStep("otp");
      setSuccessMessage("ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว");
    } catch (error: any) {
      console.error("Register error:", error);
      const message = error?.message || "";

      if (message.toLowerCase().includes("already registered")) {
        setErrorMessage("อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ");
      } else {
        setErrorMessage(
          message || "ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // STEP 2 : ยืนยัน OTP
  // =====================================================
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (otpInput.length !== 6) {
      setErrorMessage("กรุณากรอกรหัส OTP ให้ครบ 6 หลัก");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otpInput,
        type: "signup",
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("ไม่พบข้อมูลผู้ใช้");
      }

      const { error: organizationError } = await supabase
        .from("organizations")
        .insert({
          email: email.trim().toLowerCase(),
          company_name: companyName,
          industry: industry,
        });

      if (organizationError) {
        throw organizationError;
      }

      setStep("success");
    } catch (error: any) {
      console.error("Verify OTP error:", error);
      setErrorMessage(
        error?.message || "รหัส OTP ไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่อีกครั้ง"
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // ส่ง OTP ใหม่
  // =====================================================
  const handleResendOtp = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
      });

      if (error) {
        throw error;
      }

      setOtpInput("");
      setSuccessMessage("ส่ง OTP ใหม่ไปยังอีเมลของคุณแล้ว");
    } catch (error: any) {
      console.error("Resend OTP error:", error);
      setErrorMessage(
        error?.message || "ไม่สามารถส่ง OTP ใหม่ได้ กรุณาลองใหม่อีกครั้ง"
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // กลับไปแก้ข้อมูล
  // =====================================================
  const handleBackToForm = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setOtpInput("");

    await supabase.auth.signOut();
    setStep("form");
  };

  // =====================================================
  // ไป Dashboard
  // =====================================================
  const handleGoDashboard = () => {
    router.push("/organization/dashboard");
  };

  return (
    <div className="bg-white w-full max-w-lg rounded-3xl p-8 lg:p-10 shadow-xl border border-slate-200/85">
      {/* STEP 1 : REGISTER FORM */}
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
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl text-center font-medium">
              {errorMessage}
            </div>
          )}

          <div className="space-y-4">
            {/* EMAIL */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                อีเมล (email)
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
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

            {/* PASSWORD */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                รหัสผ่าน (password)
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
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

            {/* COMPANY */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                ชื่อองค์กร / บริษัท
              </label>
              <div className="relative">
                <input
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

            {/* INDUSTRY */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-slate-700">
                ประเภทอุตสาหกรรม
              </label>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
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

      {/* STEP 2 : OTP */}
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
              💡 กรุณาตรวจสอบกล่องข้อความ (Inbox / Spam)
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-medium">
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
              placeholder="• • • • • •"
              value={otpInput}
              onChange={(e) =>
                setOtpInput(e.target.value.replace(/\D/g, ""))
              }
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
            className="block mx-auto text-[11px] text-slate-400 hover:text-slate-600"
          >
            ← กลับไปแก้ไขข้อมูล
          </button>
        </form>
      )}

      {/* STEP 3 : SUCCESS */}
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
              บัญชีองค์กรของคุณได้รับการยืนยันอีเมลและบันทึกเรียบร้อยแล้ว
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