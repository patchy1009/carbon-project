"use client";
/*
 * หน้าจอบัญชีผู้ใช้ขององค์กร (TOR ข้อ 3.1, 4.1–4.3) มี 3 ส่วน
 *   1) ข้อมูลบัญชี: แสดงอีเมล (แก้ไม่ได้) และแก้ Username, ชื่อองค์กร, ประเภทธุรกิจ ได้ (ตรวจ Syntax ก่อนบันทึก)
 *   2) เปลี่ยนรหัสผ่าน: ต้องกรอกรหัสผ่านเดิมยืนยันก่อน (ตรวจกับ Supabase Auth) รหัสใหม่ต้องไม่ซ้ำรหัสเดิม
 *   3) ลบบัญชีและข้อมูลองค์กร: กดยืนยันใน popup แล้วเรียก DELETE /api/account
 * หน้า server (page.tsx) ดึงข้อมูลตั้งต้นมาส่งให้ทาง props ไฟล์นี้ทำงานฝั่ง browser
 */

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle2, ChevronDown, Trash2 } from "lucide-react";
import { industries } from "@/types/industries";
import { containsSqlSyntax } from "@/lib/sqlSyntax"; // ตรวจ Syntax ป้องกัน SQL Injection
import { getErrorMessage } from "@/lib/errorMessage";

type Message = {
  type: "success" | "error";
  text: string;
};

