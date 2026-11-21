import { AC_BTU_INFO_NAME, DAYS_INFO_NAME, HOURS_INFO_NAME, formulaSaving, isFormulaMethod } from './measureFormulas';
// in / not_in = เงื่อนไขแบบตัวเลือก (ข้อมูลสำนักงานที่ input_type = 'choice') เช่น ชนิดหลอดไฟ เป็นหนึ่งใน [ฟลูออเรสเซนต์, หลอดไส้]
export type Operator = '>' | '>=' | '<' | '<=' | '=' | 'in' | 'not_in';
export const isChoiceOperator = (op: string): op is 'in' | 'not_in' => op === 'in' || op === 'not_in';
// [เลิกใช้] 'scope' / 'total' -> เงื่อนไขเก่าที่ยังเป็นแบบนี้ใน DB ได้ค่า null = ไม่ผ่าน
export type SourceType = 'activity' | 'office_info';

// ค่า 1 ค่าที่ดึงจากข้อมูลขององค์กร
export type Operand = {
  source_type: SourceType;
  scopedetail_id: string | null;
  info_id: string | null;
  metric: 'amount' | 'ghg_emission' | null;
};

// เงื่อนไข 1 ข้อ: ค่า (หรืออัตราส่วน A ÷ B ถ้ามี denominator) เทียบกับตัวเลข
//   หรือ (operator in / not_in) ตัวเลือกที่องค์กรเลือก เทียบกับรายการตัวเลือก option_ids
export type Condition = Operand & {
  operator: Operator;
  value: number;
  denominator: Operand | null;
  option_ids: string[]; // ใช้เฉพาะ in / not_in (ตาราง recommendation_condition_option)
};

export type Recommendation = {
  rec_id: string; // [แก้ไข] เดิม rec_uid
  name: string;
  percent: number | null; // % ที่ลดได้ 0-100 (percent_min) null = ไม่กรอก -> แนะนำพร้อมค่าที่พบ แต่ไม่คำนวณ tCO2e
  // [ลบ] percentMin / percentMax (ช่วง %) ไม่มี percent_max ในฐานข้อมูลแล้ว แนวทางมี % เดียว
  scopedetail_id: string | null; // รายการย่อยที่ผูก (แนวทางแบบสูตรใช้ค่า EF ของรายการนี้)
  // ฐานของ %: 'detail:<scopedetail_id>' | 'activity:<activity_id>' (ทั้งกิจกรรม) | 'scope:<scope_id>' (ทั้ง Scope) | null = ไม่ผูก
  baseKey: string | null;
  calcMethod: string;   // percent | lamp_led | ac_inverter (lib/measureFormulas.ts)
  conditions: Condition[];
  efKgPerUnit: number | null;  // สูตร: EF × GWP ของกิจกรรมที่ผูก (kgCO2e ต่อหน่วยของกิจกรรม เช่น ต่อ kWh)
};

// ข้อมูลขององค์กรที่ใช้ตัดสินเงื่อนไข
export type OrgData = {
  activity: Record<string, { amount: number; ghg: number }>; // key = scopedetail_id
  base: Record<string, number>;                              // tCO2e ของแต่ละฐาน key = baseKey (detail: / activity: / scope:)
  office: Record<string, number>;                            // key = info_id (หัวข้อตัวเลข/เปอร์เซ็นต์)
  // หัวข้อแบบตัวเลือก: key = info_id, value = ตัวเลือกที่องค์กร "มี"
  //   เลือกค่าเดียว = [option_id ที่เลือก] / กรอกจำนวน = ทุกตัวเลือกที่จำนวน > 0
  officeChoice: Record<string, string[]>;
  officeOptionQty: Record<string, number>;                   // key = option_id, value = จำนวนที่กรอก (หัวข้อที่กรอกจำนวน)
  scope: Record<number, number>;                             // tCO2e ต่อ scope
  total: number;
  periodDays: number | null;                                 // วันใช้งานในช่วงเวลาของรายการ (จำนวนวันทำงาน/ปี, รายเดือน ÷ 12) null = ไม่มี
  hoursPerDay: number | null;                                // ค่าหัวข้อ "ชั่วโมงทำงานต่อวัน" ของรายการนี้ (null = ไม่มี)
  acBtu: number | null;                                      // ค่าหัวข้อ "ขนาดเครื่องปรับอากาศ" (BTU) ใช้กับสูตรแอร์ (null = ไม่มี)
};

