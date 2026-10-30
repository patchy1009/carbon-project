"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import AuthModal from "@/components/AuthModal";

export default function LoginPage() {
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();

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
      />
    </div>
  );
}