import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabaseServer";

export type Role = "admin" | "organization";

export interface CurrentUser {
  id: string; // = auth.users.id = user.acc_id = org_id / admin_id ในตารางอื่น
  email: string | null;
  role: Role;
}

/* คืนผู้ใช้ที่ล็อกอินอยู่ (อ่านจาก cookie) หรือ null ถ้ายังไม่ล็อกอิน/บัญชีใช้ไม่ได้ */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServer();

  // getUser() ตรวจ token กับเซิร์ฟเวอร์ Supabase ทุกครั้ง เชื่อถือได้กว่า getSession()
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user")
    .select("role, status")
    .eq("acc_id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") return null;
  if (profile.role !== "admin" && profile.role !== "organization") return null;

  return { id: user.id, email: user.email ?? null, role: profile.role };
}

/* ใช้ในหน้าฝั่งองค์กร: ไม่ได้ล็อกอินหรือไม่ใช่องค์กร -> เด้งไปหน้า login แล้วคืน org_id */
export async function requireOrgId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.role !== "organization") redirect("/organization/login");
  return user.id;
}

/* ใช้ในหน้าฝั่งแอดมิน: ไม่ได้ล็อกอินหรือไม่ใช่แอดมิน -> เด้งไปหน้า login แล้วคืน admin_id */
export async function requireAdminId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/organization/login");
  return user.id;
}