export type Applied = Recommendation & {
  amount: number | null; // tCO2e ที่ลดได้ null = แนะนำทั่วไป
  calcNote: string | null; // วิธีคิดของสูตร เช่น "เปลี่ยน 40 หลอด: (46 − 18) W × ... = 201.6 kWh"
  // [ลบ] low / high (ช่วงประมาณการ) เพราะไม่มี % สูงสุดแล้ว
};

// เปรียบเทียบตัวเลข 2 ค่าตามเครื่องหมายที่ระบุ
function compare(a: number, op: Operator, b: number): boolean {
  switch (op) {
    case '>': return a > b;
    case '>=': return a >= b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '=': return a === b;
    default: return false; // in / not_in ตัดสินใน conditionMet (ไม่ใช่การเทียบตัวเลข)
  }
}

// ค่าของ 1 operand คืน null ถ้าไม่มีข้อมูล
function operandValue(o: Operand, d: OrgData): number | null {
  switch (o.source_type) {
    case 'activity': {
      const a = o.scopedetail_id ? d.activity[o.scopedetail_id] : undefined;
      if (!a) return null;
      return o.metric === 'ghg_emission' ? a.ghg : a.amount;
    }
    case 'office_info':
      return o.info_id && o.info_id in d.office ? d.office[o.info_id] : null;
    default:
      return null; // ประเภทที่เลิกใช้แล้ว (scope / total)
  }
}

// ค่าที่ใช้เทียบ: ค่าเดี่ยว หรือ A ÷ B
// ไม่มีข้อมูล หรือตัวหาร <= 0 → null (เงื่อนไขไม่ผ่าน)
export function conditionValue(c: Condition, d: OrgData): number | null {
  const num = operandValue(c, d);
  if (num === null) return null;
  if (!c.denominator) return num;

  const den = operandValue(c.denominator, d);
  if (den === null || den <= 0) return null;
  return num / den;
}

// ไม่มีข้อมูล = ไม่ผ่าน (ไม่แนะนำโดยเดา)
export function conditionMet(c: Condition, d: OrgData): boolean {
  // เงื่อนไขแบบตัวเลือก: องค์กร "มี" ตัวเลือกใดในรายการของเงื่อนไขไหม (ยังไม่ได้กรอกหัวข้อนี้ = ไม่ผ่าน)
  //   in     = มีอย่างน้อย 1 ตัว เช่น มีหลอด Fluorescent (จำนวน > 0)
  //   not_in = ไม่มีเลยสักตัว
  if (isChoiceOperator(c.operator)) {
    const has = c.info_id ? d.officeChoice[c.info_id] : undefined;
    if (!has || has.length === 0) return false;
    const hit = has.some((id) => c.option_ids.includes(id));
    return c.operator === 'in' ? hit : !hit;
  }
  const v = conditionValue(c, d);
  return v !== null && compare(v, c.operator, c.value);
}

// วิธีคำนวณแบบ % ของก๊าซที่ผูกไว้
function calcPercent(base: number, percent: number) {
  return {
    amount: (base * percent) / 100,
  };
}

/**
 * จุดต่อยอด: ถ้าจะเพิ่มสูตรเฉพาะมาตรการ ให้เพิ่มที่นี่
 *   if (rec.calcMethod === 'ac_replace' && ข้อมูลครบ) { return สูตรแอร์ }
 * ถ้าข้อมูลไม่ครบ ให้ใช้ % ตามเดิม (ตอนนี้ทุกวิธีใช้ % ไปก่อน)
 */
function calc(base: number, percent: number) {
  return calcPercent(base, percent);
}

/* [สูตร] จำนวนอุปกรณ์เดิม (N) ของสูตร = ผลรวมจำนวนของตัวเลือกในเงื่อนไข "เป็นหนึ่งใน" ของแนวทาง
 * เช่น เงื่อนไข "ชนิดหลอดไฟ เป็นหนึ่งใน [Fluorescent]" + องค์กรกรอก Fluorescent 40 ดวง -> N = 40 */
