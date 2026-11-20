// ส่วนที่ทำงานฝั่ง server ของหน้า T-VER: ตรวจสิทธิ์แอดมินแล้วดึงเงื่อนไขโครงการ
// [แก้ไข] เอารายการพันธุ์ไม้ (tree_list) ออก: พันธุ์ไม้ไม่มีผลต่อการคำนวณ (MAI 9.5 เท่ากันทุกพันธุ์)
export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireAdminId } from '@/lib/auth';
import TverProjectClient from './TverProjectClient';
import type { TverProjectDetail } from '@/types/tver-project';

// ดึงเงื่อนไขโครงการ แล้วส่งให้หน้าจอ
export default async function TverProjectPage() {
  await requireAdminId(); // ไม่ใช่แอดมิน -> เด้งไปหน้า login
  const supabase = await createSupabaseServer();
  const detailsRes = await supabase.from('tver_project_detail').select('*').order('updated_at');

  return <TverProjectClient initialDetails={(detailsRes.data ?? []) as TverProjectDetail[]} />;
}