export default function AccountUserClient({
  userId,
  email,
  initialUsername,
  initialCompanyName,
  initialIndustry,
  loadError,
}: {
  userId: string;
  email: string;
  initialUsername: string;
  initialCompanyName: string;
  initialIndustry: string | null;
  loadError: string | null;
}) {
  const router = useRouter();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // รายละเอียดองค์กรและผู้ใช้ (ค่าเริ่มต้นมาจาก server แล้ว)
  const [username, setUsername] = useState(initialUsername);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [industry, setIndustry] = useState(initialIndustry ?? industries[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgMessage, setOrgMessage] = useState<Message | null>(
    loadError ? { type: "error", text: loadError } : null
  );

  // ตั้งค่าความปลอดภัย
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passMessage, setPassMessage] = useState<Message | null>(null);

  // ข้อความแจ้งเตือนแยกแต่ละช่อง
  const [currentPasswordError, setCurrentPasswordError] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  // ===== ลบบัญชีและข้อมูลองค์กร =====
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ตรวจสอบรูปแบบรหัสผ่านใหม่
  const validateNewPassword = (password: string) => {
    if (password.length < 8) {
      return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    }

    if (!/[A-Za-z]/.test(password)) {
      return "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษอย่างน้อย 1 ตัว";
    }

    if (!/\d/.test(password)) {
      return "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว";
    }

    return "";
  };

  // ออกจากระบบ
  const handleLogout = async () => {
    setIsLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setIsLoggingOut(false);

      setOrgMessage({
        type: "error",
        text: `ออกจากระบบไม่สำเร็จ: ${getErrorMessage(error)}`,
      });

      return;
    }

    router.replace("/organization/homepage");
  };

  // ===== ลบบัญชีและข้อมูลองค์กร =====
  // ขั้นตอน: กดปุ่มลบบัญชี -> popup ยืนยัน -> กด "ลบบัญชีถาวร" -> เรียก API (DELETE /api/account)
  // ไม่ต้องพิมพ์ข้อความหรือกรอกรหัสผ่านอีก API รู้ว่าเป็นใครจาก session ที่ล็อกอินอยู่
  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setShowDeleteModal(false);
    setDeleteError("");
  };

  const handleDeleteAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDeleteError("");
    setDeleteLoading(true);

    try {
      const response = await fetch("/api/account", { method: "DELETE" });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "ลบบัญชีไม่สำเร็จ");
      }

      // บัญชีถูกลบแล้ว: ล้าง session ในเบราว์เซอร์ (scope local ไม่เรียก server) แล้วกลับหน้าแรก
      await supabase.auth.signOut({ scope: "local" });
      router.replace("/organization/homepage");
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "ลบบัญชีไม่สำเร็จ");
      setDeleteLoading(false);
    }
  };

  // บันทึกข้อมูลรายละเอียดองค์กร
  const saveOrganizationDetails = async (name: string, businessType: string) => {
    const { data: existingData, error: selectError } = await supabase
      .from("organization")
      .select("acc_id")
      .eq("acc_id", userId)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existingData) {
      const { error } = await supabase
        .from("organization")
        .update({
          org_name: name,
          business_type: businessType,
        })
        .eq("acc_id", userId);

      if (error) throw error;
    } else {
      const { error } = await supabase.from("organization").insert({
        acc_id: userId,
        org_name: name,
        business_type: businessType,
      });

      if (error) throw error;
    }
  };

  // บันทึกชื่อองค์กร Username และประเภทอุตสาหกรรม
  const handleUpdateOrganization = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setOrgMessage(null);

    if (!username.trim()) {
      setOrgMessage({
        type: "error",
        text: "กรุณากรอกชื่อผู้ใช้งาน (Username)",
      });

      return;
    }

    if (!companyName.trim()) {
      setOrgMessage({
        type: "error",
        text: "กรุณากรอกชื่อองค์กร / บริษัท",
      });

      return;
    }

    // ตรวจ Syntax คล้ายคำสั่ง SQL ก่อนส่งข้อมูลไปบันทึก (TOR 4.3)
    if (containsSqlSyntax(username.trim())) {
      setOrgMessage({
        type: "error",
        text: "ชื่อผู้ใช้งาน (Username) มีรูปแบบที่ไม่อนุญาต (คล้ายคำสั่ง SQL) กรุณากรอกใหม่",
      });

      return;
    }

    if (containsSqlSyntax(companyName.trim())) {
      setOrgMessage({
        type: "error",
        text: "ชื่อองค์กร / บริษัท มีรูปแบบที่ไม่อนุญาต (คล้ายคำสั่ง SQL) กรุณากรอกใหม่",
      });

      return;
    }

    setOrgLoading(true);

    try {
      // บันทึกชื่อองค์กรและประเภทอุตสาหกรรม
      await saveOrganizationDetails(companyName.trim(), industry);

      // บันทึก Username ลงในตาราง user
      const { error: userTableError } = await supabase
        .from("user")
        .update({ username: username.trim() })
        .eq("acc_id", userId);

      if (userTableError) throw userTableError;

      // อัปเดต Metadata ของ Auth
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          username: username.trim(),
          company_name: companyName.trim(),
          org_name: companyName.trim(),
        },
      });

      if (metadataError) throw metadataError;

      setOrgMessage({
        type: "success",
        text: "บันทึกข้อมูลเรียบร้อยแล้ว",
      });

      // ให้ฝั่ง server ดึงข้อมูลล่าสุดมาใหม่
      router.refresh();
    } catch (err) {
      setOrgMessage({
        type: "error",
        text: `บันทึกข้อมูลไม่สำเร็จ: ${getErrorMessage(err)}`,
      });
    } finally {
      setOrgLoading(false);
    }
  };

  // เปลี่ยนรหัสผ่าน โดยตรวจสอบข้อมูลทั้ง 3 ช่อง
  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setPassMessage(null);
    setCurrentPasswordError("");
    setNewPasswordError("");
    setConfirmPasswordError("");

    if (!email) {
      setPassMessage({
        type: "error",
        text: "ไม่พบอีเมลบัญชี กรุณาเข้าสู่ระบบใหม่",
      });

      return;
    }

    let hasError = false;

    // ตรวจสอบรหัสผ่านเดิม
    if (!currentPassword) {
      setCurrentPasswordError("กรุณากรอกรหัสผ่านเดิม");
      hasError = true;
    } else if (containsSqlSyntax(currentPassword, { lenient: true })) {
      setCurrentPasswordError("รหัสผ่านเดิมมีรูปแบบที่ไม่อนุญาต (คล้ายคำสั่ง SQL) กรุณากรอกใหม่");
      hasError = true;
    }

    // ตรวจสอบรูปแบบรหัสผ่านใหม่
    const passwordValidationError = validateNewPassword(newPassword);

    if (passwordValidationError) {
      setNewPasswordError(passwordValidationError);
      hasError = true;
    } else if (containsSqlSyntax(newPassword, { lenient: true })) {
      // ตรวจ Syntax คล้ายคำสั่ง SQL (รหัสผ่านใช้โหมด lenient) TOR 3.4
      setNewPasswordError("รหัสผ่านมีรูปแบบที่ไม่อนุญาต (คล้ายคำสั่ง SQL) กรุณากรอกใหม่");
      hasError = true;
    }

    // ตรวจสอบการยืนยันรหัสผ่าน
    if (!confirmPassword) {
      setConfirmPasswordError("กรุณายืนยันรหัสผ่านใหม่");
      hasError = true;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError("รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
      hasError = true;
    }

    // รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม
    if (currentPassword && newPassword && currentPassword === newPassword) {
      setNewPasswordError("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม");
      hasError = true;
    }

    if (hasError) return;

    setPassLoading(true);

    try {
      // ตรวจสอบรหัสผ่านเดิมกับ Supabase Auth
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (verifyError) {
        setCurrentPasswordError("รหัสผ่านเดิมไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง");

        return;
      }

      // เปลี่ยนเป็นรหัสผ่านใหม่
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setPassMessage({
        type: "success",
        text: "เปลี่ยนรหัสผ่านใหม่สำเร็จ!",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setCurrentPasswordError("");
      setNewPasswordError("");
      setConfirmPasswordError("");
    } catch (err) {
      setPassMessage({
        type: "error",
        text: `เปลี่ยนรหัสผ่านไม่สำเร็จ: ${getErrorMessage(err)}`,
      });
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-8 text-slate-800 relative">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#11221C]">
            ตั้งค่าข้อมูลองค์กร
          </h1>

          <p className="text-xs md:text-sm text-slate-500 mt-1">
            จัดการรายละเอียดองค์กรและตั้งค่าความปลอดภัยบัญชี
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="px-6 py-2.5 rounded-full border-2 border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-800 font-semibold text-xs md:text-sm transition shadow-sm self-start sm:self-auto disabled:opacity-50"
        >
          {isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
        </button>
      </div>

      {/* PROFILE BANNER (แสดงทั้งชื่อองค์กรและ Username) */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 shadow-md flex flex-col md:flex-row items-center justify-center gap-6 relative overflow-hidden">
        <div className="text-center md:text-left space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/60 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>ยืนยันตัวตนแล้ว</span>
          </div>

          <h2 className="text-xl md:text-2xl font-extrabold text-[#11221C]">
            {companyName}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            @{username || "username"}
          </p>
        </div>
      </div>

      {/* FORMS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* รายละเอียดองค์กร */}
        <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 shadow-md flex flex-col justify-between space-y-6">
          <form onSubmit={handleUpdateOrganization} className="space-y-5">
            <h3 className="text-lg font-bold text-[#11221C] text-center">
              รายละเอียดองค์กร
            </h3>

            {orgMessage && (
              <div
                role="alert"
                className={`p-3 rounded-2xl text-xs font-medium text-center ${
                  orgMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-600 border border-red-200"
                }`}
              >
                {orgMessage.text}
              </div>
            )}

            {/* อีเมลแสดงอย่างเดียว */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                อีเมลบัญชี (email)
              </label>

              <input
                type="email"
                value={email}
                readOnly
                aria-readonly="true"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs text-slate-500 bg-slate-100 font-medium cursor-not-allowed focus:outline-none"
              />

              <p className="text-[11px] text-slate-400">
                อีเมลนี้ใช้สำหรับเข้าสู่ระบบ และไม่สามารถเปลี่ยนจากหน้านี้ได้
              </p>
            </div>

            {/* ชื่อผู้ใช้งาน  */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                ชื่อผู้ใช้งาน (username)
              </label>

              <input
                type="text"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setOrgMessage(null);
                }}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 font-medium"
              />
            </div>

            {/* ชื่อองค์กร */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                ชื่อองค์กร / บริษัท
              </label>

              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  setOrgMessage(null);
                }}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 font-medium"
              />
            </div>

            {/* ประเภทอุตสาหกรรม */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-slate-700">
                ประเภทอุตสาหกรรม
              </label>

              <button
                type="button"
                onClick={() => setIsDropdownOpen((open) => !open)}
                aria-expanded={isDropdownOpen}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs bg-slate-50/50 flex items-center justify-between cursor-pointer text-slate-800 font-medium"
              >
                <span>{industry}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg z-30 overflow-hidden py-1">
                  {industries.map((item: string) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => {
                        setIndustry(item);
                        setIsDropdownOpen(false);
                        setOrgMessage(null);
                      }}
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
              {orgLoading ? "กำลังบันทึกข้อมูล..." : "บันทึกการเปลี่ยนแปลง"}
            </button>
          </form>
        </div>

        {/* ตั้งค่าความปลอดภัย */}
        <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 shadow-md flex flex-col justify-between space-y-6">
          <form
            onSubmit={handleUpdatePassword}
            className="space-y-4"
            noValidate
          >
            <h3 className="text-lg font-bold text-[#11221C] text-center">
              ตั้งค่าความปลอดภัย
            </h3>

            {passMessage && (
              <div
                role="alert"
                className={`p-3 rounded-2xl text-xs font-medium text-center ${
                  passMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-600 border border-red-200"
                }`}
              >
                {passMessage.text}
              </div>
            )}

            {/* รหัสผ่านใหม่ */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                รหัสผ่านใหม่ (new password)
              </label>

              <input
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                aria-invalid={Boolean(newPasswordError)}
                aria-describedby={
                  newPasswordError ? "new-password-error" : undefined
                }
                onChange={(e) => {
                  const value = e.target.value;

                  setNewPassword(value);
                  setPassMessage(null);
                  setNewPasswordError(
                    value.length > 0 ? validateNewPassword(value) : ""
                  );

                  if (confirmPassword.length > 0) {
                    setConfirmPasswordError(
                      value === confirmPassword
                        ? ""
                        : "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน"
                    );
                  }
                }}
                placeholder="อย่างน้อย 8 ตัวอักษร มีตัวอักษรและตัวเลข"
                className={`w-full px-4 py-2.5 rounded-2xl border text-xs text-slate-800 focus:outline-none focus:ring-2 bg-slate-50/50 ${
                  newPasswordError
                    ? "border-red-500 focus:ring-red-500"
                    : "border-slate-200 focus:ring-emerald-700"
                }`}
              />

              {newPasswordError && (
                <p
                  id="new-password-error"
                  role="alert"
                  className="text-xs text-red-600"
                >
                  {newPasswordError}
                </p>
              )}
            </div>

            {/* ยืนยันรหัสผ่านใหม่ */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                ยืนยันรหัสผ่านใหม่ (confirm password)
              </label>

              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                aria-invalid={Boolean(confirmPasswordError)}
                aria-describedby={
                  confirmPasswordError ? "confirm-password-error" : undefined
                }
                onChange={(e) => {
                  const value = e.target.value;

                  setConfirmPassword(value);
                  setPassMessage(null);

                  setConfirmPasswordError(
                    value.length > 0 && value !== newPassword
                      ? "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน"
                      : ""
                  );
                }}
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                className={`w-full px-4 py-2.5 rounded-2xl border text-xs text-slate-800 focus:outline-none focus:ring-2 bg-slate-50/50 ${
                  confirmPasswordError
                    ? "border-red-500 focus:ring-red-500"
                    : "border-slate-200 focus:ring-emerald-700"
                }`}
              />

              {confirmPasswordError && (
                <p
                  id="confirm-password-error"
                  role="alert"
                  className="text-xs text-red-600"
                >
                  {confirmPasswordError}
                </p>
              )}
            </div>

            {/* รหัสผ่านเดิม */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                รหัสผ่านเดิม (current password)
              </label>

              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                aria-invalid={Boolean(currentPasswordError)}
                aria-describedby={
                  currentPasswordError ? "current-password-error" : undefined
                }
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setCurrentPasswordError("");
                  setPassMessage(null);
                }}
                placeholder="กรอกรหัสผ่านเดิม"
                className={`w-full px-4 py-2.5 rounded-2xl border text-xs text-slate-800 focus:outline-none focus:ring-2 bg-slate-50/50 ${
                  currentPasswordError
                    ? "border-red-500 focus:ring-red-500"
                    : "border-slate-200 focus:ring-emerald-700"
                }`}
              />

              {currentPasswordError && (
                <p
                  id="current-password-error"
                  role="alert"
                  className="text-xs text-red-600"
                >
                  {currentPasswordError}
                </p>
              )}

              {/* ลิงก์ลืมรหัสผ่าน */}
              <div className="flex justify-end pt-1">
                <Link
                  href="/organization/forgot_password"
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline transition"
                >
                  ลืมรหัสผ่าน?
                </Link>
              </div>
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

      {/* ===== การ์ดลบบัญชี ===== */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 shadow-md space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">ลบบัญชี</h3>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            การลบบัญชีจะลบข้อมูลองค์กรและข้อมูลการประเมินคาร์บอนทั้งหมดอย่างถาวร และไม่สามารถกู้คืนได้
          </p>
        </div>

        {/* ปุ่มลบเป็นแบบกรอบแดง (outline) ไม่พื้นแดงทึบ เพื่อไม่ให้เด่น */}
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-[#E5C4C0] text-[#A8483F] hover:bg-[#FBF1F0] font-semibold text-xs md:text-sm transition cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>ลบบัญชีและข้อมูลทั้งหมด</span>
        </button>
      </div>

      {/* ===== หน้าต่างยืนยันการลบบัญชี ===== */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        >
          <form
            onSubmit={handleDeleteAccount}
            className="bg-white w-full max-w-md rounded-3xl p-6 md:p-8 shadow-xl space-y-4"
          >
            <h3 className="text-lg font-bold text-[#A8483F]">ยืนยันการลบบัญชี</h3>

            <p className="text-xs text-slate-600">
              ข้อมูลองค์กรและผลการประเมินคาร์บอนทั้งหมดจะถูกลบถาวร และไม่สามารถกู้คืนได้
            </p>

            {deleteError && (
              <div
                role="alert"
                className="p-3 rounded-2xl text-xs font-medium text-center bg-[#FBF1F0] text-[#A8483F] border border-[#E5C4C0] break-words"
              >
                {deleteError}
              </div>
            )}

            {/* ปุ่มยกเลิก / ลบบัญชีถาวร */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteLoading}
                className="flex-1 py-3 rounded-2xl border-2 border-slate-300 text-slate-600 hover:border-slate-400 font-semibold text-xs transition disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={deleteLoading}
                className="flex-1 py-3 rounded-2xl bg-[#A8483F] hover:bg-[#8F3B33] text-white font-bold text-xs transition disabled:opacity-60 cursor-pointer"
              >
                {deleteLoading ? "กำลังลบ..." : "ลบบัญชีถาวร"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
