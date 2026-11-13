// ส่วนที่ทำงานฝั่ง server ของหน้าประเมินการยกเว้นภาษี (TOR ข้อ 11)
// ไฟล์นี้ "อ่าน" ข้อมูลอย่างเดียว แล้วส่งให้หน้าจอ (TaxCalculatorClient.tsx) ส่วนการบันทึกทำที่หน้าจอ
// ใช้ client ฝั่ง server + org_id จาก session จริง (แบบเดียวกับหน้าจัดสรรเครดิต)
//   เดิมหน้านี้ดึงข้อมูลเองในเบราว์เซอร์ และถามคอลัมน์ที่ไม่มีในฐานข้อมูล (total_credit, remaining_credit) จึงโหลดโครงการไม่ได้
// ?project= (ส่งมาจากปุ่ม "ไปหน้าประเมินการยกเว้นภาษี" ของหน้าจัดสรร) ใช้เลือกโครงการตั้งต้น
//   ไม่มี หรือไม่ใช่โครงการของตัวเอง = ไม่ error แค่เลือกโครงการแรกให้ (ผู้ใช้เลือกโครงการเองในหน้าได้ ตามข้อ 11.1)
export const dynamic = "force-dynamic";

import { requireOrgId } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabaseServer";
import TaxCalculatorClient, { type CostOption, type SavedCost, type TaxProject } from "./TaxCalculatorClient";

type AllocationRow = { year1_credit: number | string | null; sell_credit: number | string | null };
type ProjectRow = {
  orgtreeproject_id: string;
  project_name: string | null;
  credit_year_1: number | string | null;
  org_credit_allocation: AllocationRow | AllocationRow[] | null;
};
type DetailRow = { cost_id: string | null; cost_name: string; amount: number | string };
type AssessmentRow = { org_tax_assessment_detail: DetailRow[] | null };
type SellRow = {
  orgtreeproject_id: string;
  selling_price: number | string;
  org_tax_assessment: AssessmentRow | AssessmentRow[] | null;
};
type CatalogRow = { cost_id: string; cost_name: string; net_price: number | string | null };

// ตาราง 1 ต่อ 1 (unique) PostgREST ส่งกลับเป็น object แต่กันไว้ เผื่อส่งเป็น array
const first = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const round4 = (v: number) => Math.round((v + Number.EPSILON) * 10000) / 10000;

export default async function TaxCalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();
  const { project: requestedProject } = await searchParams;

  const [projectsRes, catalogRes] = await Promise.all([
    // โครงการขององค์กรนี้ พร้อมผลจัดสรรเครดิต (มี = จัดสรรแล้ว)
    supabase
      .from("org_tree_project")
      .select("orgtreeproject_id, project_name, credit_year_1, org_credit_allocation(year1_credit, sell_credit)")
      .eq("org_id", orgId)
      .order("project_name", { ascending: true }),
    // รายการต้นทุนมาตรฐานที่แอดมินตั้งไว้ (ข้อ 5.5)
    supabase.from("project_cost_type").select("cost_id, cost_name, net_price").order("cost_name", { ascending: true }),
  ]);

  const projectRows = (projectsRes.data ?? []) as unknown as ProjectRow[];

  // ผลประเมินที่เคยบันทึกไว้ของปีที่ 1 (ราคาขาย + รายการค่าใช้จ่าย)
  let sellRows: SellRow[] = [];
  let sellError: string | null = null;
  if (projectRows.length > 0) {
    const sellRes = await supabase
      .from("org_sell_credit")
      .select("orgtreeproject_id, selling_price, org_tax_assessment(org_tax_assessment_detail(cost_id, cost_name, amount))")
      .eq("sell_year", 1)
      .in(
        "orgtreeproject_id",
        projectRows.map((p) => p.orgtreeproject_id)
      );
    sellRows = (sellRes.data ?? []) as unknown as SellRow[];
    sellError = sellRes.error?.message ?? null;
  }
  const sellByProject = new Map(sellRows.map((s) => [s.orgtreeproject_id, s]));

  const projects: TaxProject[] = projectRows.map((p) => {
    const alloc = first(p.org_credit_allocation);
    const sell = sellByProject.get(p.orgtreeproject_id);
    const assessment = first(sell?.org_tax_assessment);

    const costs: SavedCost[] = (assessment?.org_tax_assessment_detail ?? [])
      .map((d) => ({ costId: d.cost_id, name: d.cost_name, amount: Number(d.amount) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, "th"));

    return {
      id: p.orgtreeproject_id,
      name: p.project_name || "(ไม่มีชื่อ)",
      allocated: alloc !== null,
      creditSold: alloc ? Number(alloc.sell_credit) || 0 : 0,
      // เครดิตปีที่ 1 ตอนนี้ ไม่ตรงกับตอนที่จัดสรรไว้ (เช่น แก้โครงการในหน้าจำลองหลังจัดสรร)
      stale: alloc !== null && Math.abs(round4(Number(alloc.year1_credit) || 0) - round4(Number(p.credit_year_1) || 0)) > 0.0001,
      saved: sell && assessment ? { price: Number(sell.selling_price) || 0, costs } : null,
    };
  });

  const catalog: CostOption[] = ((catalogRes.data ?? []) as unknown as CatalogRow[]).map((c) => ({
    cost_id: c.cost_id,
    cost_name: c.cost_name,
    net_price: Number(c.net_price) || 0,
  }));

  // โครงการตั้งต้น: ตาม ?project= (ถ้าเป็นของเรา) ไม่งั้นโครงการแรกที่จัดสรรแล้ว ไม่งั้นโครงการแรก
  const initialProjectId =
    projects.find((p) => p.id === requestedProject)?.id ?? projects.find((p) => p.allocated)?.id ?? projects[0]?.id ?? "";

  // แสดงข้อความ error แรกที่เจอ (เดิมกลืน error ทิ้ง ทำให้หน้าว่างเฉยๆ ไม่รู้สาเหตุ)
  const loadError = projectsRes.error?.message ?? catalogRes.error?.message ?? sellError;

  return (
    <TaxCalculatorClient
      loadError={loadError}
      projects={projects}
      initialProjectId={initialProjectId}
      catalog={catalog}
    />
  );
}
