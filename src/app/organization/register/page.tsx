"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import AuthModal from "@/components/AuthModal";

export default function RegisterPage() {
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();

  // เมื่อปิด Modal ให้พาย้อนกลับไปหน้าหลัก (Homepage)
  const handleClose = () => {
    setIsOpen(false);
    router.push("/organization/homepage");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* Pop-up Register กลางหน้าจอ */}
      <AuthModal 
        isOpen={isOpen} 
        onClose={handleClose} 
        initialMode="register" 
      />

      {/* ข้อความแสดงเบื้องหลังกรณีฉากหลังโหลด */}
      <div className="text-center text-gray-400 text-sm">
        กำลังโหลดหน้าลงทะเบียน...
      </div>
    </div>
  );
}