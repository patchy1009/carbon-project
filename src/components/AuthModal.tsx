"use client";

/*
 * กล่อง (Modal) เข้าสู่ระบบ / สมัครสมาชิก / ขอลิงก์รีเซ็ตรหัสผ่าน (TOR ข้อ 1, 2, 3.2)
 * กล่องเดียวทำงานหลาย "ขั้น" (state ชื่อ step):
 *   login    เข้าสู่ระบบ: ส่งไปที่ /api/auth/login (server ตรวจรหัสผ่าน สถานะบัญชี และ role)
 *            ผู้ดูแลระบบไป /admin/ef-gwp  องค์กรไป /organization/dashboard
 *   register กรอกข้อมูลสมัคร: ตรวจช่องที่กรอก (รูปแบบ + Syntax คล้าย SQL) แล้วส่งไป /api/auth/register
 *   otp      กรอกรหัส OTP 6 หลักที่ส่งไปทางอีเมล (ส่งซ้ำได้เมื่อครบเวลา) ยืนยันแล้วบันทึกตาราง user และ organization
 *   success  สมัครสำเร็จ
 *   forgot   กรอกอีเมลเพื่อรับลิงก์ตั้งรหัสผ่านใหม่ ลิงก์พาไปหน้า /organization/forgot_password
 * ฟอร์มสมัครสมาชิกมีที่นี่ที่เดียว เปิดได้ 2 ทาง: ปุ่มเมนูด้านบน (organization/layout.tsx)
 * และหน้า /organization/register ซึ่งเปิดกล่องนี้ในโหมด register (register/RegisterClient.tsx)
 */

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
  ArrowLeft,
} from "lucide-react";
import Modal from "./Modal";
import { supabase } from "@/lib/supabaseClient";
import { containsSqlSyntax } from "@/lib/sqlSyntax"; // ตรวจ Syntax ป้องกัน SQL Injection
import { getErrorMessage } from "@/lib/errorMessage";
import { EMAIL_REGEX, USERNAME_REGEX, PASSWORD_HINT, validatePasswordStrength } from "@/lib/authRules";
import { industries } from "@/types/industries";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = "login",
}: AuthModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "register" | "otp" | "success" | "forgot">(initialMode);

  // State ฝั่ง Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrorMessage, setLoginErrorMessage] = useState("");

  // State ฝั่ง Forgot Password
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

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
  const canResend = resendTimer === 0; // ครบเวลานับถอยหลังแล้วจึงขอ OTP ใหม่ได้

  // รีเซ็ตค่าเมื่อเปิด/ปิด Modal
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ล้างค่าเก่าในฟอร์มทุกครั้งที่เปิด Modal
      setStep(initialMode);
      setLoginErrorMessage("");
      setErrorMessage("");
      setSuccessMessage("");
      setForgotEmail("");
      setForgotMessage("");
      setForgotError("");
      setFieldErrors({ username: "", email: "", password: "", companyName: "" });
    }
  }, [isOpen, initialMode]);

  // ตัวนับเวลาถอยหลัง OTP
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (step === "otp" && resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
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

  // 1. เข้าสู่ระบบ: ตรวจช่องที่กรอก แล้วส่งให้ /api/auth/login
  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginErrorMessage("");
    if (!loginEmail.trim() || !loginPassword) {
      setLoginErrorMessage("กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน");
      return;
    }
    // ตรวจ Syntax คล้ายคำสั่ง SQL ก่อนส่งไปล็อกอิน (TOR 2.2) รหัสผ่านใช้โหมด lenient
    if (containsSqlSyntax(loginEmail.trim()) || containsSqlSyntax(loginPassword, { lenient: true })) {
      setLoginErrorMessage("ข้อมูลที่กรอกมีรูปแบบที่ไม่อนุญาต (คล้ายคำสั่ง SQL) กรุณากรอกใหม่");
      return;
    }
    setLoading(true);
    try {
      // ล็อกอินผ่าน API ฝั่ง server (ไม่ล็อกอินใน browser เอง) เพราะ server ตรวจให้ครบ:
      //   รหัสผ่านถูก -> มีแถวในตาราง user -> status = active -> role ถูกต้อง แล้วบอกหน้าที่ต้องไป (redirectTo) ตาม role
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ไม่สามารถเข้าสู่ระบบได้");

      // รับเฉพาะหน้าที่รู้จัก (กัน redirect ไปที่อื่น)
      const allowed = ["/admin/ef-gwp", "/organization/dashboard"];
      if (!allowed.includes(result.redirectTo)) throw new Error("ไม่สามารถตรวจสอบสิทธิ์ผู้ใช้ได้");

      onClose();
      // session ถูกเขียนลง cookie โดย server -> โหลดหน้าใหม่ทั้งหน้า ให้ navbar (onAuthStateChange) เห็นผู้ใช้ทันที
      window.location.href = result.redirectTo;
    } catch (err: unknown) {
      setLoginErrorMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // 1.1 ขอลิงก์รีเซ็ตรหัสผ่าน: Supabase ส่งลิงก์ (อายุตามที่ตั้งไว้ใน Supabase = 10 นาที) ไปที่อีเมลที่ลงทะเบียน (TOR 3.2)
  const handleForgotPasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setForgotError("");
    setForgotMessage("");

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setForgotError("กรุณากรอกรูปแบบอีเมลให้ถูกต้อง");
      return;
    }
    // ตรวจ Syntax คล้ายคำสั่ง SQL ก่อนส่งอีเมลไปขอลิงก์ (TOR 3.4)
    if (containsSqlSyntax(cleanEmail)) {
      setForgotError("อีเมลมีรูปแบบที่ไม่อนุญาต (คล้ายคำสั่ง SQL) กรุณากรอกใหม่");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        // ลิงก์ในอีเมลพาไปหน้าตั้งรหัสผ่านใหม่ (organization/forgot_password)
        redirectTo: `${window.location.origin}/organization/forgot_password`,
      });
      if (error) throw error;
      setForgotMessage("ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบกล่องข้อความ");
    } catch (err: unknown) {
      setForgotError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // 2. สมัครสมาชิก: ตรวจทุกช่อง (ถ้าผิดจะขึ้นกรอบแดงที่ช่องนั้น) แล้วส่งให้ /api/auth/register ซึ่งจะส่ง OTP ทางอีเมล
  const handleSendOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCompanyName = companyName.trim();

    const errors = {
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
    } else if (containsSqlSyntax(cleanEmail)) {
      // ตรวจ Syntax คล้ายคำสั่ง SQL (ใช้กับอีเมล ชื่อองค์กร และรหัสผ่าน)
      errors.email = "อีเมลมีรูปแบบที่ไม่อนุญาต (คล้ายคำสั่ง SQL) กรุณากรอกใหม่";
      hasError = true;
    }

    if (!password) {
      errors.password = "กรุณากรอกรหัสผ่าน";
      hasError = true;
    } else if (containsSqlSyntax(password, { lenient: true })) {
      // ตรวจ Syntax SQL ก่อนตรวจรูปแบบรหัสผ่าน เพื่อให้รหัสที่เป็นคำสั่ง SQL ถูกปฏิเสธด้วยข้อความนี้เสมอ แม้จะสั้น
      errors.password = "รหัสผ่านมีรูปแบบที่ไม่อนุญาต (คล้ายคำสั่ง SQL) กรุณากรอกใหม่";
      hasError = true;
    } else if (validatePasswordStrength(password)) {
      errors.password = validatePasswordStrength(password);
      hasError = true;
    }

    if (!cleanCompanyName) {
      errors.companyName = "กรุณากรอกชื่อองค์กรหรือบริษัท";
      hasError = true;
    } else if (containsSqlSyntax(cleanCompanyName)) {
      errors.companyName = "ชื่อองค์กรมีรูปแบบที่ไม่อนุญาต (คล้ายคำสั่ง SQL) กรุณากรอกใหม่";
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
      setStep("otp");
      setSuccessMessage("ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบอีเมลและกรอกรหัส OTP 6 หลักเพื่อยืนยัน");
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // 3. ยืนยัน OTP (TOR 1.4) แล้วบันทึกข้อมูลลงตาราง user และ organization
  //    ต้องทำหลังยืนยัน OTP เพราะตอนนั้นผู้ใช้จึงจะล็อกอินแล้ว (RLS อนุญาตเฉพาะเจ้าของแถว)
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
      const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "signup",
      });
      if (verifyError) throw verifyError;

      if (authData.user) {
        const userId = authData.user.id;
        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanCompanyName = companyName.trim();

        const { error: userInsertError } = await supabase.from("user").insert({
          acc_id: userId,
          email: cleanEmail,
          username: cleanUsername,
          role: "organization",
          status: "active",
        });
        if (userInsertError) throw userInsertError;

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

  // ส่ง OTP ใหม่ (ทำได้เมื่อครบเวลานับถอยหลัง)
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
      setSuccessMessage("ส่งรหัส OTP ใหม่ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบอีเมลและกรอกรหัส OTP 6 หลักเพื่อยืนยัน");
    } catch (error: unknown) {
      setErrorMessage(`ไม่สามารถส่ง OTP ใหม่ได้: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // class ของช่องกรอก: มีกรอบแดงเมื่อช่องนั้นมีข้อผิดพลาด
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
              เข้าสู่ระบบ
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
                {/* เปลี่ยนมาใช้การเปลี่ยนสเตปใน Modal เป็น "forgot" */}
                <div className="mt-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => setStep("forgot")}
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
              ยังไม่มีบัญชี?{" "}
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

        {/* ================= STEP FORGOT PASSWORD ================= */}
        {step === "forgot" && (
          <div>
            <div className="text-center space-y-1 mb-6">
              <h2 className="text-2xl font-bold text-slate-800">ลืมรหัสผ่าน</h2>
              <p className="text-xs text-slate-500">กรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน</p>
            </div>

            {forgotError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 text-center">
                {forgotError}
              </div>
            )}
            {forgotMessage && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 text-center">
                {forgotMessage}
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">อีเมลองค์กร</label>
                <div className="relative">
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 text-slate-800 placeholder:text-slate-400 border-slate-200"
                    placeholder="name@company.com"
                    required
                  />
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#2C7A59] px-4 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#1f5a41] disabled:opacity-60 mt-2"
              >
                {loading ? "กำลังส่งคำขอ..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
              </button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setStep("login")}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#2C7A59] hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                กลับไปหน้าเข้าสู่ระบบ
              </button>
            </div>
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
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-500 font-medium">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">รหัสผ่าน (password)</label>
              <div className="relative mt-1">
                <input
                  type="password"
                  placeholder={PASSWORD_HINT}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: "" });
                  }}
                  className={getInputClass(!!fieldErrors.password)}
                />
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
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