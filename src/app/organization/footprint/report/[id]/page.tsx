export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import { evaluate, type OrgData, type Recommendation } from '@/lib/recommendation';
import ReportClient, { type Measure } from './ReportClient';

// แปลงข้อความเป็นตัวเลข (ตัด comma) คืน null ถ้าแปลงไม่ได้หรือว่าง
const toNum = (v: unknown): number | null => {
  const s = String(v ?? '').replace(/,/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export default async function FootprintReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();
  const { id } = await params;

  const [logRes, detailRes, recRes, officeRes] = await Promise.all([
    supabase
      .from('org_activity_list')
      .select('*')
      .eq('orgactlist_id', id)
      .eq('org_id', orgId) // เปิดดูได้เฉพาะรายงานของตัวเอง
      .maybeSingle(),
    supabase
      .from('org_activity_detail')
      .select(
        'scopedetail_id, amount, ghg_emission, activity_detail(detail_name, activity(carbon_scope(scope_number)))'
      )
      .eq('orgactlist_id', id),
    // เฉพาะแนวทางที่เผยแพร่แล้ว + เงื่อนไขของแต่ละแนวทาง
    supabase
      .from('carbon_reduction_recommendation')
      .select('*, recommendation_condition(*)')
      .eq('status', 'published'),
    // ข้อมูลสำนักงานขององค์กร (ใช้ตัดสินเงื่อนไข)
    supabase.from('org_office_info').select('info_id, amount').eq('org_id', orgId),
  ]);

  const log = logRes.data;
  if (!log) notFound();

  // ----- รวมข้อมูลองค์กรสำหรับตัดสินเงื่อนไข -----
  const data: OrgData = {
    activity: {},
    office: {},
    scope: { 1: 0, 2: 0, 3: 0 },
    total: Number(log.total_ghg_emission) || 0,
  };
  const names: Record<string, string> = {};

  for (const d of (detailRes.data ?? []) as any[]) {
    const sid = d.scopedetail_id as string | null;
    if (!sid) continue;
    const cur = data.activity[sid] ?? { amount: 0, ghg: 0 };
    data.activity[sid] = {
      amount: cur.amount + (Number(d.amount) || 0),
      ghg: cur.ghg + (Number(d.ghg_emission) || 0),
    };
    names[sid] = d.activity_detail?.detail_name ?? '';
    const n = d.activity_detail?.activity?.carbon_scope?.scope_number;
    if (n && n in data.scope) data.scope[n] += Number(d.ghg_emission) || 0;
  }

  for (const o of (officeRes.data ?? []) as any[]) {
    const v = toNum(o.amount);
    if (o.info_id && v !== null) data.office[o.info_id] = v;
  }

  // ----- แนวทางที่แอดมินกรอก -----
  const recs: Recommendation[] = ((recRes.data ?? []) as any[])
    .map((r) => {
      const mid = Number(r.carbon_reduction_amount) || 0;
      return {
        rec_uid: r.rec_uid as string,
        name: String(r.recommendation ?? ''),
        percent: mid,
        percentMin: Number(r.percent_min) || mid,
        percentMax: Number(r.percent_max) || mid,
        scopedetail_id: (r.scopedetail_id as string | null) ?? null,
        calcMethod: String(r.calc_method ?? 'percent'),
        conditions: ((r.recommendation_condition ?? []) as any[]).map((c) => ({
          source_type: c.source_type,
          scopedetail_id: c.scopedetail_id ?? null,
          info_id: c.info_id ?? null,
          scope_number: c.scope_number ?? null,
          metric: c.metric ?? null,
          operator: c.operator,
          value: Number(c.value),
          // ถ้ามี den_source_type = เงื่อนไขแบบอัตราส่วน (ตัวตั้ง ÷ ตัวหาร)
          denominator: c.den_source_type
            ? {
                source_type: c.den_source_type,
                scopedetail_id: c.den_scopedetail_id ?? null,
                info_id: c.den_info_id ?? null,
                scope_number: c.den_scope_number ?? null,
                metric: c.den_metric ?? null,
              }
            : null,
        })),
      };
    })
    .filter((r) => r.name && r.percent > 0 && r.percent <= 100);

  const measures: Measure[] = evaluate(recs, data)
    .map((r) => ({
      name: r.name,
      amount: r.amount,
      low: r.low,
      high: r.high,
      percentMin: r.percentMin,
      percentMax: r.percentMax,
      basis: r.scopedetail_id ? `การปล่อยจาก "${names[r.scopedetail_id] ?? 'กิจกรรมนี้'}"` : '',
    }))
    .sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1)) // ผลกระทบสูงสุดก่อน แนะนำทั่วไปไว้ท้าย
    .slice(0, 6);

  return (
    <ReportClient
      logId={id}
      report={{
        name: log.orgact_name,
        createdAt: log.created_at,
        total: data.total,
        s1: data.scope[1],
        s2: data.scope[2],
        s3: data.scope[3],
      }}
      measures={measures}
    />
  );
}