function deviceCount(r: Recommendation, d: OrgData): number {
  let n = 0;
  for (const c of r.conditions) {
    if (c.operator !== 'in') continue;
    for (const id of c.option_ids) n += d.officeOptionQty[id] ?? 0;
  }
  return n;
}

/* [สูตร] แนวทางแบบสูตร: kWh ที่ลด × EF ÷ 1000 -> tCO2e (ตัวสูตร kWh อยู่ใน lib/measureFormulas.ts) (ข้อมูลไม่ครบ = ไม่คำนวณ แต่ยังแนะนำพร้อมเหตุผล) */
function applyFormula(r: Recommendation, d: OrgData): { amount: number | null; calcNote: string | null } {
  if (!isFormulaMethod(r.calcMethod)) return { amount: null, calcNote: null };
  const n = deviceCount(r, d);
  const hours = d.hoursPerDay;
  if (n <= 0) return { amount: null, calcNote: 'ยังคำนวณไม่ได้: ไม่พบจำนวนอุปกรณ์ที่กรอกไว้' };
  if (hours === null || hours <= 0) return { amount: null, calcNote: `ยังคำนวณไม่ได้: ไม่พบ "${HOURS_INFO_NAME}" ในข้อมูลสำนักงาน` };
  if (d.periodDays === null || d.periodDays <= 0) return { amount: null, calcNote: `ยังคำนวณไม่ได้: ไม่พบ "${DAYS_INFO_NAME}" ในข้อมูลสำนักงาน` };
  if (r.calcMethod === 'ac_inverter' && (d.acBtu === null || d.acBtu <= 0)) {
    return { amount: null, calcNote: `ยังคำนวณไม่ได้: ไม่พบ "${AC_BTU_INFO_NAME}" ในข้อมูลสำนักงาน` };
  }
  if (r.efKgPerUnit === null) return { amount: null, calcNote: 'ยังคำนวณไม่ได้: กิจกรรมที่ผูกไม่มีค่า EF' };
  const { kwh, note } = formulaSaving(r.calcMethod, n, hours, d.periodDays, d.acBtu ?? 0);
  const amount = (kwh * r.efKgPerUnit) / 1000; // [สูตร] tCO2e = kWh × EF (kgCO2e/kWh) ÷ 1000
  return { amount, calcNote: note };
}

// เลือกแนวทางที่ผ่านทุกเงื่อนไข เรียงจากเปอร์เซ็นต์มากไปน้อย แล้วคำนวณปริมาณที่ลดได้
export function evaluate(recs: Recommendation[], data: OrgData): Applied[] {
  const applicable = recs
    .filter((r) => r.conditions.every((c) => conditionMet(c, data)))
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));

  const remaining: Record<string, number> = {}; // ก๊าซที่เหลือต่อกิจกรรม (คิดต่อเนื่อง ไม่บวก % ซ้อน)
  const out: Applied[] = [];

  for (const r of applicable) {
    // [สูตร] แนวทางแบบสูตร: คิดจากจำนวนอุปกรณ์จริง ไม่ใช้ % และไม่หักจากก๊าซที่เหลือของแบบ %
    if (isFormulaMethod(r.calcMethod)) {
      out.push({ ...r, ...applyFormula(r, data) });
      continue;
    }
    if (!r.baseKey) {
      out.push({ ...r, amount: null, calcNote: null }); // แนะนำทั่วไป ไม่มีตัวเลข
      continue;
    }
    // ฐาน = ก๊าซรวมของรายการย่อย / ทั้งกิจกรรม / ทั้ง Scope ตามที่แอดมินเลือก
    const base = remaining[r.baseKey] ?? data.base[r.baseKey] ?? 0;
    if (base <= 0) continue; // องค์กรนี้ไม่มีการปล่อยจากกิจกรรมนี้ → ไม่แนะนำ
    if (r.percent === null) {
      out.push({ ...r, amount: null, calcNote: null }); // ไม่ได้กรอก % -> แนะนำพร้อมค่าที่พบ ไม่คำนวณปริมาณที่ลดได้
      continue;
    }
    const { amount } = calc(base, r.percent);
    remaining[r.baseKey] = base - amount;
    out.push({ ...r, amount, calcNote: null });
  }
  return out;
}
