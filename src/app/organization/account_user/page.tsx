"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle2, ChevronDown } from "lucide-react";

const industries = [
  "สำนักงานและบริการทั่วไป",
  "การผลิต อุตสาหกรรม และแปรรูป",
  "การขนส่ง โลจิสติกส์ และคลังสินค้า",
  "โรงแรม การท่องเที่ยว งานบริการ",
  "ค้าปลีก ค้าส่ง และการจัดการสินค้า",
  "ก่อสร้าง อสังหาริมทรัพย์ และโครงสร้างพื้นฐาน",
];

type Message = {
  type: "success" | "error";
  text: string;
};

export default function AccountUserPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user, setUser] = useState<any>(null);

  // รายละเอียดองค์กร
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState(industries[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgMessage, setOrgMessage] = useState<Message | null>(null);

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

  // โหลดข้อมูลผู้ใช้งานและองค์กร
  useEffect(() => {
    let isMounted = true;

    const fetchUserData = async () => {
      try {
        const {
          data: { user: currentUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !currentUser) {
          router.replace("/organization/homepage");
          return;
        }

        if (!isMounted) return;

        setUser(currentUser);
        setEmail(currentUser.email || "");

        const { data: orgData, error: orgError } = await supabase
          .from("organization")
          .select("org_name, business_type")
          .eq("acc_id", currentUser.id)
          .maybeSingle();

        if (orgError) throw orgError;
        if (!isMounted) return;

        const activeOrgName =
          orgData?.org_name ||
          currentUser.user_metadata?.company_name ||
          currentUser.user_metadata?.username ||
          "บริษัท ตัวอย่าง จำกัด";

        setCompanyName(activeOrgName);

        if (orgData?.business_type) {
          setIndustry(orgData.business_type);
        }
      } catch (err: any) {
        if (isMounted) {
          setOrgMessage({
            type: "error",
            text: `โหลดข้อมูลไม่สำเร็จ: ${err.message}`,
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // ออกจากระบบ
  const handleLogout = async () => {
    setIsLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setIsLoggingOut(false);

      setOrgMessage({
        type: "error",
        text: `ออกจากระบบไม่สำเร็จ: ${error.message}`,
      });

      return;
    }

    router.replace("/organization/homepage");
  };

  // บันทึกข้อมูลรายละเอียดองค์กร
  const saveOrganizationDetails = async (
    name: string,
    businessType: string
  ) => {
    if (!user) {
      throw new Error(
        "ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่"
      );
    }

    const { data: existingData, error: selectError } = await supabase
      .from("organization")
      .select("acc_id")
      .eq("acc_id", user.id)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existingData) {
      const { error } = await supabase
        .from("organization")
        .update({
          org_name: name,
          business_type: businessType,
        })
        .eq("acc_id", user.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("organization")
        .insert({
          acc_id: user.id,
          org_name: name,
          business_type: businessType,
        });

      if (error) throw error;
    }
  };

  // บันทึกชื่อองค์กรและประเภทอุตสาหกรรม
  const handleUpdateOrganization = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setOrgMessage(null);

    if (!user) {
      setOrgMessage({
        type: "error",
        text: "ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่",
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

    setOrgLoading(true);

    try {
      await saveOrganizationDetails(companyName.trim(), industry);

      const { error: metadataError } =
        await supabase.auth.updateUser({
          data: {
            username: companyName.trim(),
            company_name: companyName.trim(),
            org_name: companyName.trim(),
          },
        });

      if (metadataError) throw metadataError;

      const { error: userTableError } = await supabase
        .from("user")
        .update({ username: companyName.trim() })
        .eq("acc_id", user.id);

      if (userTableError) throw userTableError;

      setOrgMessage({
        type: "success",
        text: "บันทึกข้อมูลเรียบร้อยแล้ว",
      });
    } catch (err: any) {
      setOrgMessage({
        type: "error",
        text: `บันทึกข้อมูลไม่สำเร็จ: ${err.message}`,
      });
    } finally {
      setOrgLoading(false);
    }
  };

  // เปลี่ยนรหัสผ่าน โดยตรวจสอบข้อมูลทั้ง 3 ช่อง
  const handleUpdatePassword = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setPassMessage(null);
    setCurrentPasswordError("");
    setNewPasswordError("");
    setConfirmPasswordError("");

    if (!user?.email) {
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
    }

    // ตรวจสอบรูปแบบรหัสผ่านใหม่
    const passwordValidationError =
      validateNewPassword(newPassword);

    if (passwordValidationError) {
      setNewPasswordError(passwordValidationError);
      hasError = true;
    }

    // ตรวจสอบการยืนยันรหัสผ่าน
    if (!confirmPassword) {
      setConfirmPasswordError("กรุณายืนยันรหัสผ่านใหม่");
      hasError = true;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError(
        "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน"
      );
      hasError = true;
    }

    // รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม
    if (
      currentPassword &&
      newPassword &&
      currentPassword === newPassword
    ) {
      setNewPasswordError(
        "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม"
      );

      hasError = true;
    }

    if (hasError) return;

    setPassLoading(true);

    try {
      // ตรวจสอบรหัสผ่านเดิมกับ Supabase Auth
      const { error: verifyError } =
        await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

      if (verifyError) {
        setCurrentPasswordError(
          "รหัสผ่านเดิมไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง"
        );

        return;
      }

      // เปลี่ยนเป็นรหัสผ่านใหม่
      const { error: updateError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (updateError) {
        throw updateError;
      }

      const {
        data: { user: refreshedUser },
      } = await supabase.auth.getUser();

      if (refreshedUser) {
        setUser(refreshedUser);
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
    } catch (err: any) {
      setPassMessage({
        type: "error",
        text: `เปลี่ยนรหัสผ่านไม่สำเร็จ: ${err.message}`,
      });
    } finally {
      setPassLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-slate-500 text-sm">
        กำลังโหลดข้อมูล...
      </div>
    );
  }

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
          {isLoggingOut
            ? "กำลังออกจากระบบ..."
            : "ออกจากระบบ"}
        </button>
      </div>

      {/* PROFILE BANNER */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 shadow-md flex flex-col md:flex-row items-center justify-center gap-6 relative overflow-hidden">
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
          <form
            onSubmit={handleUpdateOrganization}
            className="space-y-5"
          >
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
                onClick={() =>
                  setIsDropdownOpen((open) => !open)
                }
                aria-expanded={isDropdownOpen}
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
              {orgLoading
                ? "กำลังบันทึกข้อมูล..."
                : "บันทึกการเปลี่ยนแปลง"}
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
                  newPasswordError
                    ? "new-password-error"
                    : undefined
                }
                onChange={(e) => {
                  const value = e.target.value;

                  setNewPassword(value);
                  setPassMessage(null);
                  setNewPasswordError(
                    value.length > 0
                      ? validateNewPassword(value)
                      : ""
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
                  confirmPasswordError
                    ? "confirm-password-error"
                    : undefined
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
                  currentPasswordError
                    ? "current-password-error"
                    : undefined
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
              {passLoading
                ? "กำลังเปลี่ยนรหัสผ่าน..."
                : "ยืนยันเปลี่ยนรหัสผ่าน"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}