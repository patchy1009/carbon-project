export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabaseClient';
import OfficeRecommendationClient from './OfficeRecommendationClient';

export default async function OfficeRecommendationPage() {
  const [infoRes, recRes, actRes] = await Promise.all([
    // หัวข้อข้อมูลสำนักงาน
    supabase.from('office_info_type').select('*').order('updated_at', { ascending: true }),
    // แนวทางลดคาร์บอน + เงื่อนไขของแต่ละแนวทาง
    supabase.from('carbon_reduction_recommendation').select('*, recommendation_condition(*)'),
    // รายการกิจกรรม (ใช้เป็นตัวเลือกใน dropdown)
    supabase
      .from('activity_detail')
      .select('scopedetail_id, detail_name, unit')
      .order('detail_name'),
  ]);

  for (const r of [infoRes, recRes, actRes]) {
    if (r.error) console.error('Fetch error:', r.error.message);
  }

  return (
    <OfficeRecommendationClient
      initialInfoTypes={(infoRes.data ?? []) as any[]}
      initialRecs={(recRes.data ?? []) as any[]}
      activityOptions={(actRes.data ?? []) as any[]}
    />
  );
}