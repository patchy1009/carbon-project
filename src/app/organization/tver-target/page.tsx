// ส่วนที่ทำงานฝั่ง server ของหน้า "จำลองโครงการ T-VER จากเป้าหมายการกักเก็บคาร์บอน" (แบบใหม่)
//   แผนใหม่: /organization/tver-target   เปิดแผนเดิม: /organization/tver-target?edit=<targetplan_id>
//   แยกจากหน้า tver-simulation (แบบเดิม) ทั้งหมด ใช้ตาราง org_tree_target_* (supabase/tver_target_plan.sql)
export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import TverTargetClient from './TverTargetClient';
import type { TreeListItem, TverProjectDetail } from '@/types/tver-project';
import type { OrgTreeTargetPlan, OrgTreeTargetSpecies, SavedTargetPlanOption } from '@/types/tver-target';

// ดึงรายการต้นไม้ เงื่อนไขโครงการของแอดมิน แผนที่บันทึกไว้ และแผนที่จะเปิด (ถ้ามี ?edit=) แล้วส่งให้หน้าจอ
export default async function TverTargetPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();
  const { edit } = await searchParams;

  const [treesRes, criteriaRes, savedRes, planRes, speciesRes] = await Promise.all([
    supabase.from('tree_list').select('*').order('tree_name'),
    // เงื่อนไขของแอดมิน: ใช้หาเพดาน "พื้นที่โครงการ" และ "ขนาดแปลงย่อย"
    supabase.from('tver_project_detail').select('*'),
    supabase.from('org_tree_target_plan').select('targetplan_id, project_name').eq('org_id', orgId).order('project_name'),
    // เปิดแผนเดิม: เฉพาะแผนขององค์กรนี้เท่านั้น
    edit
      ? supabase.from('org_tree_target_plan').select('*').eq('targetplan_id', edit).eq('org_id', orgId).maybeSingle()
      : Promise.resolve(null),
    edit
      ? supabase
          .from('org_tree_target_species')
          .select('*, org_tree_target_plot(*)')
          .eq('targetplan_id', edit)
          .order('sort_order')
      : Promise.resolve(null),
  ]);

  if (edit && !planRes?.data) notFound(); // ไม่พบแผน / ไม่ใช่ของตัวเอง -> หน้า 404

  return (
    <TverTargetClient
      // key: เปลี่ยนแผนที่เปิด -> เริ่มฟอร์มใหม่จากค่าของแผนนั้น
      key={edit ?? 'new'}
      orgId={orgId}
      trees={(treesRes.data ?? []) as TreeListItem[]}
      criteria={(criteriaRes.data ?? []) as TverProjectDetail[]}
      savedPlans={(savedRes.data ?? []) as SavedTargetPlanOption[]}
      existingPlan={(planRes?.data ?? null) as OrgTreeTargetPlan | null}
      existingSpecies={(speciesRes?.data ?? []) as OrgTreeTargetSpecies[]}
    />
  );
}
