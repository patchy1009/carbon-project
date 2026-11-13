import { NextResponse, type NextRequest } from "next/server";   //ใช้สร้าง response และอ่าน request
import { createServerClient } from "@supabase/ssr";   // สร้าง Supabase Client สำหรับฝั่ง Server ที่จัดการ Cookies ได้

// วิ่งก่อนทุกหน้าใน /organization และ /admin
// จัดการ session ของ Supabase 
// ยังไม่ล็อกอิน -> เด้งไปหน้า login (เช็ก role ละเอียดใน requireOrgId / requireAdminId)
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

  return response;
}

export const config = { matcher: ["/organization/:path*", "/admin/:path*"] };