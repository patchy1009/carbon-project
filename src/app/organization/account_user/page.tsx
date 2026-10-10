"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Camera, CheckCircle2, ChevronDown, Building2 } from "lucide-react";

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
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState(industries[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgMessage, setOrgMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State: ตั้งค่าความปลอดภัย (เปลี่ยนรหัสผ่าน)
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passMessage, setPassMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ดึงข้อมูล User และ Organization เมื่อเปิดหน้า
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

      // ดึงข้อมูลองค์กรจากตาราง organization
      const { data: orgData, error } = await supabase
        .from("organization")
        .select("*")
        .eq("acc_id", currentUser.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching organization data:", error);
      }

      if (orgData) {
        if (orgData.org_name) setCompanyName(orgData.org_name);
        if (orgData.business_type) setIndustry(orgData.business_type);
      }

      setLoading(false);
    };

    fetchUserData();

    // ดักจับเมื่อผู้ใช้กดยืนยันผ่านลิงก์มาจากอีเมล (PASSWORD_RECOVERY)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        const pendingPass = sessionStorage.getItem("pending_new_password");

        if (pendingPass) {
          // สั่งอัปเดตรหัสผ่านจริงในระบบ
          const { error } = await supabase.auth.updateUser({
            password: pendingPass,
          });

          sessionStorage.removeItem("pending_new_password");

          if (error) {
            setPassMessage({
              type: "error",
              text: `ยืนยันการกดยืนยันสำเร็จ แต่ไม่สามารถอัปเดตรหัสผ่านได้: ${error.message}`,
            });
          } else {
            setPassMessage({
              type: "success",
              text: "ยืนยันผ่านลิงก์เรียบร้อยแล้ว! เปลี่ยนรหัสผ่านใหม่สำเร็จ",
            });
          }
        } else {
          setPassMessage({
            type: "success",
            text: "ยืนยันการเข้าสู่ระบบผ่านลิงก์เรียบร้อยแล้ว",
          });
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  // ฟังก์ชันออกจากระบบ
  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/organization/homepage");
  };

  // ฟังก์ชันบันทึกการแก้ไขรายละเอียดองค์กร
  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgMessage(null);

    if (!companyName.trim()) {
      setOrgMessage({ type: "error", text: "กรุณากรอกชื่อองค์กร / บริษัท" });
      return;
    }

    setOrgLoading(true);

    try {
      if (!user) return;

      const { error } = await supabase
        .from("organization")
        .upsert(
          {
            acc_id: user.id,
            org_name: companyName.trim(),
            business_type: industry,
          },
          { onConflict: "acc_id" }
        );

      if (error) throw error;

      setOrgMessage({ type: "success", text: "บันทึกการเปลี่ยนแปลงรายละเอียดองค์กรเรียบร้อยแล้ว" });
    } catch (err: any) {
      setOrgMessage({ type: "error", text: `เกิดข้อผิดพลาด: ${err.message}` });
    } finally {
      setOrgLoading(false);
    }
  };

  // ฟังก์ชันส่งลิงก์ยืนยันทางอีเมล เพื่อกดเข้ามาเปลี่ยนรหัสผ่านในหน้า account_user
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMessage(null);

    if (!newPassword || !confirmPassword) {
      setPassMessage({ type: "error", text: "กรุณากรอกรหัสผ่านใหม่ให้ครบถ้วน" });
      return;
    }

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
      if (!email) {
        throw new Error("ไม่พบข้อมูลอีเมลผู้ใช้งาน");
      }

      // เก็บ รหัสผ่านใหม่ ไว้ใน sessionStorage ชั่วคราวเพื่อนำมาเปลี่ยนเมื่อผู้ใช้กดลิงก์กลับเข้ามา
      sessionStorage.setItem("pending_new_password", newPassword);

      // ส่งลิงก์ยืนยันไปยังอีเมล โดยระบุ redirectTo ให้พากลับมาหน้า /organization/account_user
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/organization/account_user`,
      });

      if (error) throw error;

      setPassMessage({
        type: "success",
        text: `ระบบได้ส่งลิงก์ยืนยันไปที่อีเมล ${email} แล้ว กรุณาเปิดอีเมลเพื่อกดยืนยัน (เมื่อกดแล้วจะนำคุณกลับมาหน้านี้ทันที)`,
      });

      // ล้างค่าในฟอร์ม
      setNewPassword("");
      setConfirmPassword("");
      setOldPassword("");
    } catch (err: any) {
      setPassMessage({ type: "error", text: `เกิดข้อผิดพลาด: ${err.message}` });
    } finally {
      setPassLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-slate-500 text-sm">
        กำลังโหลดข้อมูลบัญชีองค์กร...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-8 text-slate-800">
      
      {/* ---------------- 1. HEADER SECTION ---------------- */}
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
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="px-6 py-2.5 rounded-full border-2 border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-800 font-semibold text-xs md:text-sm transition shadow-sm self-start sm:self-auto disabled:opacity-50"
        >
          {isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
        </button>
      </div>

      {/* ---------------- 2. PROFILE BANNER CARD ---------------- */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 shadow-md shadow-slate-100 flex flex-col md:flex-row items-center justify-center gap-6 relative overflow-hidden">
        
        {/* รูปโปรไฟล์องค์กร */}
        <div className="relative">
          <div className="w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-slate-100 shadow-md bg-emerald-50 flex items-center justify-center">
            <Image
              src="/images/profile-placeholder.jpg"
              alt="Profile"
              width={128}
              height={128}
              className="object-cover w-full h-full"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <Building2 className="w-12 h-12 text-emerald-700 absolute" />
          </div>

          <button
            type="button"
            className="absolute bottom-1 right-1 bg-[#2C7A59] hover:bg-[#1f5a41] text-white p-2 rounded-full shadow-md transition border-2 border-white"
            title="เปลี่ยนรูปโปรไฟล์"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {/* ชื่อองค์กร & Status Badge */}
        <div className="text-center md:text-left space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>ยืนยันตัวตนแล้ว</span>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-2 text-xl md:text-2xl font-extrabold text-[#11221C]">
            <Building2 className="w-6 h-6 text-[#1F3E35] hidden sm:block" />
            <h2>{companyName || "บริษัท ตัวอย่าง จำกัด"}</h2>
          </div>
        </div>
      </div>

      {/* ---------------- 3. TWO COLUMN FORMS ---------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ----- การ์ดที่ 1: รายละเอียดองค์กร (ซ้าย) ----- */}
        <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 shadow-md shadow-slate-100 flex flex-col justify-between space-y-6">
          <form onSubmit={handleUpdateOrganization} className="space-y-5">
            <h3 className="text-lg font-bold text-[#11221C] text-center">
              รายละเอียดองค์กร
            </h3>

            {orgMessage && (
              <div
                className={`p-3 rounded-2xl text-xs font-medium text-center ${
                  orgMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-600 border border-red-200"
                }`}
              >
                {orgMessage.text}
              </div>
            )}

            {/* อีเมล */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                อีเมล (email)
              </label>
              <input
                type="email"
                disabled
                value={email}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-500 cursor-not-allowed"
              />
            </div>

            {/* ชื่อองค์กร / บริษัท */}
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
                placeholder="บริษัท ตัวอย่าง จำกัด"
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
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs bg-slate-50/50 flex items-center justify-between cursor-pointer text-slate-800 font-medium"
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
                        setOrgMessage(null);
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

            <div className="pt-2">
              <button
                type="submit"
                disabled={orgLoading}
                className="w-full py-3.5 bg-[#2C7A59] hover:bg-[#1f5a41] disabled:opacity-60 text-white font-bold rounded-2xl text-xs transition shadow-md cursor-pointer"
              >
                {orgLoading ? "กำลังบันทึก..." : "ยืนยันการเปลี่ยนแปลง"}
              </button>
            </div>
          </form>
        </div>

        {/* ----- การ์ดที่ 2: ตั้งค่าความปลอดภัย (ขวา) ----- */}
        <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 shadow-md shadow-slate-100 flex flex-col justify-between space-y-6">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <h3 className="text-lg font-bold text-[#11221C] text-center">
              ตั้งค่าความปลอดภัย
            </h3>

            {passMessage && (
              <div
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
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                รหัสผ่านใหม่ (new password)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50"
              />
            </div>

            {/* ยืนยันรหัสผ่านใหม่ */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                ยืนยันรหัสผ่านใหม่ (confirm-password)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50"
              />
            </div>

            {/* รหัสผ่านเดิม */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                รหัสผ่านเดิม (old-password)
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50"
              />
              <div className="text-right pt-0.5">
                <Link
                  href="/organization/forgot_password"
                  className="text-[11px] font-medium text-emerald-700 hover:underline"
                >
                  ลืมรหัสผ่านเดิม?
                </Link>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={passLoading}
                className="w-full py-3.5 bg-[#2C7A59] hover:bg-[#1f5a41] disabled:opacity-60 text-white font-bold rounded-2xl text-xs transition shadow-md cursor-pointer"
              >
                {passLoading ? "กำลังส่งลิงก์..." : "ยืนยันการเปลี่ยนแปลง"}
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* ---------------- 4. BOTTOM ACCOUNT MANAGEMENT CARD ---------------- */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 shadow-md shadow-slate-100 space-y-4">
        <div>
          <h3 className="text-xl font-bold text-[#11221C]">
            การจัดการบัญชี
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            หากต้องการเลิกใช้งานระบบและลบข้อมูลทั้งหมดถาวร
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (confirm("คุณแน่ใจหรือไม่ว่าต้องการปิดบัญชีถาวร? ข้อมูลทั้งหมดไม่สามารถกู้คืนได้")) {
              alert("แจ้งคำขอปิดบัญชีเรียบร้อยแล้ว เจ้าหน้าที่จะดำเนินการภายใน 24 ชม.");
            }
          }}
          className="px-6 py-2.5 rounded-full border-2 border-slate-300 hover:border-red-300 hover:bg-red-50 text-slate-600 hover:text-red-600 font-bold text-xs transition shadow-sm"
        >
          ปิดบัญชีถาวร
        </button>
      </div>

    </div>
  );
}