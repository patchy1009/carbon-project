import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// หน้าแรกของเว็บ: ถ้ายังล็อกอินค้างอยู่ ให้ไปหน้าหลักของตัวเองตามบทบาททันที
//   ผู้ดูแลระบบ -> /admin/ef-gwp   องค์กร -> /organization/dashboard   ยังไม่ล็อกอิน -> หน้าแรก (landing)
export default async function Home() {
  const user = await getCurrentUser();
  if (user?.role === "admin") redirect("/admin/ef-gwp");
  if (user?.role === "organization") redirect("/organization/dashboard");
  redirect("/organization/homepage");
}
