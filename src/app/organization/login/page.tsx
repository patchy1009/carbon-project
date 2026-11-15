"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthModal from "@/components/AuthModal";
import { supabase } from "@/lib/supabaseClient";

// ข้อความแจ้งเตือนเมื่อถูกบล็อกจากหน้าที่ต้องล็อกอิน (proxy.ts ส่งมาเป็น ?notice=login_required)
const LOGIN_REQUIRED_NOTICE = "ต้องเข้าสู่ระบบก่อนจึงจะเข้าใช้งานหน้านั้นได้";

// ธง/ค่าของขั้นตอนตั้งรหัสผ่านใหม่ ชื่อต้องตรงกับที่หน้า forgot_password และ proxy.ts ใช้
const RESET_FLOW_COOKIE = "pw_reset_session";
const RESET_STORAGE_KEYS = ["pw_reset_expiry_time", "is_in_reset_flow"];

// อยู่ระหว่างขั้นตอนตั้งรหัสผ่านใหม่ที่ยังไม่เสร็จหรือไม่ (มี cookie ธงที่หน้า forgot_password จดไว้)
function isInResetFlow(): boolean {
  return document.cookie.split("; ").some((c) => c.startsWith(`${RESET_FLOW_COOKIE}=`) && c.length > RESET_FLOW_COOKIE.length + 1);
}

function LoginContent() {
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const loginNotice =
    searchParams.get("notice") === "login_required" ? LOGIN_REQUIRED_NOTICE : "";

  // ปิด Modal (คลิกพื้นหลัง) -> กลับหน้าแรก
  // ถ้าอยู่ระหว่างตั้งรหัสผ่านใหม่ที่ยังไม่เสร็จ ระบบมี session จากลิงก์รีเซ็ตค้างอยู่
  //   หน้าแรกจะมองว่าล็อกอินแล้วพาไปแดชบอร์ด แล้ว proxy.ts ก็บล็อกกลับมาหน้านี้อีก (วนอยู่ที่หน้า login ปิดกล่องไม่ได้)
  //   จึงถือว่าผู้ใช้ยกเลิกการตั้งรหัสผ่านใหม่: ออกจาก session นั้นและล้างธงก่อน แล้วค่อยกลับหน้าแรก
  //   (ถ้าต้องการตั้งรหัสผ่านใหม่ ขอลิงก์ใหม่ได้จากปุ่มลืมรหัสผ่าน)
  const handleClose = async () => {
    setIsOpen(false);

    if (isInResetFlow()) {
      await supabase.auth.signOut();
      document.cookie = `${RESET_FLOW_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
      RESET_STORAGE_KEYS.forEach((key) => sessionStorage.removeItem(key));
    }

    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <AuthModal
        isOpen={isOpen}
        onClose={handleClose}
        initialMode="login"
        loginNotice={loginNotice}
      />
    </div>
  );
}

// หน้าเข้าสู่ระบบ เปิดกล่องล็อกอินให้ทันทีเมื่อเข้าหน้านี้
// ผู้ดูแลระบบและองค์กรเข้าจากหน้านี้หน้าเดียวกัน (TOR ข้อ 2.1) ตัวกล่องล็อกอินคือ AuthModal
// useSearchParams ต้องอยู่ใน Suspense (กฎของ Next.js ตอน build)
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
