import { createBrowserClient } from "@supabase/ssr";

// ใช้ใน Client Component ('use client') เท่านั้น
// เก็บ session ไว้ใน cookie ทำให้ฝั่ง server (page.tsx / proxy) อ่านได้ว่าใครล็อกอินอยู่
// ฝั่ง server ให้ใช้ createSupabaseServer() จาก '@/lib/supabaseServer' แทน
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
