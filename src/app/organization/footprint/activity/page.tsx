export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import FootprintClient, { type ExistingBill } from './FootprintClient';
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

  const [scopesRes, detailsRes, officeRes] = await Promise.all([
    supabase.from('carbon_scope').select('*').order('scope_number'),
    supabase.from('activity_detail').select(`
      scopedetail_id,
      detail_name,
      unit,
      activity(activity_id, activity_name, scope_id),
      emission_factor(ef_value),
      global_warming_potential(gwp_value)
    `),
    // นับว่ากรอกข้อมูลสำนักงานไว้กี่หัวข้อ (ใช้แสดงข้อความเตือน ไม่บังคับ)
    supabase
      .from('org_office_info')
      .select('orginfo_id', { count: 'exact', head: true })
      .eq('org_id', orgId),
  ]);

  // ถ้ามี ?edit=รหัส ให้โหลดค่าที่เคยกรอกและบิลที่เคยแนบ (เฉพาะรายการของตัวเอง)
  let existingLogId: string | null = null;
  let existingName = '';
  let existingPeriod = '';
  let existingPeriodType: 'month' | 'year' = 'month';
  const existingValues: Record<string, string> = {};
  let existingBills: ExistingBill[] = [];
  if (edit) {
    const [logRes, savedRes, billRes] = await Promise.all([
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
      supabase
        .from('org_bill_file')
        .select('bill_id, bill_type, file_path, original_name, file_size')
        .eq('orgactlist_id', edit)
        .order('created_at'),
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
      existingBills = (billRes.data ?? []) as ExistingBill[];
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
      existingBills={existingBills}
      existingName={existingName}
      existingPeriod={existingPeriod}
      existingPeriodType={existingPeriodType}
      hasOfficeInfo={(officeRes.count ?? 0) > 0}
    />
  );
}