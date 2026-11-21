export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireAdminId } from '@/lib/auth';
import OfficeRecommendationClient from './OfficeRecommendationClient';

// ตรวจสิทธิ์แอดมิน ดึงหัวข้อข้อมูลสำนักงาน แนวทาง และกิจกรรม แล้วส่งให้หน้าจอ
export default async function OfficeRecommendationPage() {
  await requireAdminId(); // ไม่ใช่แอดมิน -> เด้งไปหน้า login
  const supabase = await createSupabaseServer();
  const [infoRes, recRes, actRes, scopeRes, groupRes] = await Promise.all([
    // หัวข้อข้อมูลสำนักงาน
    // + ตัวเลือกของหัวข้อแบบตัวเลือก (office_info_option)
    supabase.from('office_info_type').select('*, office_info_option(*)').order('updated_at', { ascending: true }),
    // แนวทางลดคาร์บอน + เงื่อนไขของแต่ละแนวทาง (+ ตัวเลือกของเงื่อนไขแบบตัวเลือก)
    supabase
      .from('carbon_reduction_recommendation')
      .select('*, recommendation_condition(*, recommendation_condition_option(option_id))'),
    // รายการกิจกรรม (ใช้เป็นตัวเลือกใน dropdown)
    supabase
      .from('activity_detail')
      .select('scopedetail_id, detail_name, unit, activity_id')
      .order('detail_name'),
    // Scope และกิจกรรม: ใช้เป็นฐานของ % แบบ "ทั้ง Scope" / "ทั้งกิจกรรม" (supabase/recommendation_base_level.sql)
    supabase.from('carbon_scope').select('scope_id, scope_number, scope_name').order('scope_number'),
    supabase.from('activity').select('activity_id, activity_name, scope_id').order('activity_name'),
  ]);

  for (const r of [infoRes, recRes, actRes, scopeRes, groupRes]) {
    if (r.error) console.error('Fetch error:', r.error.message);
  }

  return (
    <OfficeRecommendationClient
      initialInfoTypes={(infoRes.data ?? []) as any[]}
      initialRecs={(recRes.data ?? []) as any[]}
      activityOptions={(actRes.data ?? []) as any[]}
      scopeOptions={(scopeRes.data ?? []) as any[]}
      activityGroups={(groupRes.data ?? []) as any[]}
    />
  );
}