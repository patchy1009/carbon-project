/*
 * API ลงทะเบียนองค์กร POST /api/auth/register
 * ขั้นตอน: ตรวจข้อมูล (ครบ/เป็นข้อความ/ไม่มี Syntax คล้าย SQL) -> เช็กอีเมลซ้ำ
 * Username ซ้ำกับบัญชีอื่นได้ เพราะบัญชีระบุด้วยอีเมล (ไม่ซ้ำ + ยืนยันด้วย OTP) ส่วน Username เป็นชื่อผู้ใช้งานที่ใช้แสดงผล
 *          -> สร้างบัญชีใน Supabase Auth (Supabase ส่งรหัส OTP ไปที่อีเมลให้)
 * ที่นี่ "ยังไม่" บันทึกตาราง user / organization เพราะยังไม่ได้ยืนยัน OTP (ยังไม่ล็อกอิน ตาม RLS บันทึกไม่ได้)
 * การบันทึกสองตารางนั้นทำที่ AuthModal (components/AuthModal.tsx) หลังยืนยัน OTP สำเร็จ
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { containsSqlSyntax } from "@/lib/sqlSyntax"; // ตรวจ Syntax ป้องกัน SQL Injection
import { getErrorMessage } from "@/lib/errorMessage"; // แปล error ของ Supabase (ภาษาอังกฤษ) เป็นภาษาไทย
import { validatePasswordStrength } from "@/lib/authRules"; // กติการหัสผ่านกลาง (ยาวอย่างน้อย 8 ตัว มีตัวอักษรอังกฤษและตัวเลข)

// Supabase client ฝั่ง server (ใช้ anon key ทำงานตามสิทธิ์ของคนที่ยังไม่ล็อกอิน)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, email, password, companyName, industry } = body;

    if (!username || !email || !password || !companyName) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    // ตรวจ Syntax คล้ายคำสั่ง SQL ฝั่ง server กันการยิง API ตรงโดยไม่ผ่านหน้าเว็บ
    // ทุกช่องต้องเป็นข้อความ แล้วตรวจก่อนทำอย่างอื่น (รหัสผ่านใช้โหมด lenient เพราะรหัสผ่านที่ดีมีสัญลักษณ์ได้)
    if (
      [username, email, password, companyName].some((v) => typeof v !== "string") ||
      (industry !== undefined && typeof industry !== "string")
    ) {
      return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }

    if (
      containsSqlSyntax(username) ||
      containsSqlSyntax(email) ||
      containsSqlSyntax(companyName) ||
      containsSqlSyntax(password, { lenient: true }) ||
      (typeof industry === "string" && containsSqlSyntax(industry))
    ) {
      return NextResponse.json(
        { error: "ข้อมูลที่กรอกมีรูปแบบที่ไม่อนุญาต คล้ายคำสั่ง SQL" },
        { status: 400 }
      );
    }

    // ตรวจรูปแบบรหัสผ่านฝั่ง server ด้วย (เดิมตรวจที่หน้าเว็บอย่างเดียว ยิง API ตรงจะข้ามได้)
    const passwordProblem = validatePasswordStrength(password);
    if (passwordProblem) {
      return NextResponse.json({ error: passwordProblem }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    // 1. ตรวจอีเมลซ้ำในตาราง user อีกชั้นหนึ่ง
    // (ถ้า RLS ไม่ให้อ่านตาราง user จะไม่พบแถว ตัวกันอีเมลซ้ำที่ใช้ได้จริงคือขั้นที่ 2)
    // ไม่ตรวจ Username ซ้ำ: Username ซ้ำกับบัญชีอื่นได้ เพราะบัญชีระบุด้วยอีเมล
    const { data: existingUser, error: checkError } = await supabase
      .from("user")
      .select("email")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (checkError) {
      console.warn("Email lookup warning:", checkError.message);
    }

    if (existingUser) {
      return NextResponse.json(
        { error: "อีเมลนี้ถูกลงทะเบียนใช้งานไปแล้ว กรุณาเข้าสู่ระบบ" },
        { status: 400 }
      );
    }

    // 2. สร้างบัญชีใน Supabase Auth (รหัสผ่านถูกแฮชโดย Supabase และ Supabase ส่ง OTP ทางอีเมล)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          username: cleanUsername,
          company_name: companyName,
          industry,
        },
      },
    });

    if (signUpError) {
      throw signUpError;
    }

    // อีเมลนี้เคยสมัครและยืนยันแล้ว: Supabase ไม่แจ้ง error แต่ส่งผู้ใช้ที่ identities ว่างกลับมา
    if (
      signUpData.user &&
      signUpData.user.identities &&
      signUpData.user.identities.length === 0
    ) {
      return NextResponse.json(
        { error: "อีเมลนี้ถูกลงทะเบียนใช้งานไปแล้ว กรุณาเข้าสู่ระบบ" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "สมัครสมาชิกสำเร็จ กรุณาตรวจสอบ OTP ทางอีเมล" },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("API Register error:", error);
    // signUp ของ Supabase ส่ง error เป็นภาษาอังกฤษ (เช่น "email rate limit exceeded") จึงแปลก่อนส่งให้หน้าเว็บ
    const message = getErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}