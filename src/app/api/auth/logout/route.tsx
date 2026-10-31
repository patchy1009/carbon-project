import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

// ลบ session ออกจาก cookie
export async function POST() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
