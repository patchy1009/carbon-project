
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import AuthModal from "@/components/AuthModal";

export default function LoginPage() {
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();

  // ปิด Modal แล้วกลับหน้าแรก ไม่ใช่หน้า Dashboard
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
      />

      <div className="text-center text-gray-400 text-sm">
        กำลังโหลดหน้าเข้าสู่ระบบ...
      </div>
    </div>
  );
}
