"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthModal from "@/components/AuthModal";

// หน้าสมัครสมาชิกองค์กร (TOR ข้อ 1) ฝั่ง browser
// ฟอร์มสมัคร + ยืนยัน OTP อยู่ที่ AuthModal ที่เดียว (ใช้ร่วมกับปุ่มเมนูด้านบนและหน้าเข้าสู่ระบบ)
// ไฟล์นี้ทำแค่เปิด AuthModal ในโหมดสมัครทันทีที่เข้าหน้า แบบเดียวกับหน้า login
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
