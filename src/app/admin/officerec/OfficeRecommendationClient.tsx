'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { dbErrorMessage, deleteRecord, insertRecord, updateRecord } from '@/lib/supabaseCrud';
import { validateForm, extendSchema, notDuplicate, existsIn, type formError } from '@/lib/validation';
import { normalizeToArabicNumber } from '@/lib/normalization';
import { infoSchema, recSchema, condValueSchema, type InfoField, type RecField } from './schema';

/* [ปรับปรุง] สรุปสิ่งที่เปลี่ยนในไฟล์นี้
 * 1) ลบตัวช่วยตรวจที่เขียนซ้ำในไฟล์ (cleanText/cleanNumber/isNumeric/isNumberOnlyText)
 *    แล้วใช้ schema.ts + validation.ts / normalization.ts กลางแทน
 * 2) หัวข้อข้อมูลสำนักงาน: เดิมตรวจแค่ชื่อ ตอนนี้ตรวจหน่วย (ไทย/อังกฤษได้) และคำอธิบายด้วย + ห้ามชื่อซ้ำ
 * 3) แนวทาง: ห้ามชื่อซ้ำ, % ทศนิยมไม่เกิน 2 หลัก, กิจกรรมที่ผูกต้องมีอยู่จริง
 * 4) เงื่อนไข: ค่าที่เทียบทศนิยมไม่เกิน 4 หลัก และกิจกรรม/หัวข้อที่เลือกต้องมีอยู่จริง (ตรวจความสัมพันธ์)
 * 5) เพิ่มการแก้ไขหัวข้อข้อมูลสำนักงาน และแก้ไขแนวทาง (พร้อมเงื่อนไข) */

// ---------- ชนิดข้อมูล ----------
type InfoType = {
  info_id: string;
  info_name: string | null;
  unit: string | null;
  info_detail: string | null;
};
type ActivityOption = { scopedetail_id: string; detail_name: string | null; unit: string | null };
type Operator = '>' | '>=' | '<' | '<=' | '=';
type SourceType = 'activity' | 'office_info' | 'scope' | 'total';
type Metric = 'amount' | 'ghg_emission';

// ค่า 1 ค่าในเงื่อนไข (ใช้ทั้งตัวตั้งและตัวหาร)
type OperandLike = {
  source_type: SourceType;
  scopedetail_id: string | null;
  info_id: string | null;
  scope_number: number | string | null;
  metric: Metric | null;
};

type CondRow = {
  condition_id: string;
  source_type: SourceType;
  scopedetail_id: string | null;
  info_id: string | null;
  scope_number: number | null;
  metric: Metric | null;
  operator: Operator;
  value: number;
  den_source_type: SourceType | null;
  den_scopedetail_id: string | null;
  den_info_id: string | null;
  den_scope_number: number | null;
  den_metric: Metric | null;
};
type RecRow = {
  rec_uid: string;
  recommendation: string | null;
  carbon_reduction_amount: number | null; // % ตัวแทน (ค่ากลาง)
  percent_min: number | null;
  percent_max: number | null;
  scopedetail_id: string | null;
  calc_method: string | null;
  status: string | null;
  recommendation_condition?: CondRow[];
};

type OperandForm = {
  source_type: SourceType;
  scopedetail_id: string;
  info_id: string;
  scope_number: string;
  metric: Metric;
};
type CondForm = {
  mode: 'single' | 'ratio';
  num: OperandForm; // ตัวตั้ง (หรือค่าเดี่ยว)
  den: OperandForm; // ตัวหาร (ใช้เมื่อ mode = ratio)
  operator: Operator;
  value: string;
};
type RecForm = {
  recommendation: string;
  percent_min: string;
  percent_max: string;
  scopedetail_id: string;
};

const emptyRec: RecForm = {
  recommendation: '',
  percent_min: '',
  percent_max: '',
  scopedetail_id: '',
};
const emptyOperand: OperandForm = {
  source_type: 'activity',
  scopedetail_id: '',
  info_id: '',
  scope_number: '1',
  metric: 'amount',
};
const newCond = (): CondForm => ({
  mode: 'single',
  num: { ...emptyOperand },
  den: { ...emptyOperand, source_type: 'office_info' },
  operator: '>',
  value: '',
});

// [แก้ไข] ตัวช่วยตรวจที่เคยอยู่ตรงนี้ย้ายไปใช้ไฟล์กลางแล้ว (ดู schema.ts)
const round2 = (n: number) => Math.round(n * 100) / 100;

// [เพิ่ม] แปลงเงื่อนไขที่บันทึกแล้ว (CondRow) กลับเป็นค่าในฟอร์ม เพื่อใช้ตอนแก้ไขแนวทาง
const rowToOperand = (
  source_type: SourceType,
  scopedetail_id: string | null,
  info_id: string | null,
  scope_number: number | null,
  metric: Metric | null
): OperandForm => ({
  source_type,
  scopedetail_id: scopedetail_id ?? '',
  info_id: info_id ?? '',
  scope_number: String(scope_number ?? 1),
  metric: metric ?? 'amount',
});
const rowToCond = (c: CondRow): CondForm => ({
  mode: c.den_source_type ? 'ratio' : 'single',
  num: rowToOperand(c.source_type, c.scopedetail_id, c.info_id, c.scope_number, c.metric),
  den: c.den_source_type
    ? rowToOperand(c.den_source_type, c.den_scopedetail_id, c.den_info_id, c.den_scope_number, c.den_metric)
    : { ...emptyOperand, source_type: 'office_info' },
  operator: c.operator,
  value: String(c.value),
});

