import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// วิ่งก่อนทุกหน้าใน /organization และ /admin
// 1) รีเฟรช token ของ Supabase ที่หมดอายุแล้วเขียน cookie ใหม่
// 2) ยังไม่ล็อกอิน -> เด้งไปหน้า login (เช็ก role ละเอียดใน requireOrgId / requireAdminId)
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

  const isLoginPage = request.nextUrl.pathname === "/organization/login";
  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL("/organization/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/organization/:path*", "/admin/:path*"],
};
