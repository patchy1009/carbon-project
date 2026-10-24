export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { TEMP_ORG_ID } from '@/lib/tempOrg';
import ReportClient, { type Measure } from './ReportClient';

export default async function FootprintReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [logRes, detailRes, recRes] = await Promise.all([
    supabase
      .from('org_activity_list')
      .select('*')
      .eq('orgactlist_id', id)
      .eq('org_id', TEMP_ORG_ID) // เปิดดูได้เฉพาะรายงานของตัวเอง
      .maybeSingle(),
    // รายละเอียดของรายการนี้ + scope ของแต่ละรายการ (activity_detail → activity → carbon_scope)
    supabase
      .from('org_activity_detail')
      .select('ghg_emission, activity_detail(activity(carbon_scope(scope_number)))')
      .eq('orgactlist_id', id),
    // มาตรการลดก๊าซที่แอดมินกรอกไว้ (หน้า officerec)
    supabase.from('carbon_reduction_recommendation').select('*'),
  ]);

  const log = logRes.data;
  if (!log) notFound();

  // รวมก๊าซแยกตาม scope
  const byScope: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const d of (detailRes.data ?? []) as any[]) {
    const n = d.activity_detail?.activity?.carbon_scope?.scope_number;
    if (n && n in byScope) byScope[n] += Number(d.ghg_emission) || 0;
  }

  const measures: Measure[] = (recRes.data ?? [])
    .map((r: any) => ({
      name: String(r.recommendation ?? ''),                       // ← ชื่อคอลัมน์ข้อความมาตรการ
      amount: Math.abs(Number(r.carbon_reduction_amount) || 0),   // ← ชื่อคอลัมน์ปริมาณที่ลดได้
    }))
    .filter((m) => m.name)
    .sort((a, b) => b.amount - a.amount) // เรียงตามผลกระทบสูงสุด
    .slice(0, 6);

  return (
    <ReportClient
      logId={id}
      report={{
        name: log.orgact_name,
        createdAt: log.created_at,
        total: Number(log.total_ghg_emission) || 0,
        s1: byScope[1],
        s2: byScope[2],
        s3: byScope[3],
      }}
      measures={measures}
    />
  );
}