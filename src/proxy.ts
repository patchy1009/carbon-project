import { NextResponse, type NextRequest } from "next/server";   //ใช้สร้าง response และอ่าน request
import { createServerClient } from "@supabase/ssr";   // สร้าง Supabase Client สำหรับฝั่ง Server ที่จัดการ Cookies ได้

// ธง "กำลังตั้งรหัสผ่านใหม่จากลิงก์รีเซ็ต" หน้า forgot_password เป็นคนจดไว้เป็น cookie (ผูกกับ session_id) ชื่อต้องตรงกัน
const RESET_FLOW_COOKIE = "pw_reset_session";

// อ่าน session_id จาก access token (JWT) ของ Supabase ไม่ได้ verify ลายเซ็น เพราะด้านล่างเรียก getUser() ตรวจ token แล้ว
function getSessionId(accessToken: string | null | undefined): string | null {
  try {
    const payload = accessToken?.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)));
    return typeof claims?.session_id === "string" ? claims.session_id : null;
  } catch {
    return null;
  }
}

// วิ่งก่อนทุกหน้าใน /organization และ /admin
// จัดการ session ของ Supabase 
// ยังไม่ล็อกอิน -> เด้งไปหน้า login (เช็ก role ละเอียดใน requireOrgId / requireAdminId)
// ล็อกอินด้วย session จากลิงก์รีเซ็ตรหัสผ่านที่ยังตั้งรหัสใหม่ไม่เสร็จ -> เด้งไปหน้า login พร้อมแจ้งว่าต้องเข้าสู่ระบบก่อน
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  // หน้าที่เข้าได้เลย
  const PUBLIC_PATHS = [
    "/organization/login", 
    "/organization/homepage", 
    "/organization/register", 
    "/organization/forgot_password", 
  ];
  const isLoginPage = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL("/organization/login", request.url));
  }

  // session จากลิงก์รีเซ็ตรหัสผ่านที่ยังตั้งรหัสใหม่ไม่เสร็จ -> ยังไม่นับว่าล็อกอิน เข้าหน้าอื่นไม่ได้
  // ส่งไปหน้า login พร้อม ?notice=login_required ให้หน้า login แจ้งว่าต้องเข้าสู่ระบบก่อน
  // (ล็อกอินด้วยรหัสผ่านตามปกติจะได้ session_id ใหม่ ธงเก่าจึงไม่มีผล)
  const resetSessionId = request.cookies.get(RESET_FLOW_COOKIE)?.value;
  if (user && resetSessionId && !isLoginPage) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (getSessionId(session?.access_token) === resetSessionId) {
      const loginRequiredUrl = new URL("/organization/login", request.url);
      loginRequiredUrl.searchParams.set("notice", "login_required");
      const redirect = NextResponse.redirect(loginRequiredUrl);
      // เก็บ cookie session ที่ Supabase เพิ่งรีเฟรชไว้ ไม่ให้หายตอน redirect
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
  }

  return response;
}

export const config = { matcher: ["/organization/:path*", "/admin/:path*"] };