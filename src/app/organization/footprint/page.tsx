export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabaseClient';
import { TEMP_ORG_ID } from '@/lib/tempOrg';
import FootprintClient from './FootprintClient';
import type { CarbonScope } from '@/types/activity-management';
import type { ActivityDetailWithValues, ScopeGroup } from '@/types/footprint';

export default async function FootprintPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const orgId = TEMP_ORG_ID; // ตอนผูกบัญชีจริง แก้บรรทัดนี้ที่เดียว

  const [scopesRes, detailsRes] = await Promise.all([
    supabase.from('carbon_scope').select('*').order('scope_number'),
    supabase.from('activity_detail').select(`
      scopedetail_id,
      detail_name,
      unit,
      activity(activity_id, activity_name, scope_id),
      emission_factor(ef_value),
      global_warming_potential(gwp_value)
    `),
  ]);

  // ถ้ามี ?edit=รหัส ให้โหลดค่าที่เคยกรอก (เฉพาะรายการของตัวเอง)
  let existingLogId: string | null = null;
  const existingValues: Record<string, string> = {};
  if (edit) {
    const [logRes, savedRes] = await Promise.all([
      supabase
        .from('org_activity_list')
        .select('orgactlist_id')
        .eq('orgactlist_id', edit)
        .eq('org_id', orgId)
        .maybeSingle(),
      supabase
        .from('org_activity_detail')
        .select('scopedetail_id, amount')
        .eq('orgactlist_id', edit),
    ]);
    if (logRes.data) {
      existingLogId = edit;
      for (const r of (savedRes.data ?? []) as any[]) {
        if (r.scopedetail_id && r.amount != null) {
          // ตัดเศษทศนิยมจากชนิด real
          existingValues[r.scopedetail_id] = String(parseFloat(Number(r.amount).toPrecision(7)));
        }
      }
    }
  }

  const scopes = (scopesRes.data ?? []) as CarbonScope[];
  const details = (detailsRes.data ?? []) as unknown as ActivityDetailWithValues[];

  // จัดกลุ่ม activity_detail เข้าตาม scope ของมัน (ผ่าน activity.scope_id)
  const scopeGroups: ScopeGroup[] = scopes
    .slice()
    .sort((a, b) => (a.scope_number ?? 0) - (b.scope_number ?? 0))
    .map((scope) => ({
      scope,
      details: details.filter((d) => d.activity?.scope_id === scope.scope_id),
    }));

  return (
    <FootprintClient
      key={existingLogId ?? 'new'} // เปลี่ยนโหมดแล้วให้ฟอร์มรีเซ็ตค่า
      scopeGroups={scopeGroups}
      orgId={orgId}
      existingLogId={existingLogId}
      existingValues={existingValues}
    />
  );
}