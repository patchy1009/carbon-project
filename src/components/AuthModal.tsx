"use client";

import React, { useEffect, useState } from "react";
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
  RefreshCw,
  User,
} from "lucide-react";
import Modal from "./Modal";
import { supabase } from "@/lib/supabaseClient";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
}

const industries = [
  "สำนักงานและบริการทั่วไป",
  "การผลิต อุตสาหกรรม และแปรรูป",
  "การขนส่ง โลจิสติกส์ และคลังสินค้า",
  "โรงแรม การท่องเที่ยว งานบริการ",
  "ค้าปลีก ค้าส่ง และการจัดการสินค้า",
  "ก่อสร้าง อสังหาริมทรัพย์ และโครงสร้างพื้นฐาน",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ กรุณาลองใหม่อีกครั้ง";
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = "login",
}: AuthModalProps) {
  const router = useRouter();
  // ควบคุมสเตปภายใน Modal ("login" | "register" | "otp" | "success")
  const [step, setStep] = useState<"login" | "register" | "otp" | "success">(initialMode);

  // State ฝั่ง Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrorMessage, setLoginErrorMessage] = useState("");

  // State ฝั่ง Register
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState(industries[0]);
  
  const [fieldErrors, setFieldErrors] = useState({
    username: "",
    email: "",
    password: "",
    companyName: "",
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [resendTimer, setResendTimer] = useState(300);
  const [canResend, setCanResend] = useState(false);

  // รีเซ็ตค่าเมื่อเปิด/ปิด Modal
  useEffect(() => {
    if (isOpen) {
      setStep(initialMode);
      setLoginErrorMessage("");
      setErrorMessage("");
      setSuccessMessage("");
      setFieldErrors({ username: "", email: "", password: "", companyName: "" });
    }
  }, [isOpen, initialMode]);

  // ตัวนับเวลาถอยหลัง OTP
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (step === "otp" && resendTimer > 0) {
      setCanResend(false);
      timer = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, resendTimer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 1. ฟังก์ชันจัดการ Login
  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginErrorMessage("");
    if (!loginEmail.trim() || !loginPassword) {
      setLoginErrorMessage("กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });
      if (error) throw error;
      if (!data.user) throw new Error("ไม่พบข้อมูลผู้ใช้งาน");

      const { data: userData, error: userError } = await supabase
        .from("user")
        .select("role")
        .eq("acc_id", data.user.id)
        .single();

      if (userError || !userData) throw new Error("ไม่พบข้อมูลสิทธิ์การใช้งานในระบบ");

      onClose();
      if (userData.role === "admin") {
        router.push("/admin/recommendation");
      } else {
        router.push("/organization/dashboard");
      }
    } catch (err: unknown) {
      setLoginErrorMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // 2. ฟังก์ชันส่ง OTP (สมัครสมาชิกผ่าน API)
  const handleSendOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCompanyName = companyName.trim();

    let errors = {
      username: "",
      email: "",
      password: "",
      companyName: "",
    };

    let hasError = false;

    if (!cleanUsername) {
      errors.username = "กรุณากรอกชื่อผู้ใช้งาน";
      hasError = true;
    } else if (!USERNAME_REGEX.test(cleanUsername)) {
      errors.username = "Username ต้องมีความยาว 3-20 ตัวอักษรภาษาอังกฤษ, ตัวเลข, _ , -";
      hasError = true;
    }

    if (!cleanEmail) {
      errors.email = "กรุณากรอกอีเมล";
      hasError = true;
    } else if (!EMAIL_REGEX.test(cleanEmail)) {
      errors.email = "รูปแบบอีเมลไม่ถูกต้อง เช่น name@company.co.th";
      hasError = true;
    }

    if (!password) {
      errors.password = "กรุณากรอกรหัสผ่าน";
      hasError = true;
    } else if (!PASSWORD_REGEX.test(password)) {
      errors.password = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีตัวอักษรกับตัวเลขผสมกัน";
      hasError = true;
    }

    if (!cleanCompanyName) {
      errors.companyName = "กรุณากรอกชื่อองค์กรหรือบริษัท";
      hasError = true;
    }

    setFieldErrors(errors);

    if (hasError) {
      setErrorMessage("กรุณาตรวจสอบข้อมูลช่องที่มีกรอบสีแดงให้ถูกต้องครบถ้วน");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          email: cleanEmail,
          password,
          companyName: cleanCompanyName,
          industry,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ไม่สามารถสมัครสมาชิกได้");

      setUsername(cleanUsername);
      setEmail(cleanEmail);
      setCompanyName(cleanCompanyName);
      setOtpInput("");
      setResendTimer(300);
      setCanResend(false);
      setStep("otp");
      setSuccessMessage("ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบอีเมลและกรอกรหัส OTP 6 หลักเพื่อยืนยัน");
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // 3. ฟังก์ชันยืนยัน OTP และบันทึกข้อมูลลงตาราง user & organization
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
      // ก. ยืนยัน OTP กับ Supabase Auth
      const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "signup",
      });
      if (verifyError) throw verifyError;

      // ข. เมื่อยืนยันสำเร็จ บันทึกข้อมูลเข้า Database
      if (authData.user) {
        const userId = authData.user.id;
        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanCompanyName = companyName.trim();

        // บันทึกตาราง user
        const { error: userInsertError } = await supabase.from("user").insert({
          acc_id: userId,
          email: cleanEmail,
          username: cleanUsername,
          role: "organization",
          status: "active",
        });
        if (userInsertError) throw userInsertError;

        // บันทึกตาราง organization
        const { error: orgInsertError } = await supabase.from("organization").insert({
          acc_id: userId,
          org_name: cleanCompanyName,
          business_type: industry,
        });
        if (orgInsertError) throw orgInsertError;
      }

      setStep("success");
      setSuccessMessage("ยืนยันอีเมลและบันทึกข้อมูลองค์กรเรียบร้อยแล้ว");
    } catch (error: unknown) {
      setErrorMessage(`ยืนยัน OTP ไม่สำเร็จ: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || loading) return;
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
      setResendTimer(300);
      setCanResend(false);
      setSuccessMessage("ส่งรหัส OTP ใหม่ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบอีเมลและกรอกรหัส OTP 6 หลักเพื่อยืนยัน");
    } catch (error: unknown) {
      setErrorMessage(`ไม่สามารถส่ง OTP ใหม่ได้: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const getInputClass = (hasError: boolean) =>
    `w-full px-4 py-3 pl-10 rounded-2xl border text-sm focus:outline-none focus:ring-2 bg-slate-50/50 text-slate-800 placeholder:text-slate-400 ${
      hasError
        ? "border-red-500 focus:ring-red-500 bg-red-50/20"
        : "border-slate-200 focus:ring-emerald-700"
    }`;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 lg:p-8 text-left shadow-2xl">
        
        {/* ================= STEP 1: LOGIN ================= */}
        {step === "login" && (
          <div>
            <h2 className="mb-6 text-center text-2xl font-bold text-slate-800">
              เข้าสู่ระบบองค์กร
            </h2>

            {loginErrorMessage && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {loginErrorMessage}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">อีเมล</label>
                <div className="relative">
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 text-slate-800 placeholder:text-slate-400 border-slate-200"
                    placeholder="name@company.com"
                    required
                  />
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">รหัสผ่าน</label>
                <div className="relative">
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 text-slate-800 placeholder:text-slate-400 border-slate-200"
                    placeholder="••••••••"
                    required
                  />
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
                {/* ปุ่มลืมรหัสผ่าน สีเขียวตามตีมแอป ชิดขวาล่างใต้ช่องกรอกรหัสผ่าน */}
                <div className="mt-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push("/organization/forgot_password");
                    }}
                    className="text-xs text-[#2C7A59] hover:underline font-semibold transition"
                  >
                    ลืมรหัสผ่าน?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#2C7A59] px-4 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#1f5a41] disabled:opacity-60 mt-2"
              >
                {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-slate-600">
              ยังไม่มีบัญชีองค์กร?{" "}
              <button
                type="button"
                onClick={() => setStep("register")}
                className="font-semibold text-[#2C7A59] hover:underline"
              >
                สมัครสมาชิก
              </button>
            </p>
          </div>
        )}

        {/* ================= STEP 2: REGISTER FORM ================= */}
        {step === "register" && (
          <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
            <div className="text-center space-y-1 mb-2">
              <h2 className="text-2xl font-extrabold text-[#11221C]">ลงทะเบียนองค์กร</h2>
              <p className="text-xs text-slate-500">สร้างบัญชีองค์กรเพื่อเริ่มบริหารจัดการคาร์บอน</p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl text-center font-medium">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700">ชื่อผู้ใช้งาน (Username)</label>
              <div className="relative mt-1">
                <input
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (fieldErrors.username) setFieldErrors({ ...fieldErrors, username: "" });
                  }}
                  className={getInputClass(!!fieldErrors.username)}
                />
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
              {!fieldErrors.username && (
                <p className="mt-1 text-[11px] text-slate-400">ความยาว 3-20 ตัวอักษร โดยเป็นภาษาอังกฤษ, ตัวเลข, _ , - ได้</p>
              )}
              {fieldErrors.username && (
                <p className="mt-1 text-xs text-red-500 font-medium">{fieldErrors.username}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">อีเมล (email)</label>
              <div className="relative mt-1">
                <input
                  type="email"
                  placeholder="name@company.co.th"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: "" });
                  }}
                  className={getInputClass(!!fieldErrors.email)}
                />
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
              {!fieldErrors.email && (
                <p className="mt-1 text-[11px] text-slate-400">ใช้อีเมลองค์กรที่สามารถรับรหัส OTP ได้</p>
              )}
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-500 font-medium">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">รหัสผ่าน (password)</label>
              <div className="relative mt-1">
                <input
                  type="password"
                  placeholder="อย่างน้อย 8 ตัวอักษร มีตัวอักษรและตัวเลข"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: "" });
                  }}
                  className={getInputClass(!!fieldErrors.password)}
                />
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
              {!fieldErrors.password && (
                <p className="mt-1 text-[11px] text-slate-400">ต้องมีอย่างน้อย 8 ตัวอักษร โดยมีตัวอักษรภาษาอังกฤษและตัวเลขผสมกัน</p>
              )}
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-500 font-medium">{fieldErrors.password}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">ชื่อองค์กร / บริษัท</label>
              <div className="relative mt-1">
                <input
                  type="text"
                  placeholder="บริษัท ตัวอย่าง จำกัด"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    if (fieldErrors.companyName) setFieldErrors({ ...fieldErrors, companyName: "" });
                  }}
                  className={getInputClass(!!fieldErrors.companyName)}
                />
                <Building2 className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
              {!fieldErrors.companyName && (
                <p className="mt-1 text-[11px] text-slate-400">ระบุชื่อบริษัทหรือองค์กรของคุณ</p>
              )}
              {fieldErrors.companyName && (
                <p className="mt-1 text-xs text-red-500 font-medium">{fieldErrors.companyName}</p>
              )}
            </div>

            <div className="relative">
              <label className="text-xs font-bold text-slate-700">ประเภทอุตสาหกรรม</label>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full mt-1 px-4 py-3 rounded-2xl border border-slate-200 text-sm bg-slate-50/50 flex items-center justify-between text-slate-800 font-medium"
              >
                <span>{industry}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              
              {/* ดรอปดาวน์แก้ปัญหาจม/ล้นขอบด้วย max-h-48 overflow-y-auto */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg z-30 py-1 max-h-48 overflow-y-auto">
                  {industries.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => {
                        setIndustry(item);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#2C7A59] hover:bg-[#1f5a41] disabled:opacity-60 text-white font-semibold rounded-2xl text-sm transition shadow-md flex items-center justify-center space-x-2 mt-2"
            >
              <span>{loading ? "กำลังตรวจสอบข้อมูล..." : "ถัดไป: ยืนยันอีเมล"}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>

            <p className="mt-3 text-center text-xs text-slate-600">
              มีบัญชีผู้ใช้อยู่แล้ว?{" "}
              <button
                type="button"
                onClick={() => setStep("login")}
                className="font-semibold text-[#2C7A59] hover:underline"
              >
                เข้าสู่ระบบ
              </button>
            </p>
          </form>
        )}

        {/* ================= STEP 3: OTP ================= */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-5 text-center">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">ตรวจสอบอีเมลของคุณ</h2>
              <p className="text-xs text-slate-500">
                รหัส 6 หลักถูกส่งไปที่ <strong className="text-slate-800">{email}</strong>
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl">
                {successMessage}
              </div>
            )}

            <div className="max-w-xs mx-auto">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="000000"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                className="w-full text-center tracking-[0.6em] text-lg font-bold py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50 text-slate-900"
              />
            </div>

            <button
              type="button"
              disabled={!canResend || loading}
              onClick={handleResendOtp}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline disabled:text-slate-400"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              {canResend ? "ส่งรหัส OTP อีกครั้ง" : `ส่งรหัสอีกครั้งใน ${formatTime(resendTimer)}`}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#2C7A59] hover:bg-[#1f5a41] text-white font-semibold rounded-2xl text-sm transition shadow-md"
            >
              {loading ? "กำลังตรวจสอบ..." : "ยืนยันและสมัครสมาชิก"}
            </button>

            <button
              type="button"
              onClick={() => setStep("register")}
              className="block mx-auto text-xs text-slate-400 hover:text-slate-600"
            >
              ← กลับไปแก้ไขข้อมูล
            </button>
          </form>
        )}

        {/* ================= STEP 4: SUCCESS ================= */}
        {step === "success" && (
          <div className="text-center space-y-5 py-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">ลงทะเบียนสำเร็จ!</h2>
              <p className="text-xs text-slate-500">บัญชีองค์กรของคุณได้รับการยืนยันเรียบร้อยแล้ว</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push("/organization/dashboard");
              }}
              className="w-full py-3.5 bg-[#2C7A59] hover:bg-[#1f5a41] text-white font-semibold rounded-2xl text-sm transition shadow-md flex items-center justify-center space-x-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>เข้าสู่หน้า Dashboard</span>
            </button>
          </div>
        )}

      </div>
    </Modal>
  );
}