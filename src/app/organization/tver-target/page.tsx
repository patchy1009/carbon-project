// ส่วนที่ทำงานฝั่ง server ของหน้า "จำลองโครงการ T-VER จากเป้าหมายการกักเก็บคาร์บอน" (แบบใหม่)
//   แผนใหม่: /organization/tver-target   เปิดแผนเดิม: /organization/tver-target?edit=<targetplan_id>
//   แยกจากหน้า tver-simulation (แบบเดิม) ทั้งหมด ใช้ตาราง org_tree_target_plan (supabase/tver_target_plan.sql)
export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import TverTargetClient from './TverTargetClient';
import type { TverProjectDetail } from '@/types/tver-project';
import type { FootprintOption, OrgTreeTargetPlan, SavedTargetPlanOption } from '@/types/tver-target';

// ดึงเงื่อนไขโครงการของแอดมิน แผนที่บันทึกไว้ แผนที่จะเปิด (ถ้ามี ?edit=) และคาร์บอนฟุตพรินต์ที่องค์กรคำนวณไว้ แล้วส่งให้หน้าจอ
export default async function TverTargetPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();
  const { edit } = await searchParams;

  const [criteriaRes, savedRes, planRes, footprintRes] = await Promise.all([
    // เงื่อนไขของแอดมิน: ใช้หาเพดาน "พื้นที่โครงการ" และ "ขนาดแปลงย่อย"
    supabase.from('tver_project_detail').select('*'),
    supabase.from('org_tree_target_plan').select('targetplan_id, project_name').eq('org_id', orgId).order('project_name'),
    // เปิดแผนเดิม: เฉพาะแผนขององค์กรนี้เท่านั้น
    edit
      ? supabase.from('org_tree_target_plan').select('*').eq('targetplan_id', edit).eq('org_id', orgId).maybeSingle()
      : Promise.resolve(null),
    // คาร์บอนฟุตพรินต์ที่องค์กรคำนวณไว้ (หน่วย tCO2e) ใหม่สุดขึ้นก่อน ให้เลือกเป็นปริมาณที่ต้องชดเชย
    supabase
      .from('org_activity_list')
      .select('orgactlist_id, orgact_name, total_ghg_emission, period_date')
      .eq('org_id', orgId)
      .order('period_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);

  type FootprintRow = { orgactlist_id: string; orgact_name: string | null; total_ghg_emission: number | null; period_date: string | null };
  const footprints: FootprintOption[] = ((footprintRes.data ?? []) as FootprintRow[]).map((f) => ({
    id: f.orgactlist_id,
    name: f.orgact_name || 'รายการคาร์บอนฟุตพรินต์',
    amount: Number(f.total_ghg_emission) || 0,
    periodDate: f.period_date,
  }));

  if (edit && !planRes?.data) notFound(); // ไม่พบแผน / ไม่ใช่ของตัวเอง -> หน้า 404

  return (
    <TverTargetClient
      // key: เปลี่ยนแผนที่เปิด -> เริ่มฟอร์มใหม่จากค่าของแผนนั้น
      key={edit ?? 'new'}
      orgId={orgId}
      criteria={(criteriaRes.data ?? []) as TverProjectDetail[]}
      savedPlans={(savedRes.data ?? []) as SavedTargetPlanOption[]}
      existingPlan={(planRes?.data ?? null) as OrgTreeTargetPlan | null}
      footprints={footprints}
    />
  );
}
