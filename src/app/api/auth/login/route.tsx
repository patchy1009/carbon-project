import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

// รับอีเมลและรหัสผ่านจากหน้าเว็บ ล็อกอินกับ Supabase ตรวจ role และสถานะ แล้วบอกหน้าเว็บว่าต้องไปหน้าไหน
export async function POST(request: Request) {
  try {
    // client ตัวนี้ผูกกับ cookie: signInWithPassword สำเร็จแล้ว session จะถูกเขียนลง cookie หน้าอื่นๆเลยรู้ว่าใครล็อกอกอินอยู่
    const supabase = await createSupabaseServer();  

    // รับข้อมูลจากหน้า Login
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

    // ตรวจสอบการเข้าสู่ระบบกับ Supabase Auth
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

    // ค้นหาข้อมูลผู้ใช้จาก public.user / acc_id ต้องตรงกับ auth.users.id
    const { data: userData, error: userError } = await supabase
      .from("user")
      .select("acc_id, role, status")
      .eq("acc_id", authData.user.id)
      .maybeSingle();
    if (userError) {
      await supabase.auth.signOut();
      console.error("Failed to fetch user profile:", userError.message);

      return NextResponse.json(
        { error: "ไม่สามารถตรวจสอบข้อมูลผู้ใช้ได้" },
        { status: 500 }
      );
    }

    // ถ้าไม่มีข้อมูลผู้ใช้ใน public.user ให้ปฏิเสธ
    if (!userData) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "ไม่พบข้อมูลบัญชีผู้ใช้ในระบบ" },
        { status: 403 }
      );
    }

    // ตรวจสอบสถานะบัญชีว่า active ไหม
    if (userData.status !== "active") {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "บัญชีนี้ไม่สามารถใช้งานได้" },
        { status: 403 }
      );
    }

    // ตรวจสอบ Role และกำหนดเส้นทาง
    let redirectTo: string;

    if (userData.role === "admin") {
      redirectTo = "/admin/ef-gwp";
    } else if (userData.role === "organization") {
      redirectTo = "/organization/dashboard";
    } else {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Role ของบัญชีไม่ถูกต้องหรือยังไม่ได้กำหนด" },
        { status: 403 }
      );
    }

    // ส่งผลลัพธ์กลับไปยังหน้า Login
    return NextResponse.json({
      success: true,
      role: userData.role,
      redirectTo,
    });
  } catch (error) {
    console.error("Login API error:", error);     

    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดภายในระบบ" },
      { status: 500 }
    );
  }
}

