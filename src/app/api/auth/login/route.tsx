
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    // 1. รับข้อมูลจากหน้า Login
    const body = await request.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "กรุณากรอกอีเมลและรหัสผ่าน" },
        { status: 400 }
      );
    }

    // 2. ตรวจสอบการเข้าสู่ระบบกับ Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    // 3. ค้นหาข้อมูลผู้ใช้จาก public.user
    // acc_id ต้องตรงกับ auth.users.id
    const { data: userData, error: userError } = await supabase
      .from("user")
      .select("acc_id, role, status")
      .eq("acc_id", authData.user.id)
      .maybeSingle();

    if (userError) {
      console.error("Failed to fetch user profile:", userError.message);

      return NextResponse.json(
        { error: "ไม่สามารถตรวจสอบข้อมูลผู้ใช้ได้" },
        { status: 500 }
      );
    }

    // 4. ถ้าไม่มีข้อมูลผู้ใช้ใน public.user ให้ปฏิเสธ
    if (!userData) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลบัญชีผู้ใช้ในระบบ" },
        { status: 403 }
      );
    }

    // 5. ตรวจสอบสถานะบัญชี
    // สมมติว่าบัญชีที่ใช้งานได้ใช้ค่า status = "active"
    if (userData.status !== "active") {
      return NextResponse.json(
        { error: "บัญชีนี้ไม่สามารถใช้งานได้" },
        { status: 403 }
      );
    }

    // 6. ตรวจสอบ Role และกำหนดเส้นทาง
    let redirectTo: string;

    if (userData.role === "admin") {
      redirectTo = "/admin/ef-gwp";
    } else if (userData.role === "organization") {
      redirectTo = "/organization/dashboard";
    } else {
      return NextResponse.json(
        { error: "Role ของบัญชีไม่ถูกต้องหรือยังไม่ได้กำหนด" },
        { status: 403 }
      );
    }

    // 7. ส่งผลลัพธ์กลับไปยังหน้า Login
    return NextResponse.json({
      success: true,
      role: userData.role,
      redirectTo,
      session: authData.session,
    });
  } catch (error) {
    console.error("Login API error:", error);

    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดภายในระบบ" },
      { status: 500 }
    );
  }
}
