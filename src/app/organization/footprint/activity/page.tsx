export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import FootprintClient from './FootprintClient';
import type { CarbonScope } from '@/types/activity-management';
import type { ActivityDetailWithValues, ScopeGroup } from '@/types/footprint';

export default async function FootprintActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();
  const { edit } = await searchParams;

  // รายการที่ให้กรอกตามสโคป (ดึงจาก activity_detail ที่แอดมินเพิ่มไว้)
  const DETAIL_COLS = `
      scopedetail_id,
      detail_name,
      unit,
      activity(activity_id, activity_name, scope_id),
      emission_factor(ef_value),
      global_warming_potential(gwp_value)`;
  const loadDetails = async () => {
    const res = await supabase.from('activity_detail').select(`${DETAIL_COLS}, ocr_source`);
    // [แก้ไข] ถ้ายังไม่ได้รัน supabase/activity_detail_ocr_source.sql คอลัมน์ ocr_source จะยังไม่มี (42703)
    // เดิม query ทั้งก้อน error -> หน้าไม่แสดงช่องกรอกเลย ตอนนี้โหลดใหม่โดยไม่เอาคอลัมน์นั้น (OCR ยังเติมฟอร์มไม่ได้จนกว่าจะรัน SQL)
    if (res.error?.code === '42703') {
      console.warn('[footprint] activity_detail.ocr_source ยังไม่มี กรุณารัน supabase/activity_detail_ocr_source.sql');
      return supabase.from('activity_detail').select(DETAIL_COLS);
    }
    if (res.error) console.error('[footprint] โหลด activity_detail ไม่สำเร็จ:', res.error.message);
    return res;
  };

  // [แก้ไข] เลิกนับข้อมูลสำนักงานทั้งองค์กรที่นี่ (ข้อมูลสำนักงานเป็นของแต่ละรายการแล้ว
  // รายการใหม่ดูจากค่าที่กรอกในขั้นที่ 1 ฝั่งเบราว์เซอร์แทน)
  const [scopesRes, detailsRes] = await Promise.all([
    supabase.from('carbon_scope').select('*').order('scope_number'),
    loadDetails(),
  ]);

  // ถ้ามี ?edit=รหัส ให้โหลดค่าที่เคยกรอก (เฉพาะรายการของตัวเอง)
  // [แก้ไข] เลิกโหลดบิลจาก org_bill_file แล้ว (OCR ช่วยกรอกอย่างเดียว ไม่เก็บบิล)
  let existingLogId: string | null = null;
  let existingName = '';
  let existingPeriod = '';
  let existingPeriodType: 'month' | 'year' = 'month';
  const existingValues: Record<string, string> = {};
  if (edit) {
    const [logRes, savedRes] = await Promise.all([
      supabase
        .from('org_activity_list')
        .select('orgactlist_id, orgact_name, period_type, period_month')
        .eq('orgactlist_id', edit)
        .eq('org_id', orgId)
        .maybeSingle(),
      supabase
        .from('org_activity_detail')
        .select('scopedetail_id, amount')
        .eq('orgactlist_id', edit),
    ]);
    if (logRes.data) {
      const log = logRes.data as any;
      existingLogId = edit;
      existingName = log.orgact_name ?? '';
      existingPeriod = log.period_month ?? ''; // 'YYYY-MM-DD' หรือ ''
      existingPeriodType = log.period_type === 'year' ? 'year' : 'month';
      for (const r of (savedRes.data ?? []) as any[]) {
        if (r.scopedetail_id && r.amount != null) {
          existingValues[r.scopedetail_id] = String(parseFloat(Number(r.amount).toPrecision(7)));
        }
      }
    }
  }

  const scopes = (scopesRes.data ?? []) as CarbonScope[];
  const details = (detailsRes.data ?? []) as unknown as ActivityDetailWithValues[];

  const scopeGroups: ScopeGroup[] = scopes
    .slice()
    .sort((a, b) => (a.scope_number ?? 0) - (b.scope_number ?? 0))
    .map((scope) => ({
      scope,
      details: details.filter((d) => d.activity?.scope_id === scope.scope_id),
    }));

  return (
    <FootprintClient
      key={existingLogId ?? 'new'}
      scopeGroups={scopeGroups}
      orgId={orgId}
      existingLogId={existingLogId}
      existingValues={existingValues}
      existingName={existingName}
      existingPeriod={existingPeriod}
      existingPeriodType={existingPeriodType}
    />
  );
}