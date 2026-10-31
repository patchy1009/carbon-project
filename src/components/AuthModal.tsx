"use client";

import React, { useState } from "react";
import Modal from "./Modal";
import { showAlert } from "@/lib/dialog"; // [แก้ไข] กล่องแจ้งเตือนกลางแทน alert

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
  // state จัดการขั้นตอนปัจจุบัน: 'login' | 'register' | 'otp'
  const [step, setStep] = useState<"login" | "register" | "otp">(initialMode);

  // state ฟอร์ม Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  // [เพิ่ม] ข้อความ error ของการเข้าสู่ระบบ แสดงใต้ฟอร์ม (เดิมเด้ง alert ซ้ำกับข้อความสีแดง)
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  // state ฟอร์ม Register
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regOrgName, setRegOrgName] = useState("");
  const [regIndustry, setRegIndustry] = useState("");
  // [เพิ่ม] error ของแต่ละช่องในฟอร์มลงทะเบียน (แทน required ของ browser ที่เด้ง popup)
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const regBorder = (field: string) =>
    regErrors[field] ? "border-red-500 bg-red-50/20" : "border-gray-300 focus:border-[#1c5d41]";
  const clearRegError = (field: string) =>
    setRegErrors((prev) => (prev[field] ? { ...prev, [field]: "" } : prev));

  // state ช่องกรอก OTP 6 ช่อง
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState(false);

  // ฟังก์ชันสลับช่อง OTP อัตโนมัติเมื่อพิมพ์
  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError(false);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const [isLoading, setIsLoading] = useState(false);

  
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError(true);
      setLoginMessage("*กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    setLoginError(false);
    setLoginMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const data = await response.json();

      // API แจ้งว่า Login ไม่สำเร็จ
      if (!response.ok) {
        setLoginError(true);
        setLoginMessage("*" + (data.error || "รหัสผ่านหรืออีเมลไม่ถูกต้อง"));
        return;
      }

      // ตรวจสอบ Role และเส้นทางที่ API อนุญาต
      const allowedRoutes: Record<string, string> = {
        admin: "/admin/ef-gwp",
        organization: "/organization/dashboard",
      };

      const expectedRoute = allowedRoutes[data.role];

      if (!expectedRoute || data.redirectTo !== expectedRoute) {
        setLoginError(true);
        setLoginMessage("*ไม่สามารถตรวจสอบสิทธิ์ผู้ใช้ได้");
        return;
      }

      // เปลี่ยนหน้าโดยไม่เรียก onClose
      // เพราะ onClose เดิมอาจพาไป Dashboard องค์กรเสมอ
      window.location.assign(expectedRoute);
    } catch (error) {
      console.error("Login error:", error);
      setLoginError(true);
      setLoginMessage("*ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่");
    } finally {
      setIsLoading(false);
    }
  };


  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // [แก้ไข] ตรวจเองแล้วแสดงกรอบแดง + ข้อความใต้ช่อง แทน required ของ browser
    const errs: Record<string, string> = {};
    if (!regEmail.trim()) errs.email = "กรุณากรอกอีเมล";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) errs.email = "รูปแบบอีเมลไม่ถูกต้อง";
    if (!regPassword) errs.password = "กรุณากรอกรหัสผ่าน";
    if (!regOrgName.trim()) errs.orgName = "กรุณากรอกชื่อองค์กร / บริษัท";
    if (!regIndustry) errs.industry = "กรุณาเลือกประเภทอุตสาหกรรม";
    setRegErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setStep("otp");
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.join("").length < 6) {
      setOtpError(true);
      return;
    }
    showAlert("ยืนยันการลงทะเบียนสำเร็จ!", { title: "ลงทะเบียนสำเร็จ", tone: "success" });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="px-2 py-1 text-center font-sans">
        
        {/* ================= 1. หน้าเข้าสู่ระบบ (LOGIN) ================= */}
        {step === "login" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">เข้าสู่ระบบ</h2>
              <p className="text-[12px] text-gray-400 leading-snug">
                เข้าสู่ระบบเพื่อดำเนินการยื่นขอหรือคำนวณคาร์บอนอนุมัติ <br />
                ขององค์กรท่านได้ทันที
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} noValidate className="space-y-4 text-left">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  อีเมล (email)
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@company.co.th"
                  className={`w-full px-4 py-2 text-xs rounded-full border transition focus:outline-none ${
                    loginError ? "border-red-500 bg-red-50/20" : "border-gray-300 focus:border-[#1c5d41]"
                  }`}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-medium text-gray-600">
                    รหัสผ่าน (password)
                  </label>
                  <button type="button" className="text-[10px] text-[#1c5d41] hover:underline">
                    ลืมรหัสผ่าน?
                  </button>
                </div>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-4 py-2 text-xs rounded-full border transition focus:outline-none ${
                    loginError ? "border-red-500 bg-red-50/20" : "border-gray-300 focus:border-[#1c5d41]"
                  }`}
                />
              </div>

              {loginError && (
                <p className="text-[11px] text-red-500 text-center font-medium">
                  {loginMessage ?? "*รหัสผ่านหรืออีเมลไม่ถูกต้อง"}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-[#1c5d41] hover:bg-[#144530] text-white font-medium rounded-full text-xs transition shadow-sm mt-2"
              >
                เข้าสู่ระบบ
              </button>
            </form>

            <p className="text-[11px] text-gray-400 pt-1">
              ยังไม่มีบัญชีผู้ใช้ใช่ไหม?{" "}
              <button
                type="button"
                onClick={() => { setStep("register"); setLoginError(false); }}
                className="text-[#1c5d41] font-semibold hover:underline ml-1"
              >
                ลงทะเบียนองค์กร
              </button>
            </p>
          </div>
        )}

        {/* ================= 2. หน้าลงทะเบียน (REGISTER) ================= */}
        {step === "register" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">ลงทะเบียนองค์กร</h2>
              <p className="text-[11px] text-gray-400">
                สร้างบัญชีองค์กรเพื่อเริ่มต้นบริหารจัดการคาร์บอนฟุตพริ้นท์และคำนวณภาษี
              </p>
            </div>

            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-3 text-left">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  อีเมล (email)
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => { setRegEmail(e.target.value); clearRegError("email"); }}
                  placeholder="name@company.co.th"
                  className={`w-full px-4 py-2 text-xs rounded-full border focus:outline-none ${regBorder("email")}`}
                />
                {regErrors.email && <p className="mt-1 text-[11px] text-red-500">{regErrors.email}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  รหัสผ่าน (password)
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => { setRegPassword(e.target.value); clearRegError("password"); }}
                  placeholder="••••••••"
                  className={`w-full px-4 py-2 text-xs rounded-full border focus:outline-none ${regBorder("password")}`}
                />
                {regErrors.password && <p className="mt-1 text-[11px] text-red-500">{regErrors.password}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  ชื่อองค์กร / บริษัท
                </label>
                <input
                  type="text"
                  value={regOrgName}
                  onChange={(e) => { setRegOrgName(e.target.value); clearRegError("orgName"); }}
                  placeholder="บริษัท ตัวอย่าง จำกัด"
                  className={`w-full px-4 py-2 text-xs rounded-full border focus:outline-none ${regBorder("orgName")}`}
                />
                {regErrors.orgName && <p className="mt-1 text-[11px] text-red-500">{regErrors.orgName}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  ประเภทอุตสาหกรรม
                </label>
                <select
                  value={regIndustry}
                  onChange={(e) => { setRegIndustry(e.target.value); clearRegError("industry"); }}
                  className={`w-full px-4 py-2 text-xs rounded-full border focus:outline-none text-gray-600 bg-white ${regBorder("industry")}`}
                >
                  <option value="">เลือกประเภทอุตสาหกรรม</option>
                  <option value="energy">พลังงานและสาธารณูปโภค</option>
                  <option value="manufacturing">การผลิตและอุตสาหกรรม</option>
                  <option value="services">บริการและการพาณิชย์</option>
                </select>
                {regErrors.industry && <p className="mt-1 text-[11px] text-red-500">{regErrors.industry}</p>}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#1c5d41] hover:bg-[#144530] text-white font-medium rounded-full text-xs transition shadow-sm mt-3"
              >
                ลงทะเบียนองค์กร
              </button>
            </form>

            <p className="text-[11px] text-gray-400">
              มีบัญชีผู้ใช้อยู่แล้ว?{" "}
              <button
                type="button"
                onClick={() => setStep("login")}
                className="text-[#1c5d41] font-semibold hover:underline ml-1"
              >
                เข้าสู่ระบบ
              </button>
            </p>
          </div>
        )}

        {/* ================= 3. หน้ากรอก OTP (CONFIRMation) ================= */}
        {step === "otp" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">ยืนยันการลงทะเบียน</h2>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                ระบบได้ส่งรหัสยืนยันไปที่อีเมลของคุณแล้ว <br />
                กรุณากรอกรหัสตามที่ปรากฏเพื่อยืนยันการลงทะเบียนองค์กร
              </p>
            </div>

            <form onSubmit={handleOtpSubmit} className="space-y-5">
              {/* ช่องกรอกตัวเลข OTP 6 ช่องสีเทาอ่อนตาม Figma */}
              <div className="flex justify-center gap-2 my-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-input-${index}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, index)}
                    className="w-10 h-10 text-center text-sm font-semibold rounded-lg border border-gray-200 bg-[#f4f6f5] focus:bg-white focus:border-[#1c5d41] focus:outline-none transition shadow-inner"
                  />
                ))}
              </div>

              {otpError && (
                <p className="text-[11px] text-red-500 font-medium">
                  *กรุณากรอกรหัส OTP ให้ครบถ้วน 6 หลัก
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-[#1c5d41] hover:bg-[#144530] text-white font-medium rounded-full text-xs transition shadow-sm"
              >
                ยืนยันการลงทะเบียน
              </button>
            </form>

            <p className="text-[11px] text-gray-400">
              ไม่ได้รับข้อความความยืนยัน?{" "}
              <button
                type="button"
                onClick={() => showAlert("ส่งรหัส OTP ใหม่แล้ว", { tone: "success" })}
                className="text-[#1c5d41] font-semibold hover:underline ml-1"
              >
                ส่งใหม่อีกครั้ง
              </button>
            </p>
          </div>
        )}

      </div>
    </Modal>
  );
}