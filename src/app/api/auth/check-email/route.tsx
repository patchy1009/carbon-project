/*
 * API ตรวจว่าอีเมลนี้มีบัญชีในระบบหรือไม่ ก่อนส่งลิงก์รีเซ็ตรหัสผ่าน (TOR ข้อ 3.2, 3.4)  POST /api/auth/check-email
 * ขั้นตอน: ตรวจรูปแบบอีเมล -> ตรวจ Syntax คล้าย SQL -> ถามฟังก์ชัน is_email_registered (supabase/is_email_registered.sql)
 * ตอบ 200 = มีบัญชี (หน้าเว็บส่งลิงก์รีเซ็ตต่อได้) / 404 = ไม่พบอีเมลนี้ / 400 = ข้อมูลไม่ถูกต้อง / 500 = ตรวจไม่ได้
 * ที่นี่ "ไม่" ส่งลิงก์ เพราะลิงก์ต้องขอจากเบราว์เซอร์ของผู้ใช้ (Supabase ผูกลิงก์กับเบราว์เซอร์ที่ขอ)
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { containsSqlSyntax } from "@/lib/sqlSyntax"; // ตรวจ Syntax ป้องกัน SQL Injection
import { EMAIL_REGEX } from "@/lib/authRules";

// Supabase client ฝั่ง server (ใช้ anon key ทำงานตามสิทธิ์ของคนที่ยังไม่ล็อกอิน)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "รูปแบบอีเมลไม่ถูกต้อง เช่น name@company.co.th" },
        { status: 400 }
      );
    }
    if (containsSqlSyntax(email)) {
      return NextResponse.json(
        { error: "อีเมลมีรูปแบบที่ไม่อนุญาต (คล้ายคำสั่ง SQL) กรุณากรอกใหม่" },
        { status: 400 }
      );
    }

    // คนที่ยังไม่ล็อกอินอ่านตาราง user ตรงๆ ไม่ได้ (RLS) จึงเรียกฟังก์ชัน is_email_registered ซึ่งตอบแค่ true/false
    const { data: registered, error } = await supabase.rpc("is_email_registered", {
      p_email: email,
    });

    if (error) {
      console.error("Email check error:", error.message);
      return NextResponse.json(
        { error: "ไม่สามารถตรวจสอบอีเมลได้ กรุณาลองใหม่อีกครั้ง" },
        { status: 500 }
      );
    }

    if (!registered) {
      return NextResponse.json(
        { error: "ไม่พบบัญชีที่ใช้อีเมลนี้ กรุณาตรวจสอบอีเมลอีกครั้ง หรือสมัครสมาชิกก่อน" },
        { status: 404 }
      );
    }

    return NextResponse.json({ registered: true });
  } catch (error: unknown) {
    console.error("Email check server error:", error);
    return NextResponse.json(
      { error: "ไม่สามารถตรวจสอบอีเมลได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
