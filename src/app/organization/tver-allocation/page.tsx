import { supabase } from "@/lib/supabaseClient";
import AllocationClient from "./allocation";

// [แก้ไข] เปลี่ยนประเภทของ searchParams ให้เป็น Promise ตามมาตรฐาน Next.js App Router
export default async function TVERSimulationPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  let linkedProjectId: string | null = null;
  let linkedCredits: [number, number, number] | null = null;
  let initialProjectName = "";
  let initialStartDate = "";
  let initialTreeId = "";
  let initialArea = "500";
  let initialTreesPerRai = "125";
  let initialStep: 1 | 2 = 2; // บังคับให้เป็นขั้นตอนที่ 2 ทันที

  let treeOptions: { tree_id: string; tree_name: string }[] = [];
  let creditRecords: { id: string; name: string; amount: number }[] = [];
  let targetRules: { target_id: string; target_name: string; offset_ratio: number; sell_ratio: number }[] = [];

  try {
    const { data: authData } = await supabase.auth.getUser();
    const fetchedOrgId = authData?.user?.id ?? null;

    // [แก้ไข] ทำการ await searchParams ก่อนนำไปใช้งาน
    const resolvedSearchParams = await searchParams;
    const projectParam = resolvedSearchParams?.project;

    // ดึงข้อมูลพันธุ์ไม้จากตาราง tree_list
    const { data: treeData, error: treeError } = await supabase
      .from("tree_list")
      .select("tree_id, tree_name");

    if (!treeError && treeData) {
      treeOptions = treeData;
    }

    // ถ้ารหัสโครงการมีค่า ให้ดึงข้อมูลโครงการเดิมมาแสดง
    if (projectParam) {
      const { data: linked, error: linkedError } = await supabase
        .from("org_tree_project")
        .select("orgtreeproject_id, project_name, join_date, credit_year_1, credit_year_2, credit_year_3, tree_id")
        .eq("orgtreeproject_id", projectParam)
        .maybeSingle();

      if (!linkedError && linked) {
        linkedProjectId = linked.orgtreeproject_id;
        linkedCredits = [
          Number(linked.credit_year_1) || 0,
          Number(linked.credit_year_2) || 0,
          Number(linked.credit_year_3) || 0,
        ];
        initialProjectName = linked.project_name ?? "";
        initialStartDate = linked.join_date ?? "";
        initialTreeId = linked.tree_id ?? "";
      }
    }

    // ดึงรายการปล่อยก๊าซเรือนกระจกขององค์กร
    const { data: activityData } = await supabase
      .from("org_activity_list")
      .select("orgactlist_id, orgact_name, total_ghg_emission")
      .eq("org_id", fetchedOrgId);

    if (activityData) {
      creditRecords = activityData.map((item: any) => ({
        id: item.orgactlist_id,
        name: item.orgact_name || "กิจกรรมการปล่อยก๊าซ",
        amount: Number(item.total_ghg_emission || 0),
      }));
    }

    // ดึงข้อมูลกฎเป้าหมายองค์กร
    const { data: targetData } = await supabase
      .from("project_target_rule")
      .select("target_id, target_name, offset_ratio, sell_ratio");

    if (targetData) {
      targetRules = targetData;
    }
  } catch (err) {
    console.error("Error fetching data on server (page.tsx):", err);
  }

  return (
    <AllocationClient
      treeOptions={treeOptions}
      initialProjectName={initialProjectName}
      initialStartDate={initialStartDate}
      initialTreeId={initialTreeId}
      initialArea={initialArea}
      initialTreesPerRai={initialTreesPerRai}
      linkedProjectId={linkedProjectId}
      linkedCredits={linkedCredits}
      initialStep={initialStep}
      creditRecords={creditRecords}
      targetRules={targetRules}
    />
  );
}