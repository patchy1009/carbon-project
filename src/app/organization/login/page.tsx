"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthModal from "@/components/AuthModal";

// ข้อความแจ้งเตือนเมื่อถูกบล็อกจากหน้าที่ต้องล็อกอิน (proxy.ts ส่งมาเป็น ?notice=login_required)
const LOGIN_REQUIRED_NOTICE = "ต้องเข้าสู่ระบบก่อนจึงจะเข้าใช้งานหน้านั้นได้";

function LoginContent() {
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const loginNotice =
    searchParams.get("notice") === "login_required" ? LOGIN_REQUIRED_NOTICE : "";

  // จัดการเมื่อปิด Modal ปกติให้กลับหน้าแรก
  const handleClose = () => {
    setIsOpen(false);
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
