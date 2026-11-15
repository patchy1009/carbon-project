// ส่วนที่ทำงานฝั่ง server ของหน้าจัดสรรคาร์บอนเครดิต (TOR ข้อ 11.2–11.4)
// ทางเข้า: ปุ่ม "ไปจัดสรรคาร์บอนเครดิต" ในหน้าจำลองโครงการ (tver-simulation) ซึ่งส่งโครงการมาทาง ?project=
// ใช้ client ฝั่ง server + org_id จาก session จริง (แบบเดียวกับหน้า tver-simulation)
//   เดิมใช้ supabase ของ browser บน server -> มองไม่เห็นผู้ใช้ที่ล็อกอิน จึงอ่านโครงการ/กิจกรรม/เป้าหมายไม่ได้
// โครงการเลือกมาตั้งแต่หน้าจำลองโครงการแล้ว (ปุ่ม "ไปจัดสรรคาร์บอนเครดิต" ส่งมาทาง ?project=)
//   -> ไม่มี ?project= ส่งกลับไปหน้าจำลอง / ไม่ใช่โครงการของตัวเอง แสดงหน้า 404 (เหมือนหน้า ?edit= ของ tver-simulation)
export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { requireOrgId } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabaseServer";
import AllocationClient, {
  type ActivityOption,
  type GoalOption,
  type ProjectOption,
  type SavedAllocation,
} from "./allocation";

// ?project= ต้องหน้าตาเป็น uuid เท่านั้น (ค่าอื่นไม่ถูกส่งไปค้นฐานข้อมูล)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ProjectRow = { orgtreeproject_id: string; project_name: string | null; credit_year_1: number | string | null };
type ActivityRow = {
  orgactlist_id: string;
  orgact_name: string | null;
  total_ghg_emission: number | string | null;
  period_date: string | null;
};
type AllocationRow = { orgallocate_id: string; target_id: string; year1_credit: number | string | null };
type DetailRow = { orgactlist_id: string | null };

export default async function TverAllocationPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();
  const { project: requestedProject } = await searchParams;

  // ยังไม่ได้เลือกโครงการ -> ไปเลือก/สร้างที่หน้าจำลองโครงการก่อน
  if (!requestedProject) redirect("/organization/tver-simulation");
  if (typeof requestedProject !== "string" || !UUID_RE.test(requestedProject)) notFound();

  // โครงการต้องเป็นขององค์กรนี้เท่านั้น
  const projectRes = await supabase
    .from("org_tree_project")
    .select("orgtreeproject_id, project_name, credit_year_1")
    .eq("orgtreeproject_id", requestedProject)
    .eq("org_id", orgId)
    .maybeSingle();
  if (projectRes.error) throw new Error("โหลดโครงการไม่สำเร็จ: " + projectRes.error.message);
  const projectRow = (projectRes.data ?? null) as unknown as ProjectRow | null;
  if (!projectRow) notFound();

  const project: ProjectOption = {
    id: projectRow.orgtreeproject_id,
    name: projectRow.project_name || "(ไม่มีชื่อ)",
    year1Credit: Number(projectRow.credit_year_1) || 0,
  };

  const [goalsRes, activitiesRes, allocRes] = await Promise.all([
    // เป้าหมายที่แอดมินตั้งไว้ (ข้อ 5.4) เรียงจากชดเชยมากไปน้อย
    supabase
      .from("project_target_rule")
      .select("target_id, target_name, offset_ratio, sell_ratio")
      .order("offset_ratio", { ascending: false }),
    // รายการปล่อยก๊าซที่องค์กรบันทึกไว้ เรียงเก่า -> ใหม่ (ลำดับนี้คือลำดับที่ใช้หักเครดิต)
    supabase
      .from("org_activity_list")
      .select("orgactlist_id, orgact_name, total_ghg_emission, period_date, created_at")
      .eq("org_id", orgId)
      .order("period_date", { ascending: true })
      .order("created_at", { ascending: true }),
    // ผลการจัดสรรที่เคยบันทึกไว้ (ใช้โหลดมาให้แก้ไข ข้อ 11.2)
    supabase
      .from("org_credit_allocation")
      .select("orgallocate_id, target_id, year1_credit")
      .eq("orgtreeproject_id", project.id)
      .maybeSingle(),
  ]);

  const goals = (goalsRes.data ?? []) as unknown as GoalOption[];

  const activities: ActivityOption[] = ((activitiesRes.data ?? []) as unknown as ActivityRow[]).map((a) => ({
    id: a.orgactlist_id,
    name: a.orgact_name || "กิจกรรมการปล่อยก๊าซ",
    amount: Number(a.total_ghg_emission) || 0,
    periodDate: a.period_date,
  }));

  let saved: SavedAllocation | null = null;
  let savedError: string | null = null;
  const alloc = (allocRes.data ?? null) as unknown as AllocationRow | null;
  if (alloc) {
    const detailRes = await supabase
      .from("org_credit_allocation_detail")
      .select("orgactlist_id")
      .eq("orgallocate_id", alloc.orgallocate_id);
    if (detailRes.error) savedError = detailRes.error.message;

    saved = {
      targetId: alloc.target_id,
      year1Credit: Number(alloc.year1_credit) || 0,
      activityIds: ((detailRes.data ?? []) as unknown as DetailRow[])
        .map((d) => d.orgactlist_id)
        .filter((id): id is string => id !== null),
    };
  }

  // แสดงข้อความ error แรกที่เจอ (เดิมกลืน error ทิ้ง ทำให้หน้าว่างเฉยๆ ไม่รู้สาเหตุ)
  const loadError =
    goalsRes.error?.message ?? activitiesRes.error?.message ?? allocRes.error?.message ?? savedError ?? null;

  return (
    <AllocationClient
      project={project}
      loadError={loadError}
      goals={goals}
      activities={activities}
      saved={saved}
    />
  );
}