// ---------- component ย่อย ----------
function Dialog({
  title,
  onClose,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[90vh] max-w-full overflow-y-auto rounded-xl bg-white p-6 ${
          wide ? 'w-[860px]' : 'w-[440px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Err({ m }: { m?: string }) {
  return m ? <p className="mt-1 text-xs text-red-600">{m}</p> : null;
}

const inputCls = (bad?: boolean) =>
  `w-full border rounded-lg px-3 py-2 text-sm ${bad ? 'border-red-500' : ''}`;

// ตัวเลือก 1 ค่า (ตัวตั้ง หรือ ตัวหาร)
function OperandPicker({
  v,
  onChange,
  activityOptions,
  infoTypes,
}: {
  v: OperandForm;
  onChange: (next: OperandForm) => void;
  activityOptions: ActivityOption[];
  infoTypes: InfoType[];
}) {
  const set = (p: Partial<OperandForm>) => onChange({ ...v, ...p });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="rounded border px-2 py-1"
        value={v.source_type}
        onChange={(e) => set({ source_type: e.target.value as SourceType })}
      >
        <option value="activity">ค่าของกิจกรรม</option>
        <option value="office_info">ข้อมูลสำนักงาน</option>
        <option value="scope">ก๊าซรวมของ Scope</option>
        <option value="total">ก๊าซรวมทั้งหมด</option>
      </select>

      {v.source_type === 'activity' && (
        <>
          <select
            className="max-w-[200px] rounded border px-2 py-1"
            value={v.scopedetail_id}
            onChange={(e) => set({ scopedetail_id: e.target.value })}
          >
            <option value="">เลือกกิจกรรม</option>
            {activityOptions.map((a) => (
              <option key={a.scopedetail_id} value={a.scopedetail_id}>
                {a.detail_name} {a.unit ? `(${a.unit})` : ''}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-2 py-1"
            value={v.metric}
            onChange={(e) => set({ metric: e.target.value as Metric })}
          >
            <option value="amount">ปริมาณที่ใช้</option>
            <option value="ghg_emission">ก๊าซที่ปล่อย (tCO2e)</option>
          </select>
        </>
      )}

      {v.source_type === 'office_info' && (
        <select
          className="max-w-[240px] rounded border px-2 py-1"
          value={v.info_id}
          onChange={(e) => set({ info_id: e.target.value })}
        >
          <option value="">เลือกข้อมูลสำนักงาน</option>
          {infoTypes.map((o) => (
            <option key={o.info_id} value={o.info_id}>
              {o.info_name} {o.unit ? `(${o.unit})` : ''}
            </option>
          ))}
        </select>
      )}

      {v.source_type === 'scope' && (
        <select
          className="rounded border px-2 py-1"
          value={v.scope_number}
          onChange={(e) => set({ scope_number: e.target.value })}
        >
          <option value="1">Scope 1</option>
          <option value="2">Scope 2</option>
          <option value="3">Scope 3</option>
        </select>
      )}
    </div>
  );
}

export default function OfficeRecommendationClient({
  initialInfoTypes,
  initialRecs,
  activityOptions,
}: {
  initialInfoTypes: InfoType[];
  initialRecs: RecRow[];
  activityOptions: ActivityOption[];
}) {
  const [infoTypes, setInfoTypes] = useState<InfoType[]>(initialInfoTypes);
  const [recs, setRecs] = useState<RecRow[]>(initialRecs);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showRecModal, setShowRecModal] = useState(false);

  const [infoForm, setInfoForm] = useState({ info_name: '', unit: '', info_detail: '' });
  const [infoErrors, setInfoErrors] = useState<formError<InfoField>>({});
  const [editInfoId, setEditInfoId] = useState<string | null>(null); // [เพิ่ม] null = เพิ่มใหม่

  const [recForm, setRecForm] = useState<RecForm>(emptyRec);
  const [conds, setConds] = useState<CondForm[]>([]);
  // conds = ข้อความ error รวมของเงื่อนไข (ไม่ใช่ช่องในตาราง จึงเพิ่มเป็น key พิเศษ)
  const [recErrors, setRecErrors] = useState<formError<RecField | 'conds'>>({});
  const [editRecId, setEditRecId] = useState<string | null>(null); // [เพิ่ม] null = เพิ่มใหม่
  const [saving, setSaving] = useState(false);

  // ---------- ตัวช่วยแสดงผล ----------
  const actName = (id: string | null) =>
    activityOptions.find((a) => a.scopedetail_id === id)?.detail_name ?? 'กิจกรรมที่ถูกลบ';
  const infoName = (id: string | null) =>
    infoTypes.find((i) => i.info_id === id)?.info_name ?? 'หัวข้อที่ถูกลบ';

  // ข้อความอธิบาย 1 ค่า
  function operandText(o: OperandLike): string {
    switch (o.source_type) {
      case 'activity':
        return `${actName(o.scopedetail_id || null)} (${
          o.metric === 'ghg_emission' ? 'ก๊าซที่ปล่อย' : 'ปริมาณที่ใช้'
        })`;
      case 'office_info':
        return infoName(o.info_id || null);
      case 'scope':
        return `ก๊าซรวม Scope ${o.scope_number}`;
      case 'total':
        return 'ก๊าซรวมทั้งหมด';
    }
  }

  // หน่วยของ 1 ค่า (ใช้แสดง "หน่วยของค่าที่เทียบ")
  function operandUnit(o: OperandLike): string {
    switch (o.source_type) {
      case 'activity':
        return o.metric === 'ghg_emission'
          ? 'tCO2e'
          : activityOptions.find((a) => a.scopedetail_id === o.scopedetail_id)?.unit ?? '?';
      case 'office_info':
        return infoTypes.find((i) => i.info_id === o.info_id)?.unit?.trim() || '?';
      default:
        return 'tCO2e';
    }
  }

  function describeCond(c: CondRow): string {
    const num: OperandLike = {
      source_type: c.source_type,
      scopedetail_id: c.scopedetail_id,
      info_id: c.info_id,
      scope_number: c.scope_number,
      metric: c.metric,
    };
    if (c.den_source_type) {
      const den: OperandLike = {
        source_type: c.den_source_type,
        scopedetail_id: c.den_scopedetail_id,
        info_id: c.den_info_id,
        scope_number: c.den_scope_number,
        metric: c.den_metric,
      };
      return `(${operandText(num)}) ÷ (${operandText(den)}) ${c.operator} ${c.value}`;
    }
    return `${operandText(num)} ${c.operator} ${c.value}`;
  }

  const percentText = (r: RecRow) => {
    const mid = r.carbon_reduction_amount;
    if (r.percent_min && r.percent_max && r.percent_min !== r.percent_max) {
      return `${r.percent_min}–${r.percent_max}%`;
    }
    return mid === null ? '-' : `${mid}%`;
  };

  // ================= หัวข้อข้อมูลสำนักงาน =================
  // [เพิ่ม] เปิด popup หัวข้อ: ไม่ส่ง row = เพิ่ม / ส่ง row = แก้ไข
  function openInfoModal(row?: InfoType) {
    setEditInfoId(row?.info_id ?? null);
    setInfoForm({
      info_name: row?.info_name ?? '',
      unit: row?.unit ?? '',
      info_detail: row?.info_detail ?? '',
    });
    setInfoErrors({});
    setShowInfoModal(true);
  }

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();

    // [แก้ไข] ใช้ schema กลาง + ห้ามชื่อหัวข้อซ้ำ (ไม่นับหัวข้อที่กำลังแก้ไข)
    const others = infoTypes.filter((i) => i.info_id !== editInfoId).map((i) => i.info_name);
    const result = validateForm(
      infoForm,
      extendSchema(infoSchema, { info_name: [notDuplicate('ชื่อหัวข้อ', others)] })
    );
    setInfoErrors(result.ok ? {} : result.errors);
    if (!result.ok) return;

    const { info_name, unit, info_detail } = result.clean;
    const values = { info_name, unit: unit || null, info_detail: info_detail || null };

    if (editInfoId) {
      // ⚠️ เปลี่ยนหน่วยของหัวข้อที่บริษัทกรอกไว้แล้ว ค่าเดิมของบริษัทจะถูกตีความด้วยหน่วยใหม่
      const old = infoTypes.find((i) => i.info_id === editInfoId);
      if (old && (old.unit ?? '') !== (values.unit ?? '') &&
          !confirm('เปลี่ยนหน่วยของหัวข้อนี้? ค่าที่บริษัทเคยกรอกไว้จะถูกตีความด้วยหน่วยใหม่')) {
        return;
      }
      const updated = await updateRecord<InfoType>(
        'office_info_type', 'info_id', editInfoId,
        { ...values, updated_at: new Date().toISOString() }, '*', 'แก้ไขหัวข้อข้อมูลสำนักงาน'
      );
      if (!updated) return;
      setInfoTypes((prev) => prev.map((i) => (i.info_id === editInfoId ? updated : i)));
    } else {
      const created = await insertRecord<InfoType>(
        'office_info_type', values, '*', 'เพิ่มหัวข้อข้อมูลสำนักงาน'
      );
      if (!created) return;
      setInfoTypes((prev) => [...prev, created]);
    }

    setShowInfoModal(false);
    setInfoForm({ info_name: '', unit: '', info_detail: '' });
  }

  async function handleDeleteInfo(id: string) {
    // ถ้ามีบริษัทกรอกข้อมูลหัวข้อนี้ไว้แล้ว ฐานข้อมูลจะไม่ให้ลบ
    // ถ้ามีเงื่อนไขของแนวทางอ้างถึงหัวข้อนี้ เงื่อนไขนั้นจะถูกลบตาม (แนวทางอาจเหลือเงื่อนไขน้อยลง)
    const used = recs.some((r) =>
      (r.recommendation_condition ?? []).some((c) => c.info_id === id || c.den_info_id === id)
    );
    const ok = await deleteRecord(
      'office_info_type',
      'info_id',
      id,
      used
        ? 'หัวข้อนี้ถูกใช้ในเงื่อนไขของบางแนวทาง ถ้าลบ เงื่อนไขเหล่านั้นจะถูกลบตามด้วย ต้องการลบ?'
        : 'ลบหัวข้อนี้? (ถ้ามีบริษัทกรอกข้อมูลหัวข้อนี้ไว้แล้ว จะลบไม่ได้)'
    );
    if (!ok) return;
    setInfoTypes((prev) => prev.filter((i) => i.info_id !== id));
    // ปรับ state ให้ตรงกับที่ฐานข้อมูลลบเงื่อนไขตาม
    setRecs((prev) =>
      prev.map((r) => ({
        ...r,
        recommendation_condition: (r.recommendation_condition ?? []).filter(
          (c) => c.info_id !== id && c.den_info_id !== id
        ),
      }))
    );
  }

  // ================= แนวทางลดคาร์บอน =================
  // [แก้ไข] รับ row ได้ เพื่อเปิดในโหมดแก้ไข (เติมค่าเดิม + เงื่อนไขเดิม)
  function openRecModal(row?: RecRow) {
    setEditRecId(row?.rec_uid ?? null);
    setRecForm(
      row
        ? {
            recommendation: row.recommendation ?? '',
            percent_min: row.percent_min == null ? '' : String(row.percent_min),
            // บันทึกค่าเดียวจะเก็บ max = min ไว้ จึงแสดงช่องสูงสุดว่างถ้าเท่ากัน
            percent_max:
              row.percent_max == null || row.percent_max === row.percent_min ? '' : String(row.percent_max),
            scopedetail_id: row.scopedetail_id ?? '',
          }
        : emptyRec
    );
    setConds((row?.recommendation_condition ?? []).map(rowToCond));
    setRecErrors({});
    setShowRecModal(true);
  }

  // ตรวจ 1 ค่าในเงื่อนไข คืนข้อความ error หรือ null
  // [แก้ไข] เพิ่มการตรวจว่ากิจกรรม/หัวข้อที่เลือก "ยังมีอยู่จริง" (อาจถูกลบไปแล้วตอนแก้ไขแนวทางเก่า)
  function operandError(o: OperandForm): string | null {
    if (o.source_type === 'activity') {
      if (!o.scopedetail_id) return 'กรุณาเลือกกิจกรรม';
      if (!activityOptions.some((a) => a.scopedetail_id === o.scopedetail_id)) return 'กิจกรรมที่เลือกไม่มีอยู่ในระบบแล้ว';
    }
    if (o.source_type === 'office_info') {
      if (!o.info_id) return 'กรุณาเลือกข้อมูลสำนักงาน';
      if (!infoTypes.some((i) => i.info_id === o.info_id)) return 'หัวข้อที่เลือกไม่มีอยู่ในระบบแล้ว';
    }
    if (o.source_type === 'scope' && !['1', '2', '3'].includes(o.scope_number)) return 'Scope ไม่ถูกต้อง';
    return null;
  }

  function validateRec() {
    // ---- ช่องหลักของแนวทาง: ใช้ schema กลาง + ห้ามชื่อซ้ำ + กิจกรรมที่ผูกต้องมีอยู่จริง ----
    const others = recs.filter((r) => r.rec_uid !== editRecId).map((r) => r.recommendation);
    const result = validateForm(
      recForm,
      extendSchema(recSchema, {
        recommendation: [notDuplicate('ชื่อแนวทาง', others)],
        scopedetail_id: [existsIn('กิจกรรมที่เกี่ยวข้อง', activityOptions.map((a) => a.scopedetail_id))],
      })
    );
    const errs: formError<RecField | 'conds'> = result.ok ? {} : { ...result.errors };

    const min = normalizeToArabicNumber(result.clean.percent_min) ?? 0;
    const max = normalizeToArabicNumber(result.clean.percent_max); // null = กรอกค่าเดียว
    // ตรวจข้ามช่อง: ค่าสูงสุดต้องไม่น้อยกว่าค่าต่ำสุด (ทำหลังจากทั้ง 2 ช่องผ่านกฎของตัวเองแล้ว)
    if (!errs.percent_min && !errs.percent_max && max !== null && max < min) {
      errs.percent_max = 'ต้องไม่น้อยกว่าค่าต่ำสุด';
    }

    // ---- เงื่อนไข: หยุดที่ข้อแรกที่ผิด ----
    const condValues: number[] = []; // ค่าที่ normalize แล้ว ใช้ตอนบันทึก
    for (let i = 0; i < conds.length; i++) {
      const c = conds[i];
      const label = `เงื่อนไขข้อ ${i + 1}`;

      const e1 = operandError(c.num);
      if (e1) {
        errs.conds = `${label}: ${e1}${c.mode === 'ratio' ? ' (ตัวตั้ง)' : ''}`;
        break;
      }

      if (c.mode === 'ratio') {
        const e2 = operandError(c.den);
        if (e2) {
          errs.conds = `${label}: ${e2} (ตัวหาร)`;
          break;
        }
        // A ÷ A = 1 เสมอ ไม่มีความหมาย
        if (JSON.stringify(c.num) === JSON.stringify(c.den)) {
          errs.conds = `${label}: ตัวตั้งและตัวหารต้องไม่ใช่ค่าเดียวกัน`;
          break;
        }
      }

      // [แก้ไข] ค่าที่เทียบใช้ schema กลาง: ไม่ติดลบ ทศนิยมไม่เกิน 4 หลัก รับเลขไทย/comma ได้
      const v = validateForm({ value: c.value }, condValueSchema);
      if (!v.ok) {
        errs.conds = `${label}: ${v.errors.value}`;
        break;
      }
      condValues.push(normalizeToArabicNumber(v.clean.value) ?? 0);
    }

    // [เพิ่ม] เงื่อนไขซ้ำกันทุกส่วน (ค่า/ตัวดำเนินการ/ตัวเลขเหมือนกัน) ไม่มีประโยชน์
    if (!errs.conds) {
      const keys = conds.map((c, i) =>
        JSON.stringify([c.mode, c.num, c.mode === 'ratio' ? c.den : null, c.operator, condValues[i]])
      );
      const dup = keys.findIndex((k, i) => keys.indexOf(k) !== i);
      if (dup !== -1) errs.conds = `เงื่อนไขข้อ ${dup + 1} ซ้ำกับข้อก่อนหน้า`;
    }

    return { errs, name: result.clean.recommendation, scopedetailId: result.clean.scopedetail_id, min, max, condValues };
  }

  // แปลงค่า 1 ค่าเป็นคอลัมน์ในตาราง
  const numCols = (o: OperandForm) => ({
    source_type: o.source_type,
    scopedetail_id: o.source_type === 'activity' ? o.scopedetail_id : null,
    info_id: o.source_type === 'office_info' ? o.info_id : null,
    scope_number: o.source_type === 'scope' ? Number(o.scope_number) : null,
    metric: o.source_type === 'activity' ? o.metric : null,
  });
  const denCols = (o: OperandForm | null) => ({
    den_source_type: o ? o.source_type : null,
    den_scopedetail_id: o && o.source_type === 'activity' ? o.scopedetail_id : null,
    den_info_id: o && o.source_type === 'office_info' ? o.info_id : null,
    den_scope_number: o && o.source_type === 'scope' ? Number(o.scope_number) : null,
    den_metric: o && o.source_type === 'activity' ? o.metric : null,
  });

  async function handleSaveRec(e: React.FormEvent) {
    e.preventDefault();

    const { errs, name, scopedetailId, min, max, condValues } = validateRec();
    setRecErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);

    // ค่าตัวแทน = ค่ากลางของช่วง (ถ้ากรอกค่าเดียว = ค่านั้น)
    const high = max ?? min;
    const mid = round2((min + high) / 2);

    const recValues = {
      recommendation: name, // ค่าที่ normalize แล้ว
      carbon_reduction_amount: mid,
      percent_min: min,
      percent_max: high,
      scopedetail_id: scopedetailId || null,
      calc_method: 'percent',
    };
    // แถวเงื่อนไขที่จะบันทึก (ค่าที่เทียบใช้ค่าที่ normalize แล้วจาก validateRec)
    const condRows = (recUid: string) =>
      conds.map((c, i) => ({
        rec_uid: recUid,
        ...numCols(c.num),
        ...denCols(c.mode === 'ratio' ? c.den : null),
        operator: c.operator,
        value: condValues[i], // [แก้ไข] เดิม Number(cleanNumber(c.value)) ซ้ำงานกับตอนตรวจ
      }));

    // ===== [เพิ่ม] โหมดแก้ไข =====
    if (editRecId) {
      const old = recs.find((r) => r.rec_uid === editRecId);
      // 1) แก้แนวทาง (สถานะเดิมคงไว้)
      const updated = await updateRecord<RecRow>(
        'carbon_reduction_recommendation', 'rec_uid', editRecId, recValues, '*', 'แก้ไขแนวทาง'
      );
      if (!updated) {
        setSaving(false);
        return;
      }
      // 2) เพิ่มเงื่อนไขชุดใหม่ "ก่อน" แล้วค่อยลบชุดเดิม ถ้าเพิ่มล้มเหลว เงื่อนไขเดิมยังอยู่ครบ
      let savedConds: CondRow[] = [];
      if (conds.length > 0) {
        const { data, error } = await supabase
          .from('recommendation_condition')
          .insert(condRows(editRecId))
          .select('*');
        if (error) {
          setSaving(false);
          return alert('บันทึกเงื่อนไขไม่สำเร็จ: ' + dbErrorMessage(error));
        }
        savedConds = (data ?? []) as CondRow[];
      }
      const oldIds = (old?.recommendation_condition ?? []).map((c) => c.condition_id);
      if (oldIds.length > 0) {
        const { error } = await supabase.from('recommendation_condition').delete().in('condition_id', oldIds);
        if (error) {
          setSaving(false);
          return alert('ลบเงื่อนไขเดิมไม่สำเร็จ: ' + dbErrorMessage(error));
        }
      }
      setRecs((prev) =>
        prev.map((r) => (r.rec_uid === editRecId ? { ...updated, recommendation_condition: savedConds } : r))
      );
      setSaving(false);
      setShowRecModal(false);
      return;
    }

    // ===== โหมดเพิ่มใหม่ =====
    // 1) บันทึกแนวทาง (เริ่มเป็นร่าง ต้องกด "เผยแพร่" ก่อนองค์กรจะเห็น)
    const created = await insertRecord<RecRow>(
      'carbon_reduction_recommendation',
      { ...recValues, status: 'draft' },
      '*',
      'เพิ่มแนวทาง'
    );
    if (!created) {
      setSaving(false);
      return;
    }

    // 2) บันทึกเงื่อนไข (ถ้าล้มเหลวต้องลบแนวทางทิ้ง ไม่ให้เหลือแนวทางที่ไม่มีเงื่อนไข)
    let savedConds: CondRow[] = [];
    if (conds.length > 0) {
      const { data, error } = await supabase
        .from('recommendation_condition')
        .insert(condRows(created.rec_uid))
        .select('*');

      if (error) {
        await supabase
          .from('carbon_reduction_recommendation')
          .delete()
          .eq('rec_uid', created.rec_uid);
        setSaving(false);
        return alert('บันทึกเงื่อนไขไม่สำเร็จ: ' + dbErrorMessage(error));
      }
      savedConds = (data ?? []) as CondRow[];
    }

    setRecs((prev) => [...prev, { ...created, recommendation_condition: savedConds }]);
    setSaving(false);
    setShowRecModal(false);
  }

  async function handleDeleteRec(id: string) {
    // เงื่อนไขของแนวทางนี้ถูกลบตามอัตโนมัติ
    const ok = await deleteRecord(
      'carbon_reduction_recommendation',
      'rec_uid',
      id,
      'ลบแนวทางนี้พร้อมเงื่อนไขทั้งหมด?'
    );
    if (!ok) return;
    setRecs((prev) => prev.filter((r) => r.rec_uid !== id));
  }

  async function toggleStatus(r: RecRow) {
    const next = r.status === 'published' ? 'draft' : 'published';

    if (next === 'published') {
      if (!r.carbon_reduction_amount || r.carbon_reduction_amount > 100) {
        return alert('เผยแพร่ไม่ได้: ค่า % ที่ลดได้ต้องอยู่ระหว่าง 0-100');
      }
      const noCond = (r.recommendation_condition ?? []).length === 0;
      const msg = noCond
        ? 'แนวทางนี้ไม่มีเงื่อนไข จะถูกแนะนำให้ทุกองค์กร ต้องการเผยแพร่?'
        : 'เผยแพร่แนวทางนี้? องค์กรที่เข้าเงื่อนไขจะเห็นในรายงานทันที';
      if (!confirm(msg)) return;
    }

    const { data, error } = await supabase
      .from('carbon_reduction_recommendation')
      .update({ status: next })
      .eq('rec_uid', r.rec_uid)
      .select('rec_uid');

    if (error) return alert('เปลี่ยนสถานะไม่สำเร็จ: ' + error.message);
    if (!data || data.length === 0) {
      return alert('เปลี่ยนสถานะไม่สำเร็จ: ไม่พบข้อมูลหรือไม่มีสิทธิ์');
    }

    setRecs((prev) => prev.map((x) => (x.rec_uid === r.rec_uid ? { ...x, status: next } : x)));
  }

  // แก้ค่าในแถวเงื่อนไขใน popup
  const setCond = (i: number, patch: Partial<CondForm>) =>
    setConds((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  // ข้อความ "หน่วยของค่าที่เทียบ" ของเงื่อนไข 1 ข้อใน popup
  const unitHint = (c: CondForm) =>
    c.mode === 'ratio' ? `${operandUnit(c.num)} ÷ ${operandUnit(c.den)}` : operandUnit(c.num);

  const sortedRecs = recs
    .slice()
    .sort((a, b) => (a.recommendation ?? '').localeCompare(b.recommendation ?? '', 'th'));

  return (
    <div className="max-w-[1280px] space-y-8 px-8 pb-8 pt-16">
      <h1 className="text-[32px] font-bold leading-[32px] tracking-[-0.6px] text-[#0F172A]">
        ข้อมูลสำนักงานและแนวทางลดคาร์บอน
      </h1>

      {/* ============ ส่วนที่ 1: หัวข้อข้อมูลสำนักงาน ============ */}
      <div className="w-full rounded-xl border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-6 py-6">
          <h2 className="text-xl font-bold text-[#0F172A]">
            หัวข้อข้อมูลสำนักงาน (ช่องที่บริษัทต้องกรอก)
          </h2>
          <button
            onClick={() => openInfoModal()}
            className="rounded-lg bg-[#266955] px-3 py-1.5 text-xs text-white shadow-sm"
          >
            + เพิ่มหัวข้อ
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <tr className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
                <th className="px-5 py-3 text-left">ชื่อหัวข้อ</th>
                <th className="px-5 py-3 text-left">หน่วย</th>
                <th className="px-5 py-3 text-left">คำอธิบาย</th>
                <th className="px-5 py-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {infoTypes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[#94A3B8]">
                    ยังไม่มีหัวข้อ
                  </td>
                </tr>
              )}
              {infoTypes.map((i) => (
                <tr key={i.info_id} className="border-t border-[#F1F5F9]">
                  <td className="px-5 py-4 text-[#0F172A]">{i.info_name}</td>
                  <td className="px-5 py-4 text-[#64748B]">{i.unit ?? '-'}</td>
                  <td className="px-5 py-4 text-[#64748B] whitespace-pre-line">{i.info_detail ?? '-'}</td>
                  <td className="px-5 py-4 text-center space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => openInfoModal(i)}
                      className="text-[#94A3B8] hover:text-[#266955]"
                      title="แก้ไข"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteInfo(i.info_id)}
                      className="text-[#94A3B8] hover:text-red-500"
                      title="ลบ"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ ส่วนที่ 2: แนวทางลดคาร์บอน ============ */}
      <div className="w-full rounded-xl border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-6 py-6">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">แนวทางลดคาร์บอน</h2>
            <p className="mt-1 text-xs text-[#94A3B8]">
              เปอร์เซ็นต์ที่ลดได้คิดจากก๊าซของ &quot;กิจกรรมที่ผูก&quot; ขององค์กรนั้น
              แนวทางที่ยังเป็นร่างจะไม่แสดงในรายงาน
            </p>
          </div>
          <button
            onClick={() => openRecModal()}
            className="rounded-lg bg-[#266955] px-3 py-1.5 text-xs text-white shadow-sm"
          >
            + เพิ่มแนวทาง
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <tr className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
                <th className="px-5 py-3 text-left">แนวทาง</th>
                <th className="px-5 py-3 text-left">กิจกรรมที่ผูก</th>
                <th className="px-5 py-3 text-right">ลดได้</th>
                <th className="px-5 py-3 text-left">เงื่อนไข (ต้องผ่านทุกข้อ)</th>
                <th className="px-5 py-3 text-center">สถานะ</th>
                <th className="px-5 py-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[#94A3B8]">
                    ยังไม่มีแนวทาง
                  </td>
                </tr>
              )}
              {sortedRecs.map((r) => {
                const published = r.status === 'published';
                const rc = r.recommendation_condition ?? [];
                return (
                  <tr key={r.rec_uid} className="border-t border-[#F1F5F9] align-top">
                    <td className="px-5 py-4 font-medium text-[#0F172A]">{r.recommendation}</td>
                    <td className="px-5 py-4 text-[#64748B]">
                      {r.scopedetail_id ? actName(r.scopedetail_id) : 'ไม่ผูก (แนะนำทั่วไป)'}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-[#047857]">
                      {percentText(r)}
                    </td>
                    <td className="px-5 py-4 text-xs text-[#64748B]">
                      {rc.length === 0 ? (
                        <span className="text-[#F97316]">ไม่มีเงื่อนไข (แนะนำทุกองค์กร)</span>
                      ) : (
                        <ul className="space-y-1">
                          {rc.map((c) => (
                            <li key={c.condition_id}>• {describeCond(c)}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => toggleStatus(r)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          published
                            ? 'bg-[#F0FDF4] text-[#16A34A]'
                            : 'bg-[#F1F5F9] text-[#64748B]'
                        }`}
                        title={published ? 'กดเพื่อถอนกลับเป็นร่าง' : 'กดเพื่อเผยแพร่'}
                      >
                        {published ? 'เผยแพร่แล้ว' : 'ร่าง'}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-center space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => openRecModal(r)}
                        className="text-[#94A3B8] hover:text-[#266955]"
                        title="แก้ไข"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteRec(r.rec_uid)}
                        className="text-[#94A3B8] hover:text-red-500"
                        title="ลบ"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ Popup: เพิ่มหัวข้อข้อมูลสำนักงาน ============ */}
      {showInfoModal && (
        <Dialog
          title={editInfoId ? 'แก้ไขหัวข้อข้อมูลสำนักงาน' : 'เพิ่มหัวข้อข้อมูลสำนักงาน'}
          onClose={() => setShowInfoModal(false)}
        >
          <form onSubmit={handleSaveInfo} noValidate className="space-y-4">
            <div>
              <input
                className={inputCls(!!infoErrors.info_name)}
                placeholder="ชื่อหัวข้อ เช่น จำนวนพนักงาน"
                maxLength={150}
                value={infoForm.info_name}
                onChange={(e) => setInfoForm({ ...infoForm, info_name: e.target.value })}
              />
              <Err m={infoErrors.info_name} />
            </div>
            {/* [แก้ไข] เดิมหน่วยและคำอธิบายไม่มีการตรวจ/ไม่แสดง error */}
            <div>
              <input
                className={inputCls(!!infoErrors.unit)}
                placeholder="หน่วย เช่น คน, ตร.ม., kWh/ปี, % (เว้นว่างได้ = ช่องข้อความ)"
                maxLength={50}
                value={infoForm.unit}
                onChange={(e) => setInfoForm({ ...infoForm, unit: e.target.value })}
              />
              <Err m={infoErrors.unit} />
            </div>
            <div>
              <textarea
                className={inputCls(!!infoErrors.info_detail)}
                rows={3}
                maxLength={1000}
                placeholder="คำอธิบายที่จะแสดงให้บริษัทเห็น (ไม่บังคับ) เช่น ให้กรอกค่าเฉลี่ยของทั้งอาคาร"
                value={infoForm.info_detail}
                onChange={(e) => setInfoForm({ ...infoForm, info_detail: e.target.value })}
              />
              <Err m={infoErrors.info_detail} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#059669] px-4 py-2 text-sm text-white"
              >
                บันทึก
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ============ Popup: เพิ่มแนวทางลดคาร์บอน ============ */}
      {showRecModal && (
        <Dialog
          title={editRecId ? 'แก้ไขแนวทางลดคาร์บอน' : 'เพิ่มแนวทางลดคาร์บอน'}
          onClose={() => setShowRecModal(false)}
          wide
        >
          <form onSubmit={handleSaveRec} noValidate className="space-y-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">ชื่อแนวทาง</label>
              <input
                className={inputCls(!!recErrors.recommendation)}
                placeholder="เช่น เปลี่ยนมาใช้เครื่องปรับอากาศระบบ Inverter"
                maxLength={255}
                value={recForm.recommendation}
                onChange={(e) => setRecForm({ ...recForm, recommendation: e.target.value })}
              />
              <Err m={recErrors.recommendation} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">
                กิจกรรมที่เกี่ยวข้อง (ฐานที่ใช้คำนวณ %)
              </label>
              <select
                className={inputCls(!!recErrors.scopedetail_id)}
                value={recForm.scopedetail_id}
                onChange={(e) => setRecForm({ ...recForm, scopedetail_id: e.target.value })}
              >
                <option value="">ไม่ผูก (แนะนำทั่วไป ไม่คำนวณตัวเลข)</option>
                {activityOptions.map((a) => (
                  <option key={a.scopedetail_id} value={a.scopedetail_id}>
                    {a.detail_name} {a.unit ? `(${a.unit})` : ''}
                  </option>
                ))}
              </select>
              <Err m={recErrors.scopedetail_id} />
              <p className="mt-1 text-xs text-[#94A3B8]">
                % ที่กรอกด้านล่างต้องนิยามเทียบกับกิจกรรมนี้เท่านั้น (เช่น % ของก๊าซจากไฟฟ้า)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">
                  ลดได้ต่ำสุด (%)
                </label>
                <input
                  className={inputCls(!!recErrors.percent_min)}
                  inputMode="decimal"
                  placeholder="เช่น 5"
                  value={recForm.percent_min}
                  onChange={(e) => setRecForm({ ...recForm, percent_min: e.target.value })}
                />
                <Err m={recErrors.percent_min} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">
                  ลดได้สูงสุด (%) (เว้นว่าง = ค่าเดียว)
                </label>
                <input
                  className={inputCls(!!recErrors.percent_max)}
                  inputMode="decimal"
                  placeholder="เช่น 10"
                  value={recForm.percent_max}
                  onChange={(e) => setRecForm({ ...recForm, percent_max: e.target.value })}
                />
                <Err m={recErrors.percent_max} />
              </div>
            </div>

            {/* เงื่อนไขการแนะนำ */}
            <div className="rounded-xl border border-[#E2E8F0] p-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0F172A]">
                  เงื่อนไขการแนะนำ (ต้องผ่านทุกข้อ)
                </p>
                <button
                  type="button"
                  onClick={() => setConds((prev) => [...prev, newCond()])}
                  className="text-sm font-semibold text-[#266955]"
                >
                  + เพิ่มเงื่อนไข
                </button>
              </div>
              <p className="mb-3 text-xs text-[#94A3B8]">
                ค่าในเงื่อนไขเทียบกับข้อมูล 1 รายการบันทึกขององค์กร ซึ่งถือเป็นข้อมูล 1 ปี
                ถ้าข้อมูลที่ใช้เทียบไม่มี หรือตัวหารเป็น 0 เงื่อนไขนั้นไม่ผ่าน
                ถ้าไม่ใส่เงื่อนไขเลย แนวทางนี้จะถูกแนะนำให้ทุกองค์กร
              </p>

              {conds.length === 0 && (
                <p className="py-2 text-xs text-[#F97316]">ยังไม่มีเงื่อนไข</p>
              )}

              <div className="space-y-4">
                {conds.map((c, i) => (
                  <div key={i} className="rounded-lg bg-[#F8FAFC] p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1">
                          <input
                            type="radio"
                            checked={c.mode === 'single'}
                            onChange={() => setCond(i, { mode: 'single' })}
                          />
                          ค่าเดี่ยว
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="radio"
                            checked={c.mode === 'ratio'}
                            onChange={() => setCond(i, { mode: 'ratio' })}
                          />
                          อัตราส่วน (A ÷ B)
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConds((prev) => prev.filter((_, j) => j !== i))}
                        className="text-[#94A3B8] hover:text-red-500"
                      >
                        ลบเงื่อนไขนี้
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {c.mode === 'ratio' && (
                          <span className="w-16 text-xs font-bold">A (ตัวตั้ง)</span>
                        )}
                        <OperandPicker
                          v={c.num}
                          onChange={(next) => setCond(i, { num: next })}
                          activityOptions={activityOptions}
                          infoTypes={infoTypes}
                        />
                      </div>

                      {c.mode === 'ratio' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-16 text-xs font-bold">B (ตัวหาร)</span>
                          <OperandPicker
                            v={c.den}
                            onChange={(next) => setCond(i, { den: next })}
                            activityOptions={activityOptions}
                            infoTypes={infoTypes}
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="rounded border px-2 py-1"
                          value={c.operator}
                          onChange={(e) => setCond(i, { operator: e.target.value as Operator })}
                        >
                          <option value=">">มากกว่า</option>
                          <option value=">=">มากกว่าหรือเท่ากับ</option>
                          <option value="<">น้อยกว่า</option>
                          <option value="<=">น้อยกว่าหรือเท่ากับ</option>
                          <option value="=">เท่ากับ</option>
                        </select>
                        <input
                          className="w-32 rounded border px-2 py-1"
                          inputMode="decimal"
                          placeholder="ค่า"
                          value={c.value}
                          onChange={(e) => setCond(i, { value: e.target.value })}
                        />
                        <span className="text-xs text-[#64748B]">
                          หน่วยของค่าที่เทียบ: <b>{unitHint(c)}</b>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Err m={recErrors.conds} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRecModal(false)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#059669] px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {saving ? 'กำลังบันทึก...' : editRecId ? 'บันทึกการแก้ไข' : 'บันทึกเป็นร่าง'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}