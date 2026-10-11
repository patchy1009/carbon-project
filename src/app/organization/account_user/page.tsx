"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Camera, CheckCircle2, ChevronDown, Building2, X, RefreshCw } from "lucide-react";

const industries = [
  "สำนักงานและบริการทั่วไป",
  "การผลิต อุตสาหกรรม และแปรรูป",
  "การขนส่ง โลจิสติกส์ และคลังสินค้า",
  "โรงแรม การท่องเที่ยว งานบริการ",
  "ค้าปลีก ค้าส่ง และการจัดการสินค้า",
  "ก่อสร้าง อสังหาริมทรัพย์ และโครงสร้างพื้นฐาน",
];

export default function AccountUserPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Form State: รายละเอียดองค์กร
  const [email, setEmail] = useState("");
  const [initialEmail, setInitialEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState(industries[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgMessage, setOrgMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // State: Modal ยืนยัน OTP เมื่อเปลี่ยนอีเมล
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [pendingNewEmail, setPendingNewEmail] = useState("");
  
  const [resendTimer, setResendTimer] = useState(300);
  const [canResend, setCanResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Form State: ตั้งค่าความปลอดภัย
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passMessage, setPassMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ตัวนับเวลาถอยหลัง OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showOtpModal && resendTimer > 0) {
      setCanResend(false);
      timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [showOtpModal, resendTimer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // โหลดข้อมูลผู้ใช้งาน
  useEffect(() => {
    const fetchUserData = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user;

      if (!currentUser) {
        router.replace("/organization/homepage");
        return;
      }

      setUser(currentUser);
      setEmail(currentUser.email || "");
      setInitialEmail(currentUser.email || "");

      const { data: orgData } = await supabase
        .from("organization")
        .select("*")
        .eq("acc_id", currentUser.id)
        .maybeSingle();

      const activeOrgName = orgData?.org_name || currentUser.user_metadata?.company_name || currentUser.user_metadata?.username || "บริษัท ตัวอย่าง จำกัด";
      setCompanyName(activeOrgName);

      if (orgData?.business_type) {
        setIndustry(orgData.business_type);
      }

      setLoading(false);
    };

    fetchUserData();
  }, [router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/organization/homepage");
  };

  const saveOrganizationDetails = async (name: string, busType: string) => {
    const { data: existingData } = await supabase
      .from("organization")
      .select("acc_id")
      .eq("acc_id", user.id)
      .maybeSingle();

    if (existingData) {
      await supabase.from("organization").update({ org_name: name, business_type: busType }).eq("acc_id", user.id);
    } else {
      await supabase.from("organization").insert({ acc_id: user.id, org_name: name, business_type: busType });
    }
  };

  // บันทึกข้อมูลองค์กร / คำขอเปลี่ยนอีเมล
  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgMessage(null);

    const newEmailToVerify = email.trim().toLowerCase();

    if (!companyName.trim()) {
      setOrgMessage({ type: "error", text: "กรุณากรอกชื่อองค์กร / บริษัท" });
      return;
    }

    setOrgLoading(true);

    try {
      if (!user) return;

      const isEmailChanged = newEmailToVerify !== initialEmail.toLowerCase();

      if (isEmailChanged) {
        setPendingNewEmail(newEmailToVerify);

        const { error: authError } = await supabase.auth.updateUser({ email: newEmailToVerify });
        if (authError) throw authError;

        setResendTimer(300);
        setShowOtpModal(true);
        setOrgMessage({ type: "success", text: `ส่งรหัส OTP ไปที่ ${newEmailToVerify} เรียบร้อยแล้ว` });
        return;
      }

      // ถ้าไม่ได้เปลี่ยนอีเมล (แค่อัปเดตชื่อองค์กร/ประเภทธุรกิจ)
      await saveOrganizationDetails(companyName.trim(), industry);

      // อัปเดต Metadata บน Auth และ ตาราง public.user
      await supabase.auth.updateUser({
        data: {
          username: companyName.trim(),
          company_name: companyName.trim(),
          org_name: companyName.trim(),
        },
      });

      await supabase
        .from("user")
        .update({ username: companyName.trim() })
        .eq("acc_id", user.id);

      setOrgMessage({ type: "success", text: "บันทึกข้อมูลเรียบร้อยแล้ว" });

    } catch (err: any) {
      if (err.message?.toLowerCase().includes("already registered") || err.message?.toLowerCase().includes("already been registered")) {
        setOrgMessage({ type: "error", text: "อีเมลนี้ถูกใช้งานโดยบัญชีอื่นในระบบแล้ว" });
      } else {
        setOrgMessage({ type: "error", text: `เกิดข้อผิดพลาด: ${err.message}` });
      }
    } finally {
      setOrgLoading(false);
    }
  };

  // ส่งรหัส OTP อีกครั้ง
  const handleResendOtp = async () => {
    if (!canResend || resendLoading || !pendingNewEmail) return;

    setResendLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: pendingNewEmail });
      if (error) throw error;

      setResendTimer(300);
      setCanResend(false);
      alert(`ส่งรหัส OTP ไปยังอีเมล ${pendingNewEmail} อีกครั้งเรียบร้อยแล้ว!`);
    } catch (err: any) {
      alert(`ไม่สามารถส่ง OTP ซ้ำได้: ${err.message}`);
    } finally {
      setResendLoading(false);
    }
  };

  // ยืนยัน OTP และเชื่อมโยงอัปเดตอีเมล + username ใหม่ไปยังทุกส่วน
  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length < 6) {
      alert("กรุณากรอกรหัส OTP ให้ครบ 6 หลัก");
      return;
    }

    setOtpLoading(true);

    try {
      // 1. ตรวจสอบ OTP กับ Supabase Auth
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: pendingNewEmail,
        token: otpCode.trim(),
        type: "email_change",
      });

      if (otpError) throw otpError;

      // 2. อัปเดต User Metadata ใน Auth (เพื่อซิงค์ username และชื่อบริษัทในระบบ Auth)
      await supabase.auth.updateUser({
        data: {
          username: companyName.trim(),
          company_name: companyName.trim(),
          org_name: companyName.trim(),
        },
      });

      // 3. อัปเดตอีเมลใหม่และ username ลงตาราง public.user
      const { error: updateUserError } = await supabase
        .from("user")
        .update({
          email: pendingNewEmail,
          username: companyName.trim(),
        })
        .eq("acc_id", user.id);

      if (updateUserError) {
        console.error("Error updating user table:", updateUserError);
      }

      // 4. บันทึก/อัปเดตข้อมูลลงตาราง public.organization
      await saveOrganizationDetails(companyName.trim(), industry);

      // Refresh Session ให้ดึงข้อมูลล่าสุด
      await supabase.auth.refreshSession();

      setInitialEmail(pendingNewEmail);
      setEmail(pendingNewEmail);
      setShowOtpModal(false);
      setOtpCode("");
      setOrgMessage({ type: "success", text: "เปลี่ยนอีเมลและเชื่อมโยงอัปเดตข้อมูลสำเร็จเรียบร้อยแล้ว!" });

    } catch (err: any) {
      alert(`ยืนยัน OTP ไม่สำเร็จ: ${err.message}`);
    } finally {
      setOtpLoading(false);
    }
  };

  // เปลี่ยนรหัสผ่านใหม่
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMessage(null);

    if (newPassword !== confirmPassword) {
      setPassMessage({ type: "error", text: "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน" });
      return;
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(newPassword)) {
      setPassMessage({ type: "error", text: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรกับตัวเลข" });
      return;
    }

    setPassLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPassMessage({ type: "success", text: "เปลี่ยนรหัสผ่านใหม่สำเร็จ!" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPassMessage({ type: "error", text: `เปลี่ยนรหัสผ่านไม่สำเร็จ: ${err.message}` });
    } finally {
      setPassLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-[70vh] flex items-center justify-center text-slate-500 text-sm">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-8 text-slate-800 relative">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#11221C]">ตั้งค่าข้อมูลองค์กร</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">จัดการรายละเอียดองค์กรและตั้งค่าความปลอดภัยบัญชี</p>
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="px-6 py-2.5 rounded-full border-2 border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-800 font-semibold text-xs md:text-sm transition shadow-sm self-start sm:self-auto disabled:opacity-50"
        >
          {isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
        </button>
      </div>

      {/* PROFILE BANNER */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 shadow-md flex flex-col md:flex-row items-center justify-center gap-6 relative overflow-hidden">
        <div className="relative">
          <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-slate-100 shadow-md bg-emerald-50 flex items-center justify-center">
            <Building2 className="w-12 h-12 text-emerald-700" />
          </div>
          <button type="button" className="absolute bottom-1 right-1 bg-[#2C7A59] hover:bg-[#1f5a41] text-white p-2 rounded-full shadow-md transition border-2 border-white">
            <Camera className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center md:text-left space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>ยืนยันตัวตนแล้ว</span>
          </div>
          <div className="flex items-center justify-center md:justify-start gap-2 text-xl md:text-2xl font-extrabold text-[#11221C]">
            <h2>{companyName}</h2>
          </div>
        </div>
      </div>

      {/* FORMS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* รายละเอียดองค์กร */}
        <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 shadow-md flex flex-col justify-between space-y-6">
          <form onSubmit={handleUpdateOrganization} className="space-y-5">
            <h3 className="text-lg font-bold text-[#11221C] text-center">รายละเอียดองค์กร</h3>

            {orgMessage && (
              <div className={`p-3 rounded-2xl text-xs font-medium text-center ${orgMessage.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                {orgMessage.text}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">อีเมล (email)</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setOrgMessage(null); }}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">ชื่อองค์กร / บริษัท</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => { setCompanyName(e.target.value); setOrgMessage(null); }}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 font-medium"
              />
            </div>

            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-slate-700">ประเภทอุตสาหกรรม</label>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs bg-slate-50/50 flex items-center justify-between cursor-pointer text-slate-800 font-medium"
              >
                <span>{industry}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg z-30 overflow-hidden py-1">
                  {industries.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => { setIndustry(item); setIsDropdownOpen(false); setOrgMessage(null); }}
                      className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={orgLoading}
              className="w-full py-3.5 bg-[#2C7A59] hover:bg-[#1f5a41] disabled:opacity-60 text-white font-bold rounded-2xl text-xs transition shadow-md cursor-pointer"
            >
              {orgLoading ? "กำลังดำเนินการ..." : "ยืนยันการเปลี่ยนแปลง"}
            </button>
          </form>
        </div>

        {/* ตั้งค่าความปลอดภัย */}
        <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 shadow-md flex flex-col justify-between space-y-6">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <h3 className="text-lg font-bold text-[#11221C] text-center">ตั้งค่าความปลอดภัย</h3>

            {passMessage && (
              <div className={`p-3 rounded-2xl text-xs font-medium text-center ${passMessage.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                {passMessage.text}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">รหัสผ่านใหม่ (new password)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">ยืนยันรหัสผ่านใหม่ (confirm-password)</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50"
              />
            </div>

            <button
              type="submit"
              disabled={passLoading}
              className="w-full py-3.5 bg-[#2C7A59] hover:bg-[#1f5a41] disabled:opacity-60 text-white font-bold rounded-2xl text-xs transition shadow-md cursor-pointer mt-2"
            >
              {passLoading ? "กำลังเปลี่ยนรหัสผ่าน..." : "ยืนยันเปลี่ยนรหัสผ่าน"}
            </button>
          </form>
        </div>

      </div>

      {/* OTP MODAL */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-6 md:p-8 max-w-md w-full space-y-6 shadow-2xl relative">
            <button onClick={() => setShowOtpModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition">
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-extrabold text-[#11221C]">ยืนยันการเปลี่ยนอีเมล</h3>
              <p className="text-xs text-slate-500">
                ระบบได้ส่งรหัส OTP 6 หลักไปที่อีเมลใหม่ <br />
                <span className="font-bold text-emerald-700">{pendingNewEmail}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyEmailOtp} className="space-y-5">
              <input
                type="text"
                maxLength={6}
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] font-extrabold rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 text-slate-800"
              />

              <div className="text-center">
                <button
                  type="button"
                  disabled={!canResend || resendLoading}
                  onClick={handleResendOtp}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 disabled:text-slate-400 disabled:no-underline hover:underline transition cursor-pointer disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resendLoading ? "animate-spin" : ""}`} />
                  {canResend
                    ? "ส่งรหัส OTP อีกครั้ง"
                    : `ส่งรหัสอีกครั้งได้ใน ${formatTime(resendTimer)} นาที`}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="w-1/2 py-3 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={otpLoading}
                  className="w-1/2 py-3 rounded-2xl bg-[#2C7A59] hover:bg-[#1f5a41] text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  {otpLoading ? "กำลังตรวจสอบ..." : "ยืนยัน OTP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}