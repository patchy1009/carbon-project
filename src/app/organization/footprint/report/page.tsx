export const dynamic = 'force-dynamic';

/* หน้ารายงาน: /organization/footprint/report?id=<orgactlist_id>
 * เดิมเป็นโฟลเดอร์ report/[id] (id อยู่ใน path) ตอนนี้ส่ง id ทาง query แทน
 * id = เลขของ "รายการบันทึก" (องค์กรหนึ่งมีหลายรายงาน) ส่วนองค์กรมาจากบัญชีที่ล็อกอิน (requireOrgId)
 * ไม่ส่ง id มา = เปิดรายงานล่าสุดขององค์กร / ยังไม่มีรายงานเลย = กลับแดชบอร์ด */

import { notFound, redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import { isUuid } from '@/lib/sqlSyntax'; // ตรวจค่าจาก URL ก่อนส่งไปฐานข้อมูล
import { conditionValue, evaluate, isChoiceOperator, type Condition, type Operand, type OrgData, type Recommendation } from '@/lib/recommendation';
import ReportClient, { type Measure } from './ReportClient';
import { AC_BTU_INFO_NAME, DAYS_INFO_NAME, HOURS_INFO_NAME, findInfoIdByName } from '@/lib/measureFormulas';

// แปลงข้อความเป็นตัวเลข (ตัด comma) คืน null ถ้าแปลงไม่ได้หรือว่าง
const toNum = (v: unknown): number | null => {
  const s = String(v ?? '').replace(/,/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// ----- "ค่าที่พบ" ของแนวทาง: เขียนค่าจริงขององค์กรที่ทำให้ผ่านแต่ละเงื่อนไข -----
type InfoTypeRow = {
  info_id: string;
  info_name: string | null;
  unit: string | null;
  input_type: string | null;
  has_quantity: boolean | null;
  office_info_option?: { option_id: string; label: string }[];
};
type ActivityRow = {
  scopedetail_id: string;
  detail_name: string | null;
  unit: string | null;
  // PostgREST คืน relation แบบ object (หรือ array ถ้าเดาความสัมพันธ์ไม่ได้)
  emission_factor: { ef_value: number | string | null } | { ef_value: number | string | null }[] | null;
  global_warming_potential: { gwp_value: number | string | null } | { gwp_value: number | string | null }[] | null;
};
const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

type FindingLookup = {
  info: Record<string, InfoTypeRow>;
  option: Record<string, string>; // option_id -> ชื่อตัวเลือก
  activity: Record<string, { detail_name: string | null; unit: string | null }>;
};

const OP_TEXT: Record<string, string> = { '>': 'มากกว่า', '>=': 'ตั้งแต่', '<': 'น้อยกว่า', '<=': 'ไม่เกิน', '=': 'เท่ากับ' };
const fmtNum = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 });

// ชื่อและหน่วยของค่า 1 ค่าในเงื่อนไข
function operandLabel(o: Operand, lk: FindingLookup): { name: string; unit: string } {
  if (o.source_type === 'activity') {
    const a = o.scopedetail_id ? lk.activity[o.scopedetail_id] : undefined;
    const name = a?.detail_name ?? 'กิจกรรม';
    return o.metric === 'ghg_emission'
      ? { name: `${name} (ก๊าซที่ปล่อย)`, unit: 'tCO2e' }
      : { name, unit: a?.unit ?? '' };
  }
  const t = o.info_id ? lk.info[o.info_id] : undefined;
  return { name: t?.info_name ?? 'ข้อมูลสำนักงาน', unit: t?.unit ?? '' };
}

// ข้อความ 1 บรรทัดของเงื่อนไข เช่น "ชนิดหลอดไฟ: Fluorescent 40 ดวง" / "อุณหภูมิแอร์ที่ตั้ง: 22 °C (เกณฑ์: น้อยกว่า 25)"
function describeFinding(c: Condition, d: OrgData, lk: FindingLookup): string | null {
  if (isChoiceOperator(c.operator)) {
    const t = c.info_id ? lk.info[c.info_id] : undefined;
    const has = (c.info_id && d.officeChoice[c.info_id]) || [];
    // in = แสดงเฉพาะตัวที่ตรงเงื่อนไข / not_in = แสดงสิ่งที่องค์กรมีอยู่
    const shown = c.operator === 'in' ? has.filter((id) => c.option_ids.includes(id)) : has;
    if (shown.length === 0) return null;
    const parts = shown.map((id) => {
      const label = lk.option[id] ?? 'ตัวเลือก';
      const qty = d.officeOptionQty[id];
      return t?.has_quantity && qty !== undefined ? `${label} ${fmtNum(qty)}${t.unit ? ` ${t.unit}` : ''}` : label;
    });
    return `${t?.info_name ?? 'ข้อมูลสำนักงาน'}: ${parts.join(', ')}`;
  }
  const v = conditionValue(c, d);
  if (v === null) return null;
  const a = operandLabel(c, lk);
  const criteria = `(เกณฑ์: ${OP_TEXT[c.operator] ?? c.operator} ${fmtNum(c.value)})`;
  if (c.denominator) {
    const b = operandLabel(c.denominator, lk);
    const unit = a.unit || b.unit ? ` ${a.unit || '-'} ต่อ ${b.unit || '-'}` : '';
    return `${a.name} ต่อ ${b.name}: ${fmtNum(v)}${unit} ${criteria}`;
  }
  return `${a.name}: ${fmtNum(v)}${a.unit ? ` ${a.unit}` : ''} ${criteria}`;
}

// ดึงรายการบันทึก คำนวณยอดแต่ละ Scope และแนวทางลดคาร์บอน แล้วส่งให้หน้ารายงาน
export default async function FootprintReportPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();
  let { id } = await searchParams;
  // ?id= ต้องเป็น uuid เท่านั้น (ค่าอื่นไม่ส่งไปค้นฐานข้อมูล) -> หน้า 404
  if (id !== undefined && !isUuid(id)) notFound();

  // ไม่มี ?id= -> ใช้รายการล่าสุดขององค์กรนี้
  if (!id) {
    const { data: latest } = await supabase
      .from('org_activity_list')
      .select('orgactlist_id')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest) redirect('/organization/dashboard');
    id = latest.orgactlist_id as string;
  }

  const [logRes, detailRes, recRes, officeRes, infoTypeRes, actNameRes] = await Promise.all([
    supabase
      .from('org_activity_list')
      .select('*')
      .eq('orgactlist_id', id)
      .eq('org_id', orgId) // เปิดดูได้เฉพาะรายงานของตัวเอง
      .maybeSingle(),
    supabase
      .from('org_activity_detail')
      .select(
        // + activity_id / scope_id ใช้รวมฐานของแนวทางแบบ "ทั้งกิจกรรม" และ "ทั้ง Scope"
        'scopedetail_id, amount, ghg_emission, activity_detail(detail_name, activity_id, activity(activity_name, scope_id, carbon_scope(scope_number)))'
      )
      .eq('orgactlist_id', id),
    // แนวทางทั้งหมด + เงื่อนไขของแต่ละแนวทาง
    // เดิมเอาเฉพาะ status = 'published' ตอนนี้แอดมินกดบันทึก = พร้อมแนะนำ (ไม่มีสถานะร่างแล้ว)
    //   แนวทางเก่าที่เคยค้างเป็นร่างก็จะแสดงด้วย
    // เงื่อนไขแบบตัวเลือก (in / not_in) มีรายการตัวเลือกอยู่ในตาราง recommendation_condition_option
    supabase
      .from('carbon_reduction_recommendation')
      .select('*, recommendation_condition(*, recommendation_condition_option(option_id))'),
    // ข้อมูลสำนักงานของ "รายการนี้" (ใช้ตัดสินเงื่อนไข) เดิมใช้ชุดเดียวทั้งองค์กร
    // org_office_info ไม่มี org_id แล้ว: ความเป็นเจ้าของตรวจจาก logRes ด้านบน (ไม่ใช่ของตัวเอง -> notFound)
    // + จำนวนของแต่ละตัวเลือก (หัวข้อแบบตัวเลือกที่กรอกจำนวน: supabase/office_info_quantity.sql)
    supabase
      .from('org_office_info')
      .select('info_id, amount, org_office_info_option(option_id, quantity)')
      .eq('orgactlist_id', id),
    // ชนิดของหัวข้อ: แยกว่าค่าที่บันทึกไว้เป็นตัวเลข หรือเป็น option_id ของหัวข้อแบบตัวเลือก
    //   + ชื่อ/หน่วย/ตัวเลือก ใช้เขียน "ค่าที่พบ" ของแต่ละแนวทาง
    supabase
      .from('office_info_type')
      .select('info_id, info_name, unit, input_type, has_quantity, office_info_option(option_id, label)'),
    // ชื่อและหน่วยของกิจกรรม ใช้เขียน "ค่าที่พบ" ของเงื่อนไขแบบค่าของกิจกรรม
    //   + EF × GWP ใช้กับแนวทางแบบสูตร (lib/measureFormulas.ts)
    supabase
      .from('activity_detail')
      .select('scopedetail_id, detail_name, unit, emission_factor(ef_value), global_warming_potential(gwp_value)'),
  ]);
  if (officeRes.error) console.error('org_office_info error:', officeRes.error.message);
  if (recRes.error) console.error('recommendation error:', recRes.error.message);
  if (infoTypeRes.error) console.error('office_info_type error:', infoTypeRes.error.message);
  const infoTypes = (infoTypeRes.data ?? []) as InfoTypeRow[];
  const choiceInfoIds = new Set(infoTypes.filter((t) => t.input_type === 'choice').map((t) => t.info_id));
  const officeRows = officeRes.data;

  const log = logRes.data;
  if (!log) notFound();

  // ----- รวมข้อมูลองค์กรสำหรับตัดสินเงื่อนไข -----
  const data: OrgData = {
    activity: {},
    base: {},
    office: {},
    officeChoice: {},
    officeOptionQty: {},
    scope: { 1: 0, 2: 0, 3: 0 },
    periodDays: null,  // เติมหลังอ่านข้อมูลสำนักงาน (ด้านล่าง)
    hoursPerDay: null, // เติมหลังอ่านข้อมูลสำนักงาน (ด้านล่าง)
    acBtu: null,       // เติมหลังอ่านข้อมูลสำนักงาน (ด้านล่าง)
    total: Number(log.total_ghg_emission) || 0,
  };
  const names: Record<string, string> = {};
  const baseNames: Record<string, string> = {}; // ชื่อของฐานแต่ละ key ใช้เขียน "x% ของการปล่อยจาก ..."

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

    // ฐานของแนวทาง 3 ระดับ: รายการย่อย / ทั้งกิจกรรม / ทั้ง Scope (รวม tCO2e ขึ้นไปทุกระดับ)
    const ghg = Number(d.ghg_emission) || 0;
    const actId = d.activity_detail?.activity_id as string | undefined;
    const scopeId = d.activity_detail?.activity?.scope_id as string | undefined;
    const keys: [string, string][] = [[`detail:${sid}`, names[sid]]];
    if (actId) keys.push([`activity:${actId}`, d.activity_detail?.activity?.activity_name ?? '']);
    if (scopeId) keys.push([`scope:${scopeId}`, n ? `Scope ${n}` : 'Scope']);
    for (const [k, label] of keys) {
      data.base[k] = (data.base[k] ?? 0) + ghg;
      baseNames[k] = label;
    }
  }

  for (const o of (officeRows ?? []) as any[]) {
    // หัวข้อแบบตัวเลือก: amount = option_id ที่เลือก (ไม่ใช่ตัวเลข)
    if (o.info_id && choiceInfoIds.has(o.info_id)) {
      const qtyRows = (o.org_office_info_option ?? []) as { option_id: string; quantity: number | string }[];
      if (qtyRows.length > 0) {
        // กรอกจำนวน: "มี" = ตัวเลือกที่จำนวน > 0
        for (const q of qtyRows) data.officeOptionQty[q.option_id] = Number(q.quantity) || 0;
        data.officeChoice[o.info_id] = qtyRows.filter((q) => Number(q.quantity) > 0).map((q) => q.option_id);
      } else if (o.amount) {
        // เลือกค่าเดียว: amount = option_id ที่เลือก
        data.officeChoice[o.info_id] = [String(o.amount)];
      }
      continue;
    }
    const v = toNum(o.amount);
    if (o.info_id && v !== null) data.office[o.info_id] = v;
  }

  // [สูตร] ค่า H และ D ของสูตรจากข้อมูลสำนักงาน (ค้นจากชื่อหัวข้อ)
  //   H = "ชั่วโมงทำงานต่อวัน" / D = "จำนวนวันทำงาน" (วัน/ปี) รายการรายเดือนใช้ ÷ 12
  const hoursId = findInfoIdByName(infoTypes, HOURS_INFO_NAME);
  const daysId = findInfoIdByName(infoTypes, DAYS_INFO_NAME);
  data.hoursPerDay = hoursId ? data.office[hoursId] ?? null : null;
  const daysPerYear = daysId ? data.office[daysId] ?? null : null;
  data.periodDays = daysPerYear === null ? null : log.period_type === 'year' ? daysPerYear : daysPerYear / 12;
  // [สูตร] ขนาดแอร์ต่อเครื่อง (BTU) ของสูตรแอร์: หัวข้อ "ขนาดเครื่องปรับอากาศ"
  const btuId = findInfoIdByName(infoTypes, AC_BTU_INFO_NAME);
  data.acBtu = btuId ? data.office[btuId] ?? null : null;

  // [สูตร] ค่า EF ของสูตร = EF × GWP ของแต่ละกิจกรรม (kgCO2e ต่อหน่วยของกิจกรรม)
  const actRows = (actNameRes.data ?? []) as ActivityRow[];
  const efById: Record<string, number | null> = Object.fromEntries(
    actRows.map((a) => {
      const ef = one(a.emission_factor)?.ef_value;
      const gwp = one(a.global_warming_potential)?.gwp_value ?? 1;
      return [a.scopedetail_id, ef == null ? null : Number(ef) * Number(gwp)];
    })
  );

  // ----- แนวทางที่แอดมินกรอก -----
  const recs: Recommendation[] = ((recRes.data ?? []) as any[])
    .map((r) => {
      // [แก้ไข] ไม่มี percent_max แล้ว ใช้ % เดียว = percent_min (แถวเก่าที่ไม่มี ใช้ carbon_reduction_amount แทน)
      //   เดิม percent = carbon_reduction_amount (ค่ากลางของช่วง) + percentMin / percentMax
      // % ไม่บังคับ: ไม่กรอก = null -> แนะนำพร้อมค่าที่พบ แต่ไม่คำนวณ tCO2e
      const raw = r.percent_min ?? r.carbon_reduction_amount;
      const percent = raw === null || raw === undefined || raw === '' ? null : Number(raw);
      return {
        rec_id: r.rec_id as string, // [แก้ไข] เดิม rec_uid (schema_cleanup.sql ขั้น 4.2)
        name: String(r.recommendation ?? ''),
        percent,
        scopedetail_id: (r.scopedetail_id as string | null) ?? null,
        // ฐานของ %: รายการย่อย / ทั้งกิจกรรม / ทั้ง Scope (supabase/recommendation_base_level.sql)
        baseKey: r.scopedetail_id
          ? `detail:${r.scopedetail_id}`
          : r.base_activity_id
          ? `activity:${r.base_activity_id}`
          : r.base_scope_id
          ? `scope:${r.base_scope_id}`
          : null,
        calcMethod: String(r.calc_method ?? 'percent'),
        efKgPerUnit: r.scopedetail_id ? efById[r.scopedetail_id as string] ?? null : null,
        conditions: ((r.recommendation_condition ?? []) as any[]).map((c) => ({
          source_type: c.source_type,
          scopedetail_id: c.scopedetail_id ?? null,
          info_id: c.info_id ?? null,
          metric: c.metric ?? null,
          operator: c.operator,
          value: Number(c.value), // เงื่อนไขแบบตัวเลือก value = null -> 0 (ไม่ได้ใช้)
          option_ids: ((c.recommendation_condition_option ?? []) as { option_id: string }[]).map((x) => x.option_id),
          // ถ้ามี den_source_type = เงื่อนไขแบบอัตราส่วน (ตัวตั้ง ÷ ตัวหาร)
          denominator: c.den_source_type
            ? {
                source_type: c.den_source_type,
                scopedetail_id: c.den_scopedetail_id ?? null,
                info_id: c.den_info_id ?? null,
                metric: c.den_metric ?? null,
              }
            : null,
        })),
      };
    })
    .filter((r) => r.name && (r.percent === null || (r.percent > 0 && r.percent <= 100)));

  // ชื่อ/หน่วย สำหรับเขียน "ค่าที่พบ" จากเงื่อนไข
  const lookup: FindingLookup = {
    info: Object.fromEntries(infoTypes.map((t) => [t.info_id, t])),
    option: Object.fromEntries(
      infoTypes.flatMap((t) => (t.office_info_option ?? []).map((o) => [o.option_id, o.label] as const))
    ),
    activity: Object.fromEntries(actRows.map((a) => [a.scopedetail_id, a])),
  };

  const measures: Measure[] = evaluate(recs, data)
    .map((r) => ({
      name: r.name,
      amount: r.amount,
      percent: r.percent, // [แก้ไข] เดิมส่ง low / high / percentMin / percentMax (ช่วง)
      basis: r.baseKey ? `การปล่อยจาก "${baseNames[r.baseKey] ?? 'กิจกรรมนี้'}"` : '',
      // ค่าที่ทำให้แนวทางนี้ผ่านเงื่อนไข เช่น "ชนิดหลอดไฟ: Fluorescent 40 ดวง"
      findings: r.conditions.map((c) => describeFinding(c, data, lookup)).filter((f): f is string => !!f),
      calcNote: r.calcNote, // แนวทางแบบสูตร: ข้อความสั้น เช่น "เปลี่ยน 50 หลอด"
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