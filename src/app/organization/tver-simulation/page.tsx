// ส่วนที่ทำงานฝั่ง server ของหน้าจำลอง T-VER (โครงการใหม่ และแก้ไขโครงการเดิม)
// [ย้าย] เดิมหน้าแก้ไขอยู่ที่ tver-simulation/[id] -> รวมไว้ที่นี่ ใช้ ?edit=<orgtreeproject_id> แทน
//   (แบบเดียวกับ footprint/office_info?edit= และ footprint/report?id=)
export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import TverSimulationClient, { type SavedProjectOption } from './TverSimulationClient';
import type { TreeListItem, TverProjectDetail } from '@/types/tver-project';
import type { OrgTreeProject, OrgTreeProjectDetail } from '@/types/tver-simulation';

// ดึงรายการต้นไม้ เงื่อนไขโครงการ รายชื่อโครงการที่บันทึกไว้ และโครงการเดิม (ถ้ามี ?edit=) แล้วส่งให้หน้าจอ
export default async function TverSimulationPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();
  const { edit } = await searchParams;

  const [treesRes, criteriaRes, savedRes, projectRes, detailsRes] = await Promise.all([
    supabase.from('tree_list').select('*').order('tree_name'),
    supabase.from('tver_project_detail').select('*').order('updated_at'),
    // รายชื่อโครงการที่องค์กรนี้บันทึกไว้ (ให้ช่องชื่อโครงการเลือกเปิดได้)
    supabase.from('org_tree_project').select('orgtreeproject_id, project_name').eq('org_id', orgId).order('project_name'),
    // โหมดแก้ไข: โครงการเดิม เฉพาะขององค์กรนี้เท่านั้น (กันเปิดดูโครงการขององค์กรอื่น)
    edit
      ? supabase.from('org_tree_project').select('*').eq('orgtreeproject_id', edit).eq('org_id', orgId).maybeSingle()
      : Promise.resolve(null),
    edit
      ? supabase.from('org_tree_project_detail').select('*').eq('orgtreeproject_id', edit)
      : Promise.resolve(null),
  ]);

  if (edit && !projectRes?.data) notFound(); // ไม่พบโครงการ / ไม่ใช่ของตัวเอง -> แสดงหน้า 404
  const project = (projectRes?.data ?? null) as OrgTreeProject | null;

  return (
    <TverSimulationClient
      orgId={orgId}
      trees={(treesRes.data ?? []) as TreeListItem[]}
      criteria={(criteriaRes.data ?? []) as TverProjectDetail[]}
      savedProjects={(savedRes.data ?? []) as SavedProjectOption[]}
      existingProject={project}
      existingDetails={(detailsRes?.data ?? []) as OrgTreeProjectDetail[]}
    />
  );
}
