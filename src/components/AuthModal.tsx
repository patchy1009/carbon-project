"use client";

import React, { useState } from "react";
import Modal from "./Modal";
import { supabase } from "@/lib/supabaseClient";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
}

const industries = [
  { value: "energy", label: "พลังงานและสาธารณูปโภค" },
  { value: "manufacturing", label: "การผลิตและอุตสาหกรรม" },
  { value: "services", label: "บริการและการพาณิชย์" },
];

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = "login",
}: AuthModalProps) {
  // state จัดการขั้นตอนปัจจุบัน: 'login' | 'register' | 'otp'
  const [step, setStep] = useState<"login" | "register" | "otp">(initialMode);

  // state ฟอร์ม Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrorMessage, setLoginErrorMessage] = useState("");

  // state ฟอร์ม Register
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regOrgName, setRegOrgName] = useState("");
  const [regIndustry, setRegIndustry] = useState(industries[0].value);
  const [regErrorMessage, setRegErrorMessage] = useState("");

  // state ช่องกรอก OTP 6 ช่อง
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpErrorMessage, setOtpErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  // ฟังก์ชันสลับช่อง OTP อัตโนมัติเมื่อพิมพ์
  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value.replace(/\D/g, "");
    setOtp(newOtp);
    setOtpErrorMessage("");

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  // =====================================================
  // LOGIN SUBMIT (Supabase Auth)
  // =====================================================
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrorMessage("");

    if (!loginEmail || !loginPassword) {
      setLoginErrorMessage("กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("ไม่พบข้อมูลผู้ใช้งาน");
      }

      // ตรวจสอบ Role จาก metadata หรือตาราง organizations ถ้ามี
      // เบื้องต้นให้เปลี่ยนเส้นทางไปหน้า organization homepage หรือ admin ตามต้องการ
      onClose();
      window.location.href = "/organization/homepage";
    } catch (err: any) {
      console.error("Login error:", err);
      setLoginErrorMessage("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================================
  // REGISTER SUBMIT (Supabase Auth Sign Up & Send OTP)
  // =====================================================
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegErrorMessage("");

    if (!regEmail || !regPassword || !regOrgName || !regIndustry) {
      setRegErrorMessage("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    if (regPassword.length < 6) {
      setRegErrorMessage("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setIsLoading(true);

    try {
      // 1. ตรวจสอบว่ามีอีเมลนี้ใน organizations หรือยัง
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("email")
        .eq("email", regEmail.trim().toLowerCase())
        .maybeSingle();

      if (existingOrg) {
        setRegErrorMessage("อีเมลนี้มีบัญชีองค์กรในระบบแล้ว กรุณาเข้าสู่ระบบ");
        setIsLoading(false);
        return;
      }

      // 2. สมัครสมาชิกผ่าน Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        options: {
          data: {
            company_name: regOrgName,
            industry: regIndustry,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        await supabase.auth.signOut();
        setRegErrorMessage("กรุณาเปิดใช้งาน Confirm Email ใน Supabase ก่อน");
        setIsLoading(false);
        return;
      }

      setStep("otp");
      setSuccessMessage("ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว");
    } catch (err: any) {
      console.error("Register error:", err);
      setRegErrorMessage(err?.message || "ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================================
  // VERIFY OTP SUBMIT & INSERT TO ORGANIZATIONS TABLE
  // =====================================================
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpErrorMessage("");

    const fullOtp = otp.join("");
    if (fullOtp.length < 6) {
      setOtpErrorMessage("กรุณากรอกรหัส OTP ให้ครบถ้วน 6 หลัก");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: regEmail.trim().toLowerCase(),
        token: fullOtp,
        type: "signup",
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("ไม่พบข้อมูลผู้ใช้");
      }

      // บันทึกข้อมูลองค์กรลงในฐานข้อมูล Supabase ตาราง organizations
      const { error: orgError } = await supabase.from("organizations").insert({
        email: regEmail.trim().toLowerCase(),