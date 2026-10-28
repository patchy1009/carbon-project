import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// ใช้ใน Server Component (page.tsx) และ Route Handler (app/api/**)
// อ่าน session จาก cookie -> query ทุกครั้งวิ่งในนามผู้ใช้ที่ล็อกอิน (auth.uid() ใน RLS ใช้ได้)
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component เขียน cookie ไม่ได้ ไม่เป็นไร เพราะ proxy.ts รีเฟรช session ให้แล้ว
          }
        },
      },
    }
  );
}
