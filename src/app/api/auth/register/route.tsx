/* [MERGE aom + cyn2] ไฟล์นี้ = โค้ด cyn2 ทั้งไฟล์ (ฟีเจอร์ที่ aom ไม่มี) — แก้เฉพาะจุด [MERGE-FIX aom] (ย้ายการบันทึก user/organization ไปหลังยืนยัน OTP)
 * API ลงทะเบียน: สร้างบัญชี Supabase Auth (แถว user/organization สร้างหลังยืนยัน OTP) */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js"; // เปลี่ยนมาใช้ตัวนี้สำหรับฝั่ง Server

// สร้าง Supabase Client สำหรับฝั่ง Server โดยเฉพาะ
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

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    // 1. ตรวจสอบ Username ซ้ำในตาราง user
    // [MERGE-FIX aom] เดิมอ่านตาราง user ตรงๆ แต่คนที่ยังไม่ล็อกอินอ่านไม่ได้ (RLS) -> ได้ผล "ไม่ซ้ำ" เสมอ
    // เปลี่ยนมาเรียกฟังก์ชัน is_username_taken ใน supabase/rls_user_organization.sql
    // ซึ่งตอบแค่ true/false ไม่เปิดข้อมูลของผู้ใช้คนอื่น
    const { data: usernameTaken, error: checkUsernameError } = await supabase.rpc(
      "is_username_taken",
      { p_username: cleanUsername }
    );

    // เช็กไม่ได้ = ไม่ให้สมัครต่อ (กันกรณีได้บัญชี Auth แต่บันทึกตาราง user ไม่ได้เพราะชื่อซ้ำ)
    if (checkUsernameError) {
      console.error("Username check error:", checkUsernameError.message);
      return NextResponse.json(
        { error: "ไม่สามารถตรวจสอบชื่อผู้ใช้งานได้ กรุณาลองใหม่อีกครั้ง" },
        { status: 500 }
      );
    }

    if (usernameTaken) {
      return NextResponse.json(
        { error: "ชื่อผู้ใช้งาน (Username) นี้ถูกใช้งานไปแล้ว กรุณาใช้ชื่ออื่น" },
        { status: 400 }
      );
    }

    // 2. ตรวจสอบ Email ซ้ำในตาราง user
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

    // 3. สมัครสมาชิกผ่าน Supabase Auth
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

    // 4. [MERGE-FIX aom] เอาการบันทึกตาราง user + organization ออกจากตรงนี้
    // เหตุผล: ตอนนี้ยังไม่ได้ยืนยัน OTP = ยังไม่ล็อกอิน -> RLS ไม่ให้บันทึก (และเดิมไม่ได้เช็ก error)
    // ย้ายไปทำในหน้า register หลัง verifyOtp แล้ว (src/app/organization/register/page.tsx)

    return NextResponse.json(
      { message: "สมัครสมาชิกสำเร็จ กรุณาตรวจสอบ OTP ทางอีเมล" },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("API Register error:", error);
    const message =
      error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}