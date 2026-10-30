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
    const { data: existingUsername, error: checkUsernameError } = await supabase
      .from("user")
      .select("username")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (checkUsernameError) {
      console.warn("Username lookup warning:", checkUsernameError.message);
    }

    if (existingUsername) {
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

    // 4. บันทึกข้อมูลลงตาราง user และ organization เบื้องต้น
    // (สามารถทำส่วนนี้ที่นี่ หรือจะรอทำตอน verify OTP ก็ได้ ตามโครงสร้างที่คุณออกแบบไว้)
    if (signUpData.user) {
      const userId = signUpData.user.id;

      // บันทึกตาราง user
      await supabase.from("user").insert({
        acc_id: userId,
        email: cleanEmail,
        username: cleanUsername,
        role: "organization",
        status: "active",
      });

      // บันทึกตาราง organization
      await supabase.from("organization").insert({
        acc_id: userId,
        org_name: companyName,
        business_type: industry,
      });
    }

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