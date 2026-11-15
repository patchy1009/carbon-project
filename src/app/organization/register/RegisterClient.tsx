"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthModal from "@/components/AuthModal";

// หน้าสมัครสมาชิกองค์กรฝั่ง browser
// เปิด AuthModal ในโหมดสมัครทันทีที่เข้าหน้า แบบเดียวกับหน้า login
export default function RegisterClient() {
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();

  // ปิดกล่องสมัคร -> กลับหน้าแรก
  const handleClose = () => {
    setIsOpen(false);
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <AuthModal isOpen={isOpen} onClose={handleClose} initialMode="register" />
    </div>
  );
}
