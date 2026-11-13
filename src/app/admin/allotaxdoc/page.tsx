// [MERGE aom + cyn2 รอบ 3] cyn2 เพิ่มการโหลดเป้าหมาย (project_target_rule) และต้นทุน (project_cost_type) ส่งให้ allotaxdocClient — รับตาม cyn2
// ส่วนที่ทำงานฝั่ง server ของหน้าเอกสาร: ตรวจสิทธิ์แอดมินแล้วดึงรายการเอกสาร เป้าหมายโครงการ และต้นทุนโครงการ
export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireAdminId } from '@/lib/auth';
import AlloTaxDocClient, { type TargetRule, type CostRow } from './allotaxdocClient';
import type { AlloTaxDoc } from '@/types/allotaxdoc';

// ดึงรายการเอกสารจาก documents, เป้าหมายจาก project_target_rule, ต้นทุนจาก project_cost_type แล้วส่งให้หน้าจอ
export default async function AlloTaxDocPage() {
  await requireAdminId(); // ไม่ใช่แอดมิน -> เด้งไปหน้า login
  const supabase = await createSupabaseServer();
  const [docsRes, targetsRes, costsRes] = await Promise.all([
    supabase.from('documents').select('*').order('upload_date'),
    supabase
      .from('project_target_rule')
      .select('target_id, target_name, offset_ratio, sell_ratio, updated_date')
      .order('offset_ratio', { ascending: false })
      .order('target_name'),
    supabase
      .from('project_cost_type')
      .select('cost_id, cost_name, price, vat, net_price')
      .order('cost_name'),
  ]);

  if (docsRes.error) {
    console.error(docsRes.error);
  }
  if (targetsRes.error) {
    console.error(targetsRes.error);
  }
  if (costsRes.error) {
    console.error(costsRes.error);
  }

  return (
    <AlloTaxDocClient
      initialDocuments={(docsRes.data ?? []) as AlloTaxDoc[]}
      initialTargets={(targetsRes.data ?? []) as unknown as TargetRule[]}
      initialCosts={(costsRes.data ?? []) as unknown as CostRow[]}
    />
  );
}