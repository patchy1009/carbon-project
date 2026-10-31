export type Operator = '>' | '>=' | '<' | '<=' | '=';
export type SourceType = 'activity' | 'office_info' | 'scope' | 'total';

// ค่า 1 ค่าที่ดึงจากข้อมูลขององค์กร
export type Operand = {
  source_type: SourceType;
  scopedetail_id: string | null;
  info_id: string | null;
  scope_number: number | null;
  metric: 'amount' | 'ghg_emission' | null;
};

// เงื่อนไข 1 ข้อ: ค่า (หรืออัตราส่วน A ÷ B ถ้ามี denominator) เทียบกับตัวเลข
export type Condition = Operand & {
  operator: Operator;
  value: number;
  denominator: Operand | null;
};

export type Recommendation = {
  rec_uid: string;
  name: string;
  percent: number;      // % ตัวแทน (ค่ากลาง) 0-100
  percentMin: number;   // ขอบล่างของช่วง
  percentMax: number;   // ขอบบนของช่วง
  scopedetail_id: string | null; // กิจกรรมที่ผูก = ฐานของ %
  calcMethod: string;   // percent | ac_replace | refrigerant_leak
  conditions: Condition[];
};

// ข้อมูลขององค์กรที่ใช้ตัดสินเงื่อนไข
export type OrgData = {
  activity: Record<string, { amount: number; ghg: number }>; // key = scopedetail_id
  office: Record<string, number>;                            // key = info_id
  scope: Record<number, number>;                             // tCO2e ต่อ scope
  total: number;
};

export type Applied = Recommendation & {
  amount: number | null; // tCO2e ที่ลดได้ (ค่ากลาง) null = แนะนำทั่วไป
  low: number | null;
  high: number | null;
};

function compare(a: number, op: Operator, b: number): boolean {
  switch (op) {
    case '>': return a > b;
    case '>=': return a >= b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '=': return a === b;
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
    case 'scope':
      return o.scope_number ? d.scope[o.scope_number] ?? null : null;
    case 'total':
      return d.total;
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
  const v = conditionValue(c, d);
  return v !== null && compare(v, c.operator, c.value);
}

// วิธีคำนวณแบบ % ของก๊าซที่ผูกไว้
function calcPercent(base: number, rec: Recommendation) {
  return {
    amount: (base * rec.percent) / 100,
    low: (base * rec.percentMin) / 100,
    high: (base * rec.percentMax) / 100,
  };
}

/**
 * จุดต่อยอด: ถ้าจะเพิ่มสูตรเฉพาะมาตรการ ให้เพิ่มที่นี่
 *   if (rec.calcMethod === 'ac_replace' && ข้อมูลครบ) { return สูตรแอร์ }
 * ถ้าข้อมูลไม่ครบ ให้ใช้ % ตามเดิม (ตอนนี้ทุกวิธีใช้ % ไปก่อน)
 */
function calc(base: number, rec: Recommendation) {
  return calcPercent(base, rec);
}

export function evaluate(recs: Recommendation[], data: OrgData): Applied[] {
  const applicable = recs
    .filter((r) => r.conditions.every((c) => conditionMet(c, data)))
    .sort((a, b) => b.percent - a.percent);

  const remaining: Record<string, number> = {}; // ก๊าซที่เหลือต่อกิจกรรม (คิดต่อเนื่อง ไม่บวก % ซ้อน)
  const out: Applied[] = [];

  for (const r of applicable) {
    if (!r.scopedetail_id) {
      out.push({ ...r, amount: null, low: null, high: null }); // แนะนำทั่วไป ไม่มีตัวเลข
      continue;
    }
    const base = remaining[r.scopedetail_id] ?? data.activity[r.scopedetail_id]?.ghg ?? 0;
    if (base <= 0) continue; // องค์กรนี้ไม่มีการปล่อยจากกิจกรรมนี้ → ไม่แนะนำ
    const { amount, low, high } = calc(base, r);
    remaining[r.scopedetail_id] = base - amount;
    out.push({ ...r, amount, low, high });
  }
  return out;
}