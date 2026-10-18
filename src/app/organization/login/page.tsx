"use client";

import { useRouter } from "next/navigation";
import AuthModal from "@/components/AuthModal";

export default function LoginPage() {
  const router = useRouter();

  // เมื่อปิด Modal ให้พาย้อนกลับไปหน้าหลัก (Homepage)
  const handleClose = () => {
    router.push("/organization/homepage");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* Pop-up Login กลางหน้าจอ */}
      <AuthModal 
        isOpen={true} 
        onClose={handleClose}
      />

      {/* ข้อความแสดงเบื้องหลังกรณีฉากหลังโหลด */}
      <div className="text-center text-gray-400 text-sm">
        กำลังโหลดหน้าเข้าสู่ระบบ...
      </div>
    </div>
  );
}