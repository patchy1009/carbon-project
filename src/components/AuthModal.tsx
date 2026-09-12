"use client";

import React, { useState } from "react";
import Modal from "./Modal";

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

  // state ฟอร์ม Register
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regOrgName, setRegOrgName] = useState("");
  const [regIndustry, setRegIndustry] = useState("");

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
    if (!loginEmail || !loginPassword) {
      setLoginError(true);
      return;
    }
    
    setLoginError(false);
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

      if (!response.ok) {
        setLoginError(true);
        // สามารถนำข้อมูล error จาก backend มาแสดงผลเพิ่มเติมได้ เช่น บัญชีถูกล็อก
        return;
      }

      // ล็อกอินสำเร็จ ตรวจสอบ Role เพื่อเปลี่ยนเส้นทาง
      onClose();
      if (data.role === "admin") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/organization/homepage";
      }
    } catch (err) {
      setLoginError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("otp");
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.join("").length < 6) {
      setOtpError(true);
      return;
    }
    alert("ยืนยันการลงทะเบียนสำเร็จ!");
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

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
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
                  *รหัสผ่านหรืออีเมลไม่ถูกต้อง
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

            <form onSubmit={handleRegisterSubmit} className="space-y-3 text-left">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  อีเมล (email)
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@company.co.th"
                  className="w-full px-4 py-2 text-xs rounded-full border border-gray-300 focus:outline-none focus:border-[#1c5d41]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  รหัสผ่าน (password)
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 text-xs rounded-full border border-gray-300 focus:outline-none focus:border-[#1c5d41]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  ชื่อองค์กร / บริษัท
                </label>
                <input
                  type="text"
                  required
                  value={regOrgName}
                  onChange={(e) => setRegOrgName(e.target.value)}
                  placeholder="บริษัท ตัวอย่าง จำกัด"
                  className="w-full px-4 py-2 text-xs rounded-full border border-gray-300 focus:outline-none focus:border-[#1c5d41]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  ประเภทอุตสาหกรรม
                </label>
                <select
                  required
                  value={regIndustry}
                  onChange={(e) => setRegIndustry(e.target.value)}
                  className="w-full px-4 py-2 text-xs rounded-full border border-gray-300 focus:outline-none focus:border-[#1c5d41] text-gray-600 bg-white"
                >
                  <option value="">เลือกประเภทอุตสาหกรรม</option>
                  <option value="energy">พลังงานและสาธารณูปโภค</option>
                  <option value="manufacturing">การผลิตและอุตสาหกรรม</option>
                  <option value="services">บริการและการพาณิชย์</option>
                </select>
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
                onClick={() => alert("ส่งรหัส OTP ใหม่แล้ว")}
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