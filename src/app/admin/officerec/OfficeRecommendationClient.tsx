// หน้าจัดการแนวทางลดคาร์บอนของแอดมิน: เพิ่มหัวข้อข้อมูลสำนักงาน แนวทาง และเงื่อนไขของแนวทาง
'use client';

import Select from '@/components/Select'; // dropdown กลาง (แทน <select> ของ browser ให้หน้าตาเหมือนกันทั้งระบบ)
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { dbErrorMessage, deleteRecord, withOrgImpact, insertRecord, updateRecord } from '@/lib/supabaseCrud';
import { validateForm, extendSchema, notDuplicate, existsIn, type formError } from '@/lib/validation';
import { normalizeToArabicNumber } from '@/lib/normalization';
import { showConfirm, showError, showSaved } from '@/lib/dialog'; // กล่องแจ้งเตือนกลางแทน alert/confirm
import {
  infoSchema, recSchema, condValueSchema, optionSchema, INPUT_TYPE_LABEL,
  type InfoField, type RecField, type InputType,
} from './schema';
import { normalizeForCompare } from '@/lib/normalization';
import { INFO_GROUPS, groupByInfoGroup } from '@/lib/officeInfoGroups'; // หมวดของหัวข้อข้อมูลสำนักงาน
import { AC_BTU_INFO_NAME, CALC_METHODS, DAYS_INFO_NAME, HOURS_INFO_NAME, findInfoIdByName, isFormulaMethod, type CalcMethod } from '@/lib/measureFormulas'; // สูตรคำนวณแนวทาง
import RowActions from '@/components/RowActions'; // ปุ่มแก้ไข/ลบกลาง (เดิมเขียนซ้ำทุกตาราง)
import { T } from '@/components/adminTable'; // การ์ด/ตารางแบบเดียวกับหน้า T-VER Project
import { inputClass } from '@/components/formStyles'; // class ช่องกรอกกลาง
import { ModalShell } from '@/components/Modal';
import FieldError from '@/components/FieldError';

/* สรุปสิ่งที่เปลี่ยนในไฟล์นี้
 * 1) ลบตัวช่วยตรวจที่เขียนซ้ำในไฟล์ (cleanText/cleanNumber/isNumeric/isNumberOnlyText)
 *    แล้วใช้ schema.ts + validation.ts / normalization.ts กลางแทน
 * 2) หัวข้อข้อมูลสำนักงาน: เดิมตรวจแค่ชื่อ ตอนนี้ตรวจหน่วย (ไทย/อังกฤษได้) และคำอธิบายด้วย + ห้ามชื่อซ้ำ
 * 3) แนวทาง: ห้ามชื่อซ้ำ, % ทศนิยมไม่เกิน 2 หลัก, กิจกรรมที่ผูกต้องมีอยู่จริง
 * 4) เงื่อนไข: ค่าที่เทียบทศนิยมไม่เกิน 4 หลัก และกิจกรรม/หัวข้อที่เลือกต้องมีอยู่จริง (ตรวจความสัมพันธ์)
 * 5) เพิ่มการแก้ไขหัวข้อข้อมูลสำนักงาน และแก้ไขแนวทาง (พร้อมเงื่อนไข) */

/* 6) เงื่อนไขแบบตัวเลือก (supabase/office_info_choice.sql)
 *    - หัวข้อข้อมูลสำนักงานมีชนิด (input_type): ตัวเลข / เปอร์เซ็นต์ / ข้อความ / ตัวเลือก
 *    - หัวข้อแบบตัวเลือก: แอดมินเพิ่ม/แก้/ลบตัวเลือกได้ในหน้าต่างเดียวกับหัวข้อ (ตาราง office_info_option)
 *    - เงื่อนไขของหัวข้อแบบตัวเลือก: "เป็นหนึ่งใน" / "ไม่ใช่" + ติ๊กตัวเลือก (ตาราง recommendation_condition_option)
 *      ไม่มีตัวเลขให้เทียบ (value = null) และใช้แบบเทียบ 2 ค่าไม่ได้ */

// ---------- ชนิดข้อมูล ----------
type InfoOption = { option_id: string; label: string; sort_order: number };
type InfoType = {
  info_id: string;
  info_name: string | null;
  unit: string | null;
  info_detail: string | null;
  input_type: InputType | null;
  info_group: string | null; // หมวด (supabase/office_info_group.sql)
  has_quantity?: boolean;    // แบบตัวเลือก: กรอกจำนวนของแต่ละตัวเลือก (supabase/office_info_quantity.sql)
  office_info_option?: InfoOption[];
};
type ActivityOption = { scopedetail_id: string; detail_name: string | null; unit: string | null; activity_id?: string | null };
// ฐานของ % แบบ "ทั้ง Scope" / "ทั้งกิจกรรม" (supabase/recommendation_base_level.sql)
type ScopeOption = { scope_id: string; scope_number: number | null; scope_name: string | null };
type ActivityGroup = { activity_id: string; activity_name: string | null; scope_id: string | null };

/* ฐานของ % เก็บในฟอร์มเป็น key เดียว แล้วแยกเป็น 3 คอลัมน์ตอนบันทึก
 *   'detail:<scopedetail_id>' -> scopedetail_id / 'activity:<activity_id>' -> base_activity_id / 'scope:<scope_id>' -> base_scope_id */
const baseKeyOf = (r: { scopedetail_id: string | null; base_activity_id?: string | null; base_scope_id?: string | null }) =>
  r.scopedetail_id ? `detail:${r.scopedetail_id}`
  : r.base_activity_id ? `activity:${r.base_activity_id}`
  : r.base_scope_id ? `scope:${r.base_scope_id}`
  : '';
//   ส่ง base_activity_id / base_scope_id เฉพาะเมื่อใช้ หรือแถวเดิมเคยมีค่า (ต้องล้างเป็น null)
//   -> ฐานแบบรายการย่อยยังบันทึกได้ แม้ยังไม่ได้รัน supabase/recommendation_base_level.sql
const baseCols = (key: string, old?: { base_activity_id?: string | null; base_scope_id?: string | null }) => {
  const cols: Record<string, string | null> = { scopedetail_id: key.startsWith('detail:') ? key.slice(7) : null };
  const act = key.startsWith('activity:') ? key.slice(9) : null;
  const scope = key.startsWith('scope:') ? key.slice(6) : null;
  if (act || old?.base_activity_id) cols.base_activity_id = act;
  if (scope || old?.base_scope_id) cols.base_scope_id = scope;
  return cols;
};
// in / not_in = เงื่อนไขแบบตัวเลือก
type Operator = '>' | '>=' | '<' | '<=' | '=' | 'in' | 'not_in';
const isChoiceOp = (op: Operator) => op === 'in' || op === 'not_in';

// ชนิดของหัวข้อ (หัวข้อเก่าก่อนรัน office_info_choice.sql ไม่มี input_type -> เดาจากหน่วยแบบเดิม)
const kindOfInfo = (t: InfoType): InputType =>
  t.input_type ?? (!t.unit?.trim() ? 'text' : t.unit.includes('%') ? 'percent' : 'number');
// ตัวเลือกของหัวข้อ เรียงตามลำดับที่ตั้งไว้
const optionsOf = (t: InfoType | undefined) =>
  (t?.office_info_option ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

// แถวตัวเลือกในฟอร์มหัวข้อ (option_id ว่าง = ตัวเลือกใหม่ที่ยังไม่บันทึก)
type OptionForm = { option_id: string; label: string };
// เงื่อนไขใช้ได้แค่ค่าของกิจกรรม / ข้อมูลสำนักงาน
// [เลิกใช้] 'scope' (ก๊าซรวมของ Scope) และ 'total' (ก๊าซรวมทั้งหมด) แถวเก่าใน DB อาจยังมีค่านี้ -> LegacySourceType
type SourceType = 'activity' | 'office_info';
type LegacySourceType = SourceType | 'scope' | 'total';
type Metric = 'amount' | 'ghg_emission';

// ค่า 1 ค่าในเงื่อนไข (ใช้ทั้งตัวตั้งและตัวหาร)
type OperandLike = {
  source_type: LegacySourceType;
  scopedetail_id: string | null;
  info_id: string | null;
  scope_number?: number | null; // ใช้แสดงเงื่อนไขเก่าแบบ Scope เท่านั้น
  metric: Metric | null;
};

type CondRow = {
  condition_id: string;
  source_type: LegacySourceType;
  scopedetail_id: string | null;
  info_id: string | null;
  scope_number: number | null;
  metric: Metric | null;
  operator: Operator;
  value: number | null; // null = เงื่อนไขแบบตัวเลือก
  den_source_type: LegacySourceType | null;
  den_scopedetail_id: string | null;
  den_info_id: string | null;
  den_scope_number: number | null;
  den_metric: Metric | null;
  recommendation_condition_option?: { option_id: string }[];
};
type RecRow = {
  rec_id: string; // [แก้ไข] เดิม rec_uid (คอลัมน์ซ้ำ) -> ใช้ PK rec_id ตรงๆ (supabase/schema_cleanup.sql ขั้น 4.2)
  recommendation: string | null;
  carbon_reduction_amount: number | null; // % ที่ลดได้ (บันทึกเท่ากับ percent_min)
  percent_min: number | null;
  // [ลบ] percent_max (% สูงสุดที่ลดได้) ไม่เก็บแล้ว แนวทางมี % เดียว -> ลบคอลัมน์ใน DB ได้
  scopedetail_id: string | null;   // ฐาน: รายการย่อย
  base_activity_id?: string | null; // ฐาน: ทั้งกิจกรรม
  base_scope_id?: string | null;    // ฐาน: ทั้ง Scope
  calc_method: string | null;   // percent | lamp_led | ac_inverter (lib/measureFormulas.ts)
  // [ลบ] status (ร่าง/เผยแพร่) คอลัมน์ถูกลบแล้ว (schema_cleanup.sql ขั้น 4.1)
  recommendation_condition?: CondRow[];
};

type OperandForm = {
  source_type: SourceType;
  scopedetail_id: string;
  info_id: string;
  metric: Metric;
};
type CondForm = {
  mode: 'single' | 'ratio';
  num: OperandForm; // ตัวตั้ง (หรือค่าเดี่ยว)
  den: OperandForm; // ตัวหาร (ใช้เมื่อ mode = ratio)
  operator: Operator;
  value: string;
  option_ids: string[]; // ตัวเลือกที่ติ๊ก (ใช้เมื่อค่า A เป็นหัวข้อแบบตัวเลือก)
};
type RecForm = {
  recommendation: string;
  percent_min: string;
  scopedetail_id: string;
};

const emptyRec: RecForm = {
  recommendation: '',
  percent_min: '',
  scopedetail_id: '',
};
const emptyOperand: OperandForm = {
  source_type: 'activity',
  scopedetail_id: '',
  info_id: '',
  metric: 'amount',
};
// สร้างเงื่อนไขว่าง 1 แถวสำหรับฟอร์ม
const newCond = (): CondForm => ({
  mode: 'single',
  num: { ...emptyOperand },
  den: { ...emptyOperand, source_type: 'office_info' },
  operator: '>',
  value: '',
  option_ids: [],
});

// ตัวช่วยตรวจที่เคยอยู่ตรงนี้ย้ายไปใช้ไฟล์กลางแล้ว (ดู schema.ts)
// [ลบ] round2 เคยใช้หาค่ากลางของช่วง % (ไม่มี percent_max แล้ว)

// แปลงเงื่อนไขที่บันทึกแล้ว (CondRow) กลับเป็นค่าในฟอร์ม เพื่อใช้ตอนแก้ไขแนวทาง
// เงื่อนไขเก่าแบบ scope / total ที่เลิกใช้แล้ว -> กลายเป็น "ค่าของกิจกรรม" ที่ยังไม่ได้เลือก ให้แอดมินเลือกใหม่ก่อนบันทึก
const rowToOperand = (
  source_type: LegacySourceType,
  scopedetail_id: string | null,
  info_id: string | null,
  metric: Metric | null
): OperandForm =>
  source_type === 'activity' || source_type === 'office_info'
    ? {
        source_type,
        scopedetail_id: scopedetail_id ?? '',
        info_id: info_id ?? '',
        metric: metric ?? 'amount',
      }
    : { ...emptyOperand };
// แปลงเงื่อนไขจากฐานข้อมูลให้อยู่ในรูปแบบของฟอร์ม
const rowToCond = (c: CondRow): CondForm => ({
  mode: c.den_source_type ? 'ratio' : 'single',
  num: rowToOperand(c.source_type, c.scopedetail_id, c.info_id, c.metric),
  den: c.den_source_type
    ? rowToOperand(c.den_source_type, c.den_scopedetail_id, c.den_info_id, c.den_metric)
    : { ...emptyOperand, source_type: 'office_info' },
  operator: c.operator,
  value: c.value == null ? '' : String(c.value),
  option_ids: (c.recommendation_condition_option ?? []).map((o) => o.option_id),
});

// ---------- component ย่อย ----------
/* Dialog / Err ที่เคยเขียนไว้ในไฟล์นี้ ย้ายไปใช้ ModalShell (components/Modal) และ FieldError กลางแทน */

// ตัวเลือก 1 ค่า (ตัวตั้ง หรือ ตัวหาร)
function OperandPicker({
  v,
  onChange,
  activityOptions,
  infoTypes,
  isDenominator = false,
}: {
  v: OperandForm;
  onChange: (next: OperandForm) => void;
  activityOptions: ActivityOption[];
  infoTypes: InfoType[];
  isDenominator?: boolean; // ค่า B ของการเทียบ 2 ค่า: ต้องเป็นตัวเลขเท่านั้น
}) {
  // หัวข้อที่ใช้ในเงื่อนไขได้: ข้อความใช้ไม่ได้เลย / ตัวเลือกใช้ได้แค่เป็นค่าเดี่ยว (ไม่ใช่ค่า B)
  const usableInfo = infoTypes.filter((o) => {
    const k = kindOfInfo(o);
    return k === 'number' || k === 'percent' || (k === 'choice' && !isDenominator);
  });
  // แก้ค่าบางช่อง แล้วส่งค่าทั้งหมดกลับไปให้ฟอร์มหลัก
  const set = (p: Partial<OperandForm>) => onChange({ ...v, ...p });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        className="rounded border px-2 py-1"
        value={v.source_type}
        onChange={(val) => set({ source_type: val as SourceType })}
        options={[
          { value: 'activity', label: 'ค่าของกิจกรรม' },
          { value: 'office_info', label: 'ข้อมูลสำนักงาน' },
          // [ลบ] ก๊าซรวมของ Scope / ก๊าซรวมทั้งหมด (เลิกใช้แล้ว)
        ]}
      />

      {v.source_type === 'activity' && (
        <>
          <Select
            className="max-w-[200px] rounded border px-2 py-1"
            value={v.scopedetail_id}
            onChange={(val) => set({ scopedetail_id: val })}
            options={[
              { value: '', label: 'เลือกกิจกรรม', placeholder: true },
              ...activityOptions.map((a) => ({ value: a.scopedetail_id, label: `${a.detail_name} ${a.unit ? `(${a.unit})` : ''}` })),
            ]}
          />
          <Select
            className="rounded border px-2 py-1"
            value={v.metric}
            onChange={(val) => set({ metric: val as Metric })}
            options={[
              { value: 'amount', label: 'ปริมาณที่ใช้' },
              { value: 'ghg_emission', label: 'ก๊าซที่ปล่อย (tCO2e)' },
            ]}
          />
        </>
      )}

      {v.source_type === 'office_info' && (
        <Select
          className="max-w-[240px] rounded border px-2 py-1"
          value={v.info_id}
          onChange={(val) => set({ info_id: val })}
          options={[
            { value: '', label: 'เลือกข้อมูลสำนักงาน', placeholder: true },
            ...usableInfo.map((o) => ({
              value: o.info_id,
              label: kindOfInfo(o) === 'choice'
                ? `${o.info_name} (ตัวเลือก)`
                : `${o.info_name} ${o.unit ? `(${o.unit})` : ''}`,
            })),
          ]}
        />
      )}

    </div>
  );
}

// หน้าจอหลัก รับข้อมูลเริ่มต้นจาก page.tsx แล้วเก็บใน state เพื่อให้แก้ไขบนหน้าได้ทันที
export default function OfficeRecommendationClient({
  initialInfoTypes,
  initialRecs,
  activityOptions,
  scopeOptions = [],
  activityGroups = [],
}: {
  initialInfoTypes: InfoType[];
  initialRecs: RecRow[];
  activityOptions: ActivityOption[];
  scopeOptions?: ScopeOption[];
  activityGroups?: ActivityGroup[];
}) {
  const [infoTypes, setInfoTypes] = useState<InfoType[]>(initialInfoTypes);
  const [recs, setRecs] = useState<RecRow[]>(initialRecs);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showRecModal, setShowRecModal] = useState(false);

  const [infoForm, setInfoForm] = useState({ info_group: '', info_name: '', unit: '', info_detail: '' });
  const [inputType, setInputType] = useState<InputType>('number'); // ชนิดของหัวข้อ
  const [hasQuantity, setHasQuantity] = useState(false);           // แบบตัวเลือก: ให้กรอกจำนวนของแต่ละตัวเลือก
  const [optRows, setOptRows] = useState<OptionForm[]>([]);        // ตัวเลือก (ใช้เมื่อชนิด = choice)
  // options = error รวมของรายการตัวเลือก / input_type = error ของชนิด
  const [infoErrors, setInfoErrors] = useState<formError<InfoField | 'options' | 'input_type'>>({});
  const [editInfoId, setEditInfoId] = useState<string | null>(null); // null = เพิ่มใหม่

  const [recForm, setRecForm] = useState<RecForm>(emptyRec);
  const [conds, setConds] = useState<CondForm[]>([]);
  // conds = ข้อความ error รวมของเงื่อนไข (ไม่ใช่ช่องในตาราง จึงเพิ่มเป็น key พิเศษ)
  const [recErrors, setRecErrors] = useState<formError<RecField | 'conds' | 'hours'>>({});
  const [calcMethod, setCalcMethod] = useState<CalcMethod>('percent'); // วิธีคำนวณปริมาณที่ลดได้
  const [editRecId, setEditRecId] = useState<string | null>(null); // null = เพิ่มใหม่
  const [saving, setSaving] = useState(false);

  // ---------- ตัวช่วยแสดงผล ----------
  const actName = (id: string | null) =>
    activityOptions.find((a) => a.scopedetail_id === id)?.detail_name ?? 'กิจกรรมที่ถูกลบ';
  // ชื่อของ Scope / กิจกรรม (ฐานของ %)
  const scopeLabel = (sc: ScopeOption | undefined) =>
    sc ? `Scope ${sc.scope_number ?? ''}${sc.scope_name ? ` ${sc.scope_name}` : ''}` : 'Scope ที่ถูกลบ';
  // ชื่อฐานของแนวทาง สำหรับตาราง
  const baseLabel = (key: string) => {
    if (key.startsWith('scope:')) return `${scopeLabel(scopeOptions.find((x) => x.scope_id === key.slice(6)))} (ทั้ง Scope)`;
    if (key.startsWith('activity:')) {
      return `${activityGroups.find((a) => a.activity_id === key.slice(9))?.activity_name ?? 'กิจกรรมที่ถูกลบ'} (ทั้งกิจกรรม)`;
    }
    return actName(key.slice(7));
  };
  /* ตัวเลือกฐาน เรียงเป็นลำดับชั้น: Scope -> กิจกรรม -> รายการย่อย
   *   แนวทางแบบสูตรเลือกได้เฉพาะรายการย่อย (ต้องใช้ค่า EF ต่อหน่วยของรายการนั้น) */
  const baseOptions = (detailOnly: boolean) => {
    const opts: { value: string; label: string }[] = [];
    const detailOpt = (a: ActivityOption) => ({
      value: `detail:${a.scopedetail_id}`,
      label: `${detailOnly ? '' : '    · '}${a.detail_name} ${a.unit ? `(${a.unit})` : ''}`,
    });
    const placed = new Set<string>();
    for (const sc of scopeOptions) {
      if (!detailOnly) opts.push({ value: `scope:${sc.scope_id}`, label: `${scopeLabel(sc)}: ทั้ง Scope` });
      for (const g of activityGroups.filter((a) => a.scope_id === sc.scope_id)) {
        if (!detailOnly) opts.push({ value: `activity:${g.activity_id}`, label: `  ▸ ${g.activity_name}: ทั้งกิจกรรม` });
        for (const a of activityOptions.filter((d) => d.activity_id === g.activity_id)) {
          opts.push(detailOpt(a));
          placed.add(a.scopedetail_id);
        }
      }
    }
    // รายการย่อยที่หากิจกรรม/Scope ไม่เจอ (หรือยังไม่ได้โหลดความสัมพันธ์) แสดงท้ายรายการ
    for (const a of activityOptions) if (!placed.has(a.scopedetail_id)) opts.push(detailOpt(a));
    return opts;
  };

  // หาชื่อหัวข้อข้อมูลสำนักงานจาก id ถ้าหาไม่เจอแปลว่าหัวข้อถูกลบแล้ว
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
      // เงื่อนไขเก่าที่เลิกใช้แล้ว: ยังแสดงให้แอดมินเห็น แต่ไม่มีผลในรายงาน (ถือว่าไม่ผ่าน) ต้องแก้หรือลบ
      case 'scope':
        return `ก๊าซรวม Scope ${o.scope_number} (เลิกใช้แล้ว)`;
      case 'total':
        return 'ก๊าซรวมทั้งหมด (เลิกใช้แล้ว)';
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

  // หัวข้อแบบตัวเลือก (คืน undefined ถ้าไม่ใช่ / ไม่ได้เลือก)
  const choiceInfo = (infoId: string | null | undefined) => {
    const t = infoTypes.find((i) => i.info_id === infoId);
    return t && kindOfInfo(t) === 'choice' ? t : undefined;
  };
  // ชื่อตัวเลือกจาก id
  const optionLabel = (optionId: string) =>
    infoTypes.flatMap((t) => t.office_info_option ?? []).find((o) => o.option_id === optionId)?.label ?? 'ตัวเลือกที่ถูกลบ';

  // สร้างข้อความอธิบายเงื่อนไขสำหรับแสดงในตาราง
  function describeCond(c: CondRow): string {
    // เงื่อนไขแบบตัวเลือก เช่น "ชนิดหลอดไฟ เป็น ฟลูออเรสเซนต์ หรือ หลอดไส้"
    if (isChoiceOp(c.operator)) {
      const labels = (c.recommendation_condition_option ?? []).map((o) => optionLabel(o.option_id));
      return `${infoName(c.info_id)} ${c.operator === 'in' ? 'เป็น' : 'ไม่ใช่'} ${labels.join(' หรือ ') || '-'}`;
    }
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
      // เดิมแสดง "(A) ÷ (B) > 5" -> "A ต่อ B > 5" อ่านเป็นภาษาพูดได้ เช่น "ปริมาณน้ำ ต่อ จำนวนพนักงาน > 25"
      return `${operandText(num)} ต่อ ${operandText(den)} ${c.operator} ${c.value}`;
    }
    return `${operandText(num)} ${c.operator} ${c.value}`;
  }

  // สร้างข้อความเปอร์เซ็นต์ที่ลดได้ เช่น 5%
  // [แก้ไข] เดิมแสดงเป็นช่วง 5–10% (percent_min–percent_max) ตอนนี้ไม่มี percent_max แล้ว จึงแสดงค่าเดียว
  const percentText = (r: RecRow) => {
    if (isFormulaMethod(r.calc_method)) return 'ตามสูตร';
    const p = r.percent_min ?? r.carbon_reduction_amount;
    return p === null ? '-' : `${p}%`;
  };

  // ================= หัวข้อข้อมูลสำนักงาน =================
  // เปิด popup หัวข้อ: ไม่ส่ง row = เพิ่ม / ส่ง row = แก้ไข
  function openInfoModal(row?: InfoType) {
    setEditInfoId(row?.info_id ?? null);
    setInfoForm({
      info_group: row?.info_group ?? '', // หัวข้อเดิมที่ยังไม่มีหมวด = ว่าง ต้องเลือกก่อนบันทึก
      info_name: row?.info_name ?? '',
      unit: row?.unit ?? '',
      info_detail: row?.info_detail ?? '',
    });
    setInputType(row ? kindOfInfo(row) : 'number');
    setHasQuantity(!!row?.has_quantity);
    // หัวข้อแบบตัวเลือกที่ยังไม่มีตัวเลือก (เพิ่มใหม่) เริ่มด้วยช่องว่าง 2 ช่อง
    const opts = optionsOf(row).map((o) => ({ option_id: o.option_id, label: o.label }));
    setOptRows(opts.length > 0 ? opts : [{ option_id: '', label: '' }, { option_id: '', label: '' }]);
    setInfoErrors({});
    setShowInfoModal(true);
  }

  // id ของตัวเลือกที่เงื่อนไขของแนวทางใดแนวทางหนึ่งใช้อยู่
  const usedOptionIds = () =>
    new Set(
      recs.flatMap((r) =>
        (r.recommendation_condition ?? []).flatMap((c) => (c.recommendation_condition_option ?? []).map((o) => o.option_id))
      )
    );

  // ตรวจรายการตัวเลือก คืน error (ข้อความเดียว) หรือรายการชื่อที่ normalize แล้ว
  function validateOptions(): { error: string } | { keep: OptionForm[] } {
    const filled = optRows.filter((o) => o.option_id || o.label.trim() !== ''); // ช่องใหม่ที่ว่างทั้งช่อง = ไม่นับ
    if (filled.length < 2) return { error: 'หัวข้อแบบตัวเลือกต้องมีตัวเลือกอย่างน้อย 2 ตัว' };
    const labels: string[] = [];
    for (let i = 0; i < filled.length; i++) {
      const v = validateForm({ label: filled[i].label }, optionSchema);
      if (!v.ok) return { error: `ตัวเลือกที่ ${i + 1}: ${v.errors.label}` };
      labels.push(v.clean.label);
    }
    const keys = labels.map((l) => normalizeForCompare(l));
    const dup = keys.findIndex((k, i) => keys.indexOf(k) !== i);
    if (dup !== -1) return { error: `ตัวเลือก "${labels[dup]}" ซ้ำกัน` };
    return { keep: filled.map((o, i) => ({ option_id: o.option_id, label: labels[i] })) };
  }

  /* บันทึกตัวเลือกของหัวข้อให้ตรงกับฟอร์ม: ลบตัวที่เอาออก -> แก้ชื่อ/ลำดับตัวเดิม -> เพิ่มตัวใหม่
   * keep = ตัวเลือกที่ต้องมีหลังบันทึก (ลำดับในอาร์เรย์ = sort_order) ส่ง [] = ลบทั้งหมด (เปลี่ยนชนิดเป็นแบบอื่น)
   * คืนรายการตัวเลือกล่าสุดจากฐานข้อมูล หรือ null ถ้าผิดพลาด (แจ้ง error แล้ว) */
  async function syncOptions(infoId: string, old: InfoOption[], keep: OptionForm[]): Promise<InfoOption[] | null> {
    const keepIds = new Set(keep.filter((o) => o.option_id).map((o) => o.option_id));
    const removeIds = old.filter((o) => !keepIds.has(o.option_id)).map((o) => o.option_id);
    if (removeIds.length > 0) {
      const { error } = await supabase.from('office_info_option').delete().in('option_id', removeIds);
      if (error) { showError('ลบตัวเลือกไม่สำเร็จ: ' + dbErrorMessage(error)); return null; }
    }
    for (let i = 0; i < keep.length; i++) {
      const o = keep[i];
      const before = old.find((x) => x.option_id === o.option_id);
      if (o.option_id && before && (before.label !== o.label || before.sort_order !== i)) {
        const { error } = await supabase
          .from('office_info_option')
          .update({ label: o.label, sort_order: i, updated_at: new Date().toISOString() })
          .eq('option_id', o.option_id);
        if (error) { showError('แก้ไขตัวเลือกไม่สำเร็จ: ' + dbErrorMessage(error)); return null; }
      }
    }
    const added = keep
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => !o.option_id)
      .map(({ o, i }) => ({ info_id: infoId, label: o.label, sort_order: i }));
    if (added.length > 0) {
      const { error } = await supabase.from('office_info_option').insert(added);
      if (error) { showError('เพิ่มตัวเลือกไม่สำเร็จ: ' + dbErrorMessage(error)); return null; }
    }
    const { data, error } = await supabase
      .from('office_info_option')
      .select('*')
      .eq('info_id', infoId)
      .order('sort_order');
    if (error) { showError('โหลดตัวเลือกไม่สำเร็จ: ' + dbErrorMessage(error)); return null; }
    return (data ?? []) as InfoOption[];
  }

  // ตรวจและบันทึกหัวข้อข้อมูลสำนักงาน ทั้งเพิ่มใหม่และแก้ไข
  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();

    // ใช้ schema กลาง + ห้ามชื่อหัวข้อซ้ำ (ไม่นับหัวข้อที่กำลังแก้ไข)
    const others = infoTypes.filter((i) => i.info_id !== editInfoId).map((i) => i.info_name);
    const result = validateForm(
      infoForm,
      extendSchema(infoSchema, { info_name: [notDuplicate('ชื่อหัวข้อ', others)] })
    );
    const errs: formError<InfoField | 'options' | 'input_type'> = result.ok ? {} : { ...result.errors };

    // ---- ตัวเลือก (เฉพาะชนิด choice) ----
    const old = editInfoId ? infoTypes.find((i) => i.info_id === editInfoId) : undefined;
    const oldOptions = optionsOf(old);
    let keep: OptionForm[] = [];
    if (inputType === 'choice') {
      const v = validateOptions();
      if ('error' in v) errs.options = v.error;
      else keep = v.keep;
    }
    // ตัวเลือกที่จะถูกลบ (เอาออกจากรายการ หรือเปลี่ยนชนิดเป็นแบบอื่น) ห้ามเป็นตัวที่เงื่อนไขใช้อยู่
    if (!errs.options) {
      const keepIds = new Set(keep.map((o) => o.option_id));
      const used = usedOptionIds();
      const blocked = oldOptions.filter((o) => !keepIds.has(o.option_id) && used.has(o.option_id));
      if (blocked.length > 0) {
        errs.options = `ตัวเลือก ${blocked.map((o) => `"${o.label}"`).join(', ')} ถูกใช้ในเงื่อนไขของแนวทาง ลบไม่ได้ (แก้หรือลบเงื่อนไขนั้นก่อน)`;
      }
    }
    // หัวข้อที่เงื่อนไขใช้อยู่ เปลี่ยนชนิดข้าม "ตัวเลข <-> ตัวเลือก" ไม่ได้ (เงื่อนไขเดิมจะใช้ไม่ได้)
    if (old) {
      const wasChoice = kindOfInfo(old) === 'choice';
      // แนวทางที่มีเงื่อนไขอ้างถึงหัวข้อนี้ (บอกชื่อใน error ให้แอดมินไปแก้ได้ถูกที่)
      const usingRecs = recs
        .filter((r) =>
          (r.recommendation_condition ?? []).some((c) => c.info_id === old.info_id || c.den_info_id === old.info_id)
        )
        .map((r) => `"${r.recommendation ?? '-'}"`);
      const usedInCond = usingRecs.length > 0;
      const where = `ใช้อยู่ในเงื่อนไขของแนวทาง ${usingRecs.join(', ')}`;
      if (usedInCond && wasChoice !== (inputType === 'choice')) {
        errs.input_type = `หัวข้อนี้${where} จึงเปลี่ยนเป็น/จากแบบตัวเลือกไม่ได้ ให้ลบเงื่อนไขนั้นในแนวทางก่อน แล้วค่อยเปลี่ยนชนิด`;
      } else if (usedInCond && inputType === 'text') {
        errs.input_type = `หัวข้อนี้${where} จึงเปลี่ยนเป็นข้อความไม่ได้ (ข้อความใช้ในเงื่อนไขไม่ได้) ให้ลบเงื่อนไขนั้นในแนวทางก่อน`;
      }
    }

    // ตัวเลือกที่กรอกจำนวน ต้องมีหน่วยของจำนวน (เช่น ดวง, เครื่อง)
    const withQty = inputType === 'choice' && hasQuantity;
    if (withQty && !result.clean.unit && !errs.unit) {
      errs.unit = 'กรุณาระบุหน่วยของจำนวน เช่น ดวง, เครื่อง';
    }

    setInfoErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const { info_group, info_name, unit, info_detail } = result.clean;
    // ข้อความ / ตัวเลือกแบบเลือกค่าเดียว ไม่มีหน่วย
    const hasUnit = inputType === 'number' || inputType === 'percent' || withQty;
    const values = {
      info_group,
      info_name,
      unit: hasUnit ? unit || null : null,
      info_detail: info_detail || null,
      input_type: inputType,
      has_quantity: withQty,
    };

    let saved: InfoType;
    if (editInfoId && old) {
      // ⚠️ เปลี่ยนหน่วย/ชนิดของหัวข้อที่บริษัทกรอกไว้แล้ว ค่าเดิมของบริษัทจะถูกตีความแบบใหม่
      const typeChanged = kindOfInfo(old) !== inputType || !!old.has_quantity !== withQty;
      const unitChanged = (old.unit ?? '') !== (values.unit ?? '');
      if ((typeChanged || unitChanged) &&
          !(await showConfirm(
            typeChanged
              ? 'เปลี่ยนชนิดของหัวข้อนี้? ค่าที่บริษัทเคยกรอกไว้อาจใช้ไม่ได้ (บริษัทต้องกรอกใหม่)'
              : 'เปลี่ยนหน่วยของหัวข้อนี้? ค่าที่บริษัทเคยกรอกไว้จะถูกตีความด้วยหน่วยใหม่',
            { confirmText: 'บันทึก' }
          ))) {
        return;
      }
      const updated = await updateRecord<InfoType>(
        'office_info_type', 'info_id', editInfoId,
        { ...values, updated_at: new Date().toISOString() }, '*', 'แก้ไขหัวข้อข้อมูลสำนักงาน'
      );
      if (!updated) return;
      saved = updated;
    } else {
      const created = await insertRecord<InfoType>(
        'office_info_type', values, '*', 'เพิ่มหัวข้อข้อมูลสำนักงาน'
      );
      if (!created) return;
      saved = created;
    }

    // บันทึกตัวเลือก (ไม่ใช่แบบตัวเลือก = keep ว่าง -> ลบตัวเลือกเก่าทิ้ง ถ้ามี)
    let options: InfoOption[] = [];
    if (inputType === 'choice' || oldOptions.length > 0) {
      const synced = await syncOptions(saved.info_id, oldOptions, keep);
      // ผิดพลาด: หัวข้อบันทึกแล้ว แต่ตัวเลือกไม่ครบ -> อัปเดตหน้าจอตามที่มี ให้แอดมินแก้ซ้ำ
      options = synced ?? oldOptions;
      if (!synced) {
        setInfoTypes((prev) =>
          old ? prev.map((i) => (i.info_id === saved.info_id ? { ...saved, office_info_option: options } : i))
              : [...prev, { ...saved, office_info_option: options }]
        );
        setEditInfoId(saved.info_id); // หน้าต่างยังเปิดอยู่ กดบันทึกซ้ำ = แก้ไขหัวข้อนี้ (ไม่สร้างซ้ำ)
        // ฟอร์ม = ตัวเลือกที่อยู่ในฐานข้อมูลแล้ว + ตัวใหม่ที่ยังไม่ได้บันทึก (กันเพิ่มซ้ำตอนกดบันทึกอีกครั้ง)
        const inDb = new Set(options.map((o) => normalizeForCompare(o.label)));
        setOptRows([
          ...options.map((o) => ({ option_id: o.option_id, label: o.label })),
          ...keep.filter((o) => !o.option_id && !inDb.has(normalizeForCompare(o.label))),
        ]);
        return;
      }
    }
    const withOptions = { ...saved, office_info_option: options };
    setInfoTypes((prev) =>
      old ? prev.map((i) => (i.info_id === saved.info_id ? withOptions : i)) : [...prev, withOptions]
    );

    setShowInfoModal(false);
    setInfoForm({ info_group: '', info_name: '', unit: '', info_detail: '' });
    showSaved(); // popup แจ้งบันทึกสำเร็จ (เหมือนฝั่งองค์กร)
  }

  // ลบหัวข้อข้อมูลสำนักงาน ถ้ามีแนวทางใช้อยู่จะถามยืนยันก่อน
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
        ? withOrgImpact('หัวข้อนี้ถูกใช้ในเงื่อนไขของบางแนวทาง ถ้าลบ เงื่อนไขเหล่านั้นจะถูกลบตามด้วย ต้องการลบ?')
        : withOrgImpact('ลบหัวข้อนี้? (ถ้ามีบริษัทกรอกข้อมูลหัวข้อนี้ไว้แล้ว จะลบไม่ได้)')
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
  // รับ row ได้ เพื่อเปิดในโหมดแก้ไข (เติมค่าเดิม + เงื่อนไขเดิม)
  function openRecModal(row?: RecRow) {
    setEditRecId(row?.rec_id ?? null);
    setRecForm(
      row
        ? {
            recommendation: row.recommendation ?? '',
            percent_min: row.percent_min == null ? '' : String(row.percent_min),
            // [ลบ] percent_max ไม่มีช่องสูงสุดแล้ว
            scopedetail_id: baseKeyOf(row), // ฐานของ % เป็น key: detail: / activity: / scope:
          }
        : emptyRec
    );
    setConds((row?.recommendation_condition ?? []).map(rowToCond));
    setCalcMethod(isFormulaMethod(row?.calc_method) ? (row?.calc_method as CalcMethod) : 'percent');
    setRecErrors({});
    setShowRecModal(true);
  }

  // ตรวจ 1 ค่าในเงื่อนไข คืนข้อความ error หรือ null
  // เพิ่มการตรวจว่ากิจกรรม/หัวข้อที่เลือก "ยังมีอยู่จริง" (อาจถูกลบไปแล้วตอนแก้ไขแนวทางเก่า)
  function operandError(o: OperandForm): string | null {
    if (o.source_type === 'activity') {
      if (!o.scopedetail_id) return 'กรุณาเลือกกิจกรรม';
      if (!activityOptions.some((a) => a.scopedetail_id === o.scopedetail_id)) return 'กิจกรรมที่เลือกไม่มีอยู่ในระบบแล้ว';
    }
    if (o.source_type === 'office_info') {
      if (!o.info_id) return 'กรุณาเลือกข้อมูลสำนักงาน';
      const t = infoTypes.find((i) => i.info_id === o.info_id);
      if (!t) return 'หัวข้อที่เลือกไม่มีอยู่ในระบบแล้ว';
      if (kindOfInfo(t) === 'text') return `หัวข้อ "${t.info_name}" เป็นข้อความ ใช้เป็นเงื่อนไขไม่ได้`;
    }
    return null;
  }

  // เงื่อนไขนี้เป็นแบบตัวเลือกไหม (ค่า A = หัวข้อข้อมูลสำนักงานแบบตัวเลือก)
  const isChoiceCond = (c: CondForm) => c.num.source_type === 'office_info' && !!choiceInfo(c.num.info_id);
  // ตัวดำเนินการที่ใช้จริง: แบบตัวเลือกใช้ได้แค่ in / not_in, แบบตัวเลขใช้ได้แค่ > >= < <= =
  const effectiveOp = (c: CondForm): Operator =>
    isChoiceCond(c) ? (isChoiceOp(c.operator) ? c.operator : 'in') : isChoiceOp(c.operator) ? '>' : c.operator;

  // หัวข้อแบบตัวเลข/เปอร์เซ็นต์ (ใช้หาร/เทียบตัวเลขได้)
  const isNumericInfo = (infoId: string) => {
    const t = infoTypes.find((i) => i.info_id === infoId);
    return !!t && (kindOfInfo(t) === 'number' || kindOfInfo(t) === 'percent');
  };

  // ตรวจข้อมูลแนวทางและเงื่อนไขทั้งหมด แล้วคืน error กับค่าที่พร้อมบันทึก
  function validateRec() {
    // ---- ช่องหลักของแนวทาง: ใช้ schema กลาง + ห้ามชื่อซ้ำ + กิจกรรมที่ผูกต้องมีอยู่จริง ----
    const others = recs.filter((r) => r.rec_id !== editRecId).map((r) => r.recommendation);
    const result = validateForm(
      recForm,
      extendSchema(recSchema, {
        recommendation: [notDuplicate('ชื่อแนวทาง', others)],
        scopedetail_id: [existsIn('กิจกรรมที่เกี่ยวข้อง', baseOptions(false).map((o) => o.value))],
      })
    );
    const errs: formError<RecField | 'conds' | 'hours'> = result.ok ? {} : { ...result.errors };

    // % ไม่บังคับ: ว่าง = null (รายงานแสดงค่าที่พบจากเงื่อนไข แต่ไม่คำนวณ tCO2e ที่ลดได้)
    //   แนวทางแบบสูตร ไม่ใช้ % (คำนวณจากจำนวนอุปกรณ์)
    const formula = isFormulaMethod(calcMethod);
    const min = formula || result.clean.percent_min === '' ? null : normalizeToArabicNumber(result.clean.percent_min);
    if (formula) {
      delete errs.percent_min;
      // สูตรต้องมี: กิจกรรมไฟฟ้า (ค่า EF), หัวข้อชั่วโมงใช้งานต่อวัน, เงื่อนไขตัวเลือกที่กรอกจำนวน (จำนวนอุปกรณ์)
      if (!result.clean.scopedetail_id.startsWith('detail:') && !errs.scopedetail_id) {
        errs.scopedetail_id = 'แนวทางแบบสูตรต้องผูกรายการย่อยของกิจกรรมไฟฟ้า (ใช้ค่า EF ต่อหน่วยในการคำนวณ)';
      }
      // ชั่วโมงทำงานต่อวัน / จำนวนวันทำงาน ค้นจากชื่อหัวข้อ (lib/measureFormulas.ts) ต้องมีและเป็นแบบตัวเลข
      // สูตรแอร์ใช้ขนาดแอร์ (BTU) เพิ่ม
      for (const name of calcMethod === 'ac_inverter' ? [HOURS_INFO_NAME, DAYS_INFO_NAME, AC_BTU_INFO_NAME] : [HOURS_INFO_NAME, DAYS_INFO_NAME]) {
        const id = findInfoIdByName(infoTypes, name);
        if (!id) { errs.hours = `ไม่พบหัวข้อข้อมูลสำนักงานชื่อ "${name}" กรุณาเพิ่มหัวข้อนี้ (แบบตัวเลข) ก่อนใช้สูตร`; break; }
        if (!isNumericInfo(id)) { errs.hours = `หัวข้อ "${name}" ต้องเป็นแบบตัวเลข`; break; }
      }
    }
    // [ลบ] ตรวจ "ค่าสูงสุดต้องไม่น้อยกว่าค่าต่ำสุด" เพราะไม่มี percent_max แล้ว

    // ---- เงื่อนไข: หยุดที่ข้อแรกที่ผิด ----
    const condValues: (number | null)[] = []; // ค่าที่ normalize แล้ว ใช้ตอนบันทึก (null = เงื่อนไขแบบตัวเลือก)
    for (let i = 0; i < conds.length; i++) {
      const c = conds[i];
      const label = `เงื่อนไขข้อ ${i + 1}`;

      const e1 = operandError(c.num);
      if (e1) {
        // เลิกใช้คำว่า ตัวตั้ง/ตัวหาร -> ค่า A / ค่า B ให้ตรงกับหน้าจอ
        errs.conds = `${label}: ${e1}${c.mode === 'ratio' ? ' (ค่า A)' : ''}`;
        break;
      }

      // ---- เงื่อนไขแบบตัวเลือก: ต้องติ๊กอย่างน้อย 1 ตัว และตัวที่ติ๊กต้องเป็นตัวเลือกของหัวข้อนี้ ----
      const ci = c.num.source_type === 'office_info' ? choiceInfo(c.num.info_id) : undefined;
      if (ci) {
        const valid = new Set(optionsOf(ci).map((o) => o.option_id));
        if (c.option_ids.length === 0) {
          errs.conds = `${label}: กรุณาเลือกตัวเลือกอย่างน้อย 1 ตัว`;
          break;
        }
        if (c.option_ids.some((id) => !valid.has(id))) {
          errs.conds = `${label}: ตัวเลือกที่เลือกบางตัวไม่มีอยู่ในระบบแล้ว กรุณาเลือกใหม่`;
          break;
        }
        condValues.push(null);
        continue;
      }

      if (c.mode === 'ratio') {
        const e2 = operandError(c.den);
        if (e2) {
          errs.conds = `${label}: ${e2} (ค่า B)`;
          break;
        }
        // ค่า B ต้องเป็นตัวเลข (หัวข้อข้อความ/ตัวเลือก หารไม่ได้)
        if (c.den.source_type === 'office_info' && !isNumericInfo(c.den.info_id)) {
          errs.conds = `${label}: ค่า B ต้องเป็นหัวข้อแบบตัวเลขหรือเปอร์เซ็นต์`;
          break;
        }
        // A ÷ A = 1 เสมอ ไม่มีความหมาย
        if (JSON.stringify(c.num) === JSON.stringify(c.den)) {
          errs.conds = `${label}: ค่า A และค่า B ต้องไม่ใช่ค่าเดียวกัน`;
          break;
        }
      }

      // ค่าที่เทียบใช้ schema กลาง: ไม่ติดลบ ทศนิยมไม่เกิน 4 หลัก รับเลขไทย/comma ได้
      const v = validateForm({ value: c.value }, condValueSchema);
      if (!v.ok) {
        errs.conds = `${label}: ${v.errors.value}`;
        break;
      }
      condValues.push(normalizeToArabicNumber(v.clean.value) ?? 0);
    }

    // เงื่อนไขซ้ำกันทุกส่วน (ค่า/ตัวดำเนินการ/ตัวเลขเหมือนกัน) ไม่มีประโยชน์
    if (!errs.conds) {
      const keys = conds.map((c, i) =>
        condValues[i] === null
          ? JSON.stringify([c.num, effectiveOp(c), c.option_ids.slice().sort()]) // แบบตัวเลือก
          : JSON.stringify([c.mode, c.num, c.mode === 'ratio' ? c.den : null, c.operator, condValues[i]])
      );
      const dup = keys.findIndex((k, i) => keys.indexOf(k) !== i);
      if (dup !== -1) errs.conds = `เงื่อนไขข้อ ${dup + 1} ซ้ำกับข้อก่อนหน้า`;
    }

    // สูตรนับจำนวนอุปกรณ์จากเงื่อนไข "เป็นหนึ่งใน" ของหัวข้อที่กรอกจำนวน (เช่น ชนิดหลอดไฟ เป็นหนึ่งใน [Fluorescent])
    if (formula && !errs.conds) {
      const hasQtyCond = conds.some(
        (c) => effectiveOp(c) === 'in' && !!choiceInfo(c.num.info_id)?.has_quantity && c.option_ids.length > 0
      );
      if (!hasQtyCond) {
        errs.conds = 'แนวทางแบบสูตรต้องมีเงื่อนไข "เป็นหนึ่งใน" ของหัวข้อที่กรอกจำนวน (ใช้เป็นจำนวนอุปกรณ์เดิม เช่น จำนวนหลอด Fluorescent)';
      }
    }

    return { errs, name: result.clean.recommendation, scopedetailId: result.clean.scopedetail_id, min, condValues };
  }

  // แปลงค่า 1 ค่าเป็นคอลัมน์ในตาราง
  const numCols = (o: OperandForm) => ({
    source_type: o.source_type,
    scopedetail_id: o.source_type === 'activity' ? o.scopedetail_id : null,
    info_id: o.source_type === 'office_info' ? o.info_id : null,
    metric: o.source_type === 'activity' ? o.metric : null,
  });
  // แปลงค่า B ของเงื่อนไขแบบเทียบ 2 ค่าให้ตรงกับคอลัมน์ในตาราง
  const denCols = (o: OperandForm | null) => ({
    den_source_type: o ? o.source_type : null,
    den_scopedetail_id: o && o.source_type === 'activity' ? o.scopedetail_id : null,
    den_info_id: o && o.source_type === 'office_info' ? o.info_id : null,
    den_metric: o && o.source_type === 'activity' ? o.metric : null,
  });

  // บันทึกแนวทางและเงื่อนไข ทั้งเพิ่มใหม่และแก้ไข
  async function handleSaveRec(e: React.FormEvent) {
    e.preventDefault();

    const { errs, name, scopedetailId, min, condValues } = validateRec();
    setRecErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // [ย้ายมา] เดิมถามตอนกด "เผยแพร่" ตอนนี้บันทึกแล้วแนะนำทันที จึงถามตอนบันทึกแทน
    if (conds.length === 0 &&
        !(await showConfirm('แนวทางนี้ไม่มีเงื่อนไข จะถูกแนะนำให้ทุกองค์กร ต้องการบันทึกหรือไม่?', { confirmText: 'บันทึก' }))) {
      return;
    }

    setSaving(true);

    // [แก้ไข] เดิม carbon_reduction_amount = ค่ากลางของช่วง (min+max)/2 และบันทึก percent_max ด้วย
    //   ตอนนี้มี % เดียว จึงบันทึก carbon_reduction_amount = percent_min และไม่ส่ง percent_max (จะลบคอลัมน์ใน DB)
    const recValues = {
      recommendation: name, // ค่าที่ normalize แล้ว
      carbon_reduction_amount: min,
      percent_min: min,
      // ฐานของ %: รายการย่อย / ทั้งกิจกรรม / ทั้ง Scope (เลือกได้ระดับเดียว)
      ...baseCols(scopedetailId, editRecId ? recs.find((r) => r.rec_id === editRecId) : undefined),
      calc_method: calcMethod,
    };
    // แถวเงื่อนไขที่จะบันทึก (ค่าที่เทียบใช้ค่าที่ normalize แล้วจาก validateRec)
    //   แบบตัวเลือก: value = null และไม่มีค่า B (ตรงกับ check ในฐานข้อมูล)
    const condRows = (recId: string) =>
      conds.map((c, i) => ({
        rec_id: recId,
        ...numCols(c.num),
        ...denCols(c.mode === 'ratio' && condValues[i] !== null ? c.den : null),
        operator: effectiveOp(c),
        value: condValues[i], // เดิม Number(cleanNumber(c.value)) ซ้ำงานกับตอนตรวจ
      }));

    /* เพิ่มเงื่อนไขของแนวทาง + ตัวเลือกของเงื่อนไขแบบตัวเลือก (ตาราง recommendation_condition_option)
     * ตัวเลือกบันทึกไม่สำเร็จ -> ลบเงื่อนไขที่เพิ่งเพิ่มทิ้ง (ไม่ให้เหลือเงื่อนไขตัวเลือกที่ไม่มีตัวเลือก)
     * คืนเงื่อนไขที่บันทึกแล้ว หรือ null ถ้าผิดพลาด (แจ้ง error แล้ว) */
    async function insertConds(recId: string): Promise<CondRow[] | null> {
      if (conds.length === 0) return [];
      const { data, error } = await supabase
        .from('recommendation_condition')
        .insert(condRows(recId))
        .select('*');
      if (error) {
        showError('บันทึกเงื่อนไขไม่สำเร็จ: ' + dbErrorMessage(error));
        return null;
      }
      const rows = (data ?? []) as CondRow[];
      // แถวที่ได้กลับมาเรียงตามลำดับที่ส่งไป -> จับคู่กับ conds ด้วย index
      const optionRows = rows.flatMap((row, i) =>
        condValues[i] === null ? conds[i].option_ids.map((option_id) => ({ condition_id: row.condition_id, option_id })) : []
      );
      if (optionRows.length > 0) {
        const { error: optError } = await supabase.from('recommendation_condition_option').insert(optionRows);
        if (optError) {
          await supabase.from('recommendation_condition').delete().in('condition_id', rows.map((r) => r.condition_id));
          showError('บันทึกตัวเลือกของเงื่อนไขไม่สำเร็จ: ' + dbErrorMessage(optError));
          return null;
        }
      }
      return rows.map((row, i) => ({
        ...row,
        recommendation_condition_option: condValues[i] === null ? conds[i].option_ids.map((option_id) => ({ option_id })) : [],
      }));
    }

    // ===== โหมดแก้ไข =====
    if (editRecId) {
      const old = recs.find((r) => r.rec_id === editRecId);
      // 1) แก้แนวทาง (ไม่มี status แล้ว: บันทึก = ใช้งานทันที)
      const updated = await updateRecord<RecRow>(
        'carbon_reduction_recommendation', 'rec_id', editRecId, recValues, '*', 'แก้ไขแนวทาง'
      );
      if (!updated) {
        setSaving(false);
        return;
      }
      // 2) เพิ่มเงื่อนไขชุดใหม่ "ก่อน" แล้วค่อยลบชุดเดิม ถ้าเพิ่มล้มเหลว เงื่อนไขเดิมยังอยู่ครบ
      const savedConds = await insertConds(editRecId);
      if (!savedConds) {
        setSaving(false);
        return;
      }
      const oldIds = (old?.recommendation_condition ?? []).map((c) => c.condition_id);
      if (oldIds.length > 0) {
        const { error } = await supabase.from('recommendation_condition').delete().in('condition_id', oldIds);
        if (error) {
          setSaving(false);
          return showError('ลบเงื่อนไขเดิมไม่สำเร็จ: ' + dbErrorMessage(error));
        }
      }
      setRecs((prev) =>
        prev.map((r) => (r.rec_id === editRecId ? { ...updated, recommendation_condition: savedConds } : r))
      );
      setSaving(false);
      setShowRecModal(false);
      showSaved();
      return;
    }

    // ===== โหมดเพิ่มใหม่ =====
    // 1) บันทึกแนวทาง บันทึกแล้วพร้อมแนะนำทันที (คอลัมน์ status ถูกลบแล้ว)
    const created = await insertRecord<RecRow>(
      'carbon_reduction_recommendation',
      recValues,
      '*',
      'เพิ่มแนวทาง'
    );
    if (!created) {
      setSaving(false);
      return;
    }

    // 2) บันทึกเงื่อนไข (ถ้าล้มเหลวต้องลบแนวทางทิ้ง ไม่ให้เหลือแนวทางที่ไม่มีเงื่อนไข)
    const savedConds = await insertConds(created.rec_id);
    if (!savedConds) {
      await supabase
        .from('carbon_reduction_recommendation')
        .delete()
        .eq('rec_id', created.rec_id);
      setSaving(false);
      return;
    }

    setRecs((prev) => [...prev, { ...created, recommendation_condition: savedConds }]);
    setSaving(false);
    setShowRecModal(false);
    showSaved();
  }

  // ลบแนวทาง เงื่อนไขของแนวทางจะถูกลบตามอัตโนมัติ
  async function handleDeleteRec(id: string) {
    // เงื่อนไขของแนวทางนี้ถูกลบตามอัตโนมัติ
    const ok = await deleteRecord(
      'carbon_reduction_recommendation',
      'rec_id',
      id,
      withOrgImpact('ลบแนวทางนี้พร้อมเงื่อนไขทั้งหมด?')
    );
    if (!ok) return;
    setRecs((prev) => prev.filter((r) => r.rec_id !== id));
  }

  /* [ปิดใช้งาน] toggleStatus (สลับ ร่าง/เผยแพร่) ไม่ใช้แล้ว
   * กด "บันทึก" = เก็บลง DB และพร้อมแนะนำในรายงานทันที จึงไม่มีสถานะให้สลับ */

  // แก้ค่าในแถวเงื่อนไขใน popup
  const setCond = (i: number, patch: Partial<CondForm>) =>
    setConds((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  // ข้อความ "หน่วยของค่าที่เทียบ" ของเงื่อนไข 1 ข้อใน popup
  // เดิม "kWh ÷ คน" -> "kWh ต่อ คน"
  const unitHint = (c: CondForm) =>
    c.mode === 'ratio' ? `${operandUnit(c.num)} ต่อ ${operandUnit(c.den)}` : operandUnit(c.num);

  const sortedRecs = recs
    .slice()
    .sort((a, b) => (a.recommendation ?? '').localeCompare(b.recommendation ?? '', 'th'));

  return (
    <div className={T.page}>
      <h1 className={T.h1}>
        ข้อมูลสำนักงานและแนวทางลดคาร์บอน
      </h1>

      {/* ============ ส่วนที่ 1: หัวข้อข้อมูลสำนักงาน ============ */}
      <section className={T.card}>
        <div className={T.cardHead}>
          <h2 className={T.h2}>
            หัวข้อข้อมูลสำนักงาน (ช่องที่บริษัทต้องกรอก)
          </h2>
          <button
            onClick={() => openInfoModal()}
            className={T.addBtn}
          >
            + เพิ่มหัวข้อ
          </button>
        </div>

        <div className={T.wrap}>
          <table className={T.table}>
            <thead className={T.thead}>
              <tr className={T.headRow}>
                <th className={`${T.th} text-left`}>หมวด</th>
                <th className={`${T.th} text-left`}>ชื่อหัวข้อ</th>
                <th className={`${T.th} text-left`}>ชนิด / หน่วย / ตัวเลือก</th>
                <th className={`${T.th} text-left`}>คำอธิบาย</th>
                <th className={`${T.th} text-right`}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {infoTypes.length === 0 && (
                <tr>
                  <td colSpan={5} className={T.empty}>
                    ยังไม่มีหัวข้อ
                  </td>
                </tr>
              )}
              {/* เรียงตามหมวด (ลำดับเดียวกับหน้าขององค์กร) หัวข้อที่ยังไม่มีหมวดอยู่ท้ายสุด */}
              {groupByInfoGroup(infoTypes).flatMap((g) => g.items).map((i) => (
                <tr key={i.info_id} className={T.row}>
                  <td className={T.td}>
                    {i.info_group ?? <span className="text-[#F97316]">ยังไม่ระบุหมวด</span>}
                  </td>
                  <td className={T.tdMain}>{i.info_name}</td>
                  <td className={T.td}>
                    {kindOfInfo(i) === 'choice' && (
                      <>
                        ตัวเลือก{i.has_quantity ? ` (กรอกจำนวน${i.unit ? `, ${i.unit}` : ''})` : ''}:{' '}
                        {optionsOf(i).map((o) => o.label).join(', ') || '-'}
                      </>
                    )}
                    {kindOfInfo(i) === 'text' && 'ข้อความ'}
                    {kindOfInfo(i) === 'percent' && `เปอร์เซ็นต์${i.unit ? ` (${i.unit})` : ''}`}
                    {kindOfInfo(i) === 'number' && `ตัวเลข${i.unit ? ` (${i.unit})` : ''}`}
                  </td>
                  <td className={`${T.td} whitespace-pre-line`}>{i.info_detail ?? '-'}</td>
                  <td className={T.tdActions}>
                    <RowActions onEdit={() => openInfoModal(i)} onDelete={() => handleDeleteInfo(i.info_id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============ ส่วนที่ 2: แนวทางลดคาร์บอน ============ */}
      <section className={T.card}>
        <div className={T.cardHead}>
          <h2 className={T.h2}>แนวทางลดคาร์บอน</h2>
          <button
            onClick={() => openRecModal()}
            className={T.addBtn}
          >
            + เพิ่มแนวทาง
          </button>
        </div>

        <div className={T.wrap}>
          <table className={T.table}>
            <thead className={T.thead}>
              <tr className={T.headRow}>
                <th className={`${T.th} text-left`}>แนวทาง</th>
                <th className={`${T.th} text-left`}>กิจกรรมที่ผูก</th>
                <th className={`${T.th} text-right`}>ลดได้</th>
                <th className={`${T.th} text-left`}>เงื่อนไข (ต้องผ่านทุกข้อ)</th>
                <th className={`${T.th} text-right`}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecs.length === 0 && (
                <tr>
                  <td colSpan={5} className={T.empty}>
                    ยังไม่มีแนวทาง
                  </td>
                </tr>
              )}
              {sortedRecs.map((r) => {
                const rc = r.recommendation_condition ?? [];
                return (
                  <tr key={r.rec_id} className={`${T.row} align-top`}>
                    <td className={T.tdMain}>{r.recommendation}</td>
                    <td className={T.td}>
                      {baseKeyOf(r) ? baseLabel(baseKeyOf(r)) : 'ไม่ผูก (แนะนำทั่วไป)'}
                    </td>
                    <td className={`${T.td} text-right font-semibold text-[#047857]`}>
                      {percentText(r)}
                    </td>
                    <td className={`${T.td} text-xs`}>
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
                    {/* [ลบ] คอลัมน์สถานะ (ร่าง/เผยแพร่แล้ว) บันทึกแล้วใช้งานทันที */}
                    <td className={T.tdActions}>
                      <RowActions onEdit={() => openRecModal(r)} onDelete={() => handleDeleteRec(r.rec_id)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============ Popup: เพิ่มหัวข้อข้อมูลสำนักงาน ============ */}
      {showInfoModal && (
        <ModalShell
          title={editInfoId ? 'แก้ไขหัวข้อข้อมูลสำนักงาน' : 'เพิ่มหัวข้อข้อมูลสำนักงาน'}
          onClose={() => setShowInfoModal(false)}
        >
          <form onSubmit={handleSaveInfo} noValidate className="space-y-4">
            {/* หมวดของหัวข้อ: หน้าข้อมูลสำนักงานขององค์กรแสดงหัวข้อแยกตามหมวดนี้ */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">หมวด</label>
              <Select
                className={inputClass(!!infoErrors.info_group)}
                value={infoForm.info_group}
                onChange={(v) => setInfoForm({ ...infoForm, info_group: v })}
                options={[
                  { value: '', label: 'เลือกหมวด', placeholder: true },
                  ...INFO_GROUPS.map((g) => ({ value: g, label: g })),
                ]}
              />
              <FieldError message={infoErrors.info_group} />
            </div>
            <div>
              <input
                className={inputClass(!!infoErrors.info_name)}
                placeholder="ชื่อหัวข้อ เช่น จำนวนพนักงาน"
                maxLength={150}
                value={infoForm.info_name}
                onChange={(e) => setInfoForm({ ...infoForm, info_name: e.target.value })}
              />
              <FieldError message={infoErrors.info_name} />
            </div>
            {/* ชนิดของหัวข้อ: กำหนดว่าบริษัทกรอกแบบไหน และใช้ในเงื่อนไขแบบไหน */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">ชนิดข้อมูล</label>
              <Select
                className={inputClass(!!infoErrors.input_type)}
                value={inputType}
                onChange={(v) => {
                  setInputType(v as InputType);
                  setInfoErrors((p) => ({ ...p, input_type: undefined, options: undefined }));
                }}
                options={(Object.keys(INPUT_TYPE_LABEL) as InputType[]).map((k) => ({ value: k, label: INPUT_TYPE_LABEL[k] }))}
              />
              <FieldError message={infoErrors.input_type} />
            </div>

            {/* เดิมหน่วยและคำอธิบายไม่มีการตรวจ/ไม่แสดง error */}
            {(inputType === 'number' || inputType === 'percent') && (
              <div>
                <input
                  className={inputClass(!!infoErrors.unit)}
                  placeholder={inputType === 'percent' ? 'หน่วย เช่น %' : 'หน่วย เช่น คน, kWh/ปี'}
                  maxLength={50}
                  value={infoForm.unit}
                  onChange={(e) => setInfoForm({ ...infoForm, unit: e.target.value })}
                />
                <FieldError message={infoErrors.unit} />
              </div>
            )}

            {/* ตัวเลือกของหัวข้อแบบตัวเลือก (ลำดับในรายการ = ลำดับใน dropdown ของบริษัท) */}
            {inputType === 'choice' && (
              <div className="rounded-xl border border-[#E2E8F0] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#374151]">ตัวเลือก (อย่างน้อย 2 ตัว)</p>
                  <button
                    type="button"
                    onClick={() => setOptRows((p) => [...p, { option_id: '', label: '' }])}
                    className="rounded-md px-2 py-1 text-sm font-semibold text-[#266955] transition hover:bg-[#EAF5EF]"
                  >
                    + เพิ่มตัวเลือก
                  </button>
                </div>
                <div className="space-y-2">
                  {optRows.map((o, idx) => (
                    <div key={o.option_id || `new-${idx}`} className="flex items-center gap-2">
                      <input
                        className={inputClass(false)}
                        placeholder={`ตัวเลือกที่ ${idx + 1} เช่น LED`}
                        maxLength={100}
                        value={o.label}
                        onChange={(e) =>
                          setOptRows((p) => p.map((x, j) => (j === idx ? { ...x, label: e.target.value } : x)))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setOptRows((p) => p.filter((_, j) => j !== idx))}
                        className="whitespace-nowrap text-xs text-[#94A3B8] hover:text-red-500"
                      >
                        ลบ
                      </button>
                    </div>
                  ))}
                </div>
                <FieldError message={infoErrors.options} />

                {/* กรอกจำนวน: บริษัทกรอกจำนวนของทุกตัวเลือก (เช่น LED 30 ดวง, Fluorescent 20 ดวง) แทนการเลือกค่าเดียว */}
                <label className="mt-3 flex items-center gap-2 text-sm text-[#374151]">
                  <input
                    type="checkbox"
                    checked={hasQuantity}
                    onChange={(e) => {
                      setHasQuantity(e.target.checked);
                      setInfoErrors((p) => ({ ...p, unit: undefined }));
                    }}
                  />
                  ให้บริษัทกรอกจำนวนของแต่ละตัวเลือก
                </label>
                {hasQuantity && (
                  <div className="mt-2">
                    <input
                      className={inputClass(!!infoErrors.unit)}
                      placeholder="หน่วยของจำนวน เช่น ดวง, เครื่อง"
                      maxLength={50}
                      value={infoForm.unit}
                      onChange={(e) => setInfoForm({ ...infoForm, unit: e.target.value })}
                    />
                    <FieldError message={infoErrors.unit} />
                  </div>
                )}
              </div>
            )}
            <div>
              <textarea
                className={inputClass(!!infoErrors.info_detail)}
                rows={3}
                maxLength={1000}
                placeholder="คำอธิบายที่จะแสดงให้บริษัทเห็น"
                value={infoForm.info_detail}
                onChange={(e) => setInfoForm({ ...infoForm, info_detail: e.target.value })}
              />
              <FieldError message={infoErrors.info_detail} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="btn btn-outline rounded-lg px-4 py-2 text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="btn btn-primary rounded-lg px-4 py-2 text-sm"
              >
                บันทึก
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* ============ Popup: เพิ่มแนวทางลดคาร์บอน ============ */}
      {showRecModal && (
        <ModalShell
          title={editRecId ? 'แก้ไขแนวทางลดคาร์บอน' : 'เพิ่มแนวทางลดคาร์บอน'}
          onClose={() => setShowRecModal(false)}
          wide
        >
          <form onSubmit={handleSaveRec} noValidate className="space-y-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">ชื่อแนวทาง</label>
              <input
                className={inputClass(!!recErrors.recommendation)}
                placeholder="เช่น เปลี่ยนมาใช้เครื่องปรับอากาศระบบ Inverter"
                maxLength={255}
                value={recForm.recommendation}
                onChange={(e) => setRecForm({ ...recForm, recommendation: e.target.value })}
              />
              <FieldError message={recErrors.recommendation} />
            </div>

            {/* วิธีคำนวณปริมาณที่ลดได้: % แบบเดิม หรือสูตรจากจำนวนอุปกรณ์ (ค่าอ้างอิงอยู่ใน lib/measureFormulas.ts) */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">วิธีคำนวณปริมาณที่ลดได้</label>
              <Select
                className={inputClass(false)}
                value={calcMethod}
                onChange={(v) => setCalcMethod(v as CalcMethod)}
                options={CALC_METHODS.map((m) => ({ value: m.value, label: m.label }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">
                {isFormulaMethod(calcMethod) ? 'กิจกรรมไฟฟ้า (ใช้ค่า EF ในสูตร)' : 'กิจกรรมที่เกี่ยวข้อง (ฐานที่ใช้คำนวณ %)'}
              </label>
              <Select
                className={inputClass(!!recErrors.scopedetail_id)}
                value={recForm.scopedetail_id}
                onChange={(v) => setRecForm({ ...recForm, scopedetail_id: v })}
                options={[
                  { value: '', label: 'ไม่ผูก (แนะนำทั่วไป ไม่คำนวณตัวเลข)' },
                  // ฐานเลือกได้ 3 ระดับ: ทั้ง Scope / ทั้งกิจกรรม / รายการย่อย (แบบสูตรเลือกได้เฉพาะรายการย่อย)
                  ...baseOptions(isFormulaMethod(calcMethod)),
                ]}
              />
              <FieldError message={recErrors.scopedetail_id} />
            </div>

            {isFormulaMethod(calcMethod) ? (
              <div>
                {/* ค่าที่สูตรดึงมาใช้ (แอดมินไม่ต้องกรอก) */}
                <p className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs leading-5 text-[#475569]">
                  สูตรใช้: จำนวนอุปกรณ์เดิมจากเงื่อนไข &quot;เป็นหนึ่งใน&quot; ด้านล่าง ·
                  ชั่วโมงใช้งานจากหัวข้อ &quot;{HOURS_INFO_NAME}&quot; · วันใช้งานจากหัวข้อ &quot;{DAYS_INFO_NAME}&quot;
                  (รายการรายเดือน ÷ 12) ·
                  {calcMethod === 'ac_inverter' && <> ขนาดแอร์จากหัวข้อ &quot;{AC_BTU_INFO_NAME}&quot; (เลือกค่า SEER ตามขนาด) ·</>}
                  ค่า EF จากกิจกรรมไฟฟ้าที่เลือก
                </p>
                <FieldError message={recErrors.hours} />
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#374151]">
                  ลดได้ (%) ไม่บังคับ
                </label>
                <input
                  className={inputClass(!!recErrors.percent_min)}
                  inputMode="decimal"
                  placeholder="เช่น 5 (ไม่กรอก = แนะนำโดยไม่คำนวณปริมาณที่ลดได้)"
                  value={recForm.percent_min}
                  onChange={(e) => setRecForm({ ...recForm, percent_min: e.target.value })}
                />
                <FieldError message={recErrors.percent_min} />
              </div>
              {/* [ลบ] ช่อง "ลดได้สูงสุด (%)" (percent_max) ไม่เก็บแล้ว */}
            </div>
            )}

            {/* เงื่อนไขการแนะนำ */}
            <div className="rounded-xl border border-[#E2E8F0] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0F172A]">
                  เงื่อนไขการแนะนำ (ต้องผ่านทุกข้อ)
                </p>
                <button
                  type="button"
                  onClick={() => setConds((prev) => [...prev, newCond()])}
                  className="rounded-md px-2 py-1 text-sm font-semibold text-[#266955] transition hover:bg-[#EAF5EF]"
                >
                  + เพิ่มเงื่อนไข
                </button>
              </div>

              {conds.length === 0 && (
                <p className="py-2 text-xs text-[#F97316]">ยังไม่มีเงื่อนไข</p>
              )}

              <div className="space-y-4">
                {conds.map((c, i) => {
                  // ค่า A เป็นหัวข้อแบบตัวเลือก -> เงื่อนไขแบบ "เป็น / ไม่ใช่" + ติ๊กตัวเลือก
                  const ci = c.num.source_type === 'office_info' ? choiceInfo(c.num.info_id) : undefined;
                  return (
                  <div key={i} className="rounded-lg bg-[#F8FAFC] p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between">
                      {ci ? (
                        <span className="text-xs font-semibold text-[#334155]">เงื่อนไขแบบตัวเลือก</span>
                      ) : (
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
                          {/* เดิม "อัตราส่วน (A ÷ B)" */}
                          เทียบ 2 ค่า (A เทียบ B)
                        </label>
                      </div>
                      )}
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
                        {/* เดิม "A (ตัวตั้ง)" -> "ค่า A" */}
                        {c.mode === 'ratio' && !ci && (
                          <span className="w-20 text-xs font-bold">ค่า A</span>
                        )}
                        <OperandPicker
                          v={c.num}
                          onChange={(next) => {
                            const nextChoice = next.source_type === 'office_info' && !!choiceInfo(next.info_id);
                            setCond(i, {
                              num: next,
                              // เปลี่ยนหัวข้อ -> ล้างตัวเลือกที่ติ๊กไว้ / หัวข้อแบบตัวเลือกใช้ค่าเดี่ยวเท่านั้น
                              option_ids: next.info_id === c.num.info_id ? c.option_ids : [],
                              ...(nextChoice ? { mode: 'single' as const } : {}),
                            });
                          }}
                          activityOptions={activityOptions}
                          infoTypes={infoTypes}
                        />
                      </div>

                      {/* เงื่อนไขแบบตัวเลือก: เป็น / ไม่ใช่ + ติ๊กตัวเลือก */}
                      {ci && (
                        <div className="space-y-2">
                          <Select
                            className="rounded border px-2 py-1"
                            value={effectiveOp(c)}
                            onChange={(v) => setCond(i, { operator: v as Operator })}
                            options={[
                              { value: 'in', label: 'เป็นหนึ่งใน' },
                              { value: 'not_in', label: 'ไม่ใช่' },
                            ]}
                          />
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {optionsOf(ci).map((o) => (
                              <label key={o.option_id} className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={c.option_ids.includes(o.option_id)}
                                  onChange={(e) =>
                                    setCond(i, {
                                      option_ids: e.target.checked
                                        ? [...c.option_ids, o.option_id]
                                        : c.option_ids.filter((id) => id !== o.option_id),
                                    })
                                  }
                                />
                                {o.label}
                              </label>
                            ))}
                            {optionsOf(ci).length === 0 && (
                              <span className="text-xs text-[#F97316]">หัวข้อนี้ยังไม่มีตัวเลือก (เพิ่มที่ตารางหัวข้อด้านบน)</span>
                            )}
                          </div>
                        </div>
                      )}

                      {!ci && c.mode === 'ratio' && (
                        <div className="flex flex-wrap items-center gap-2">
                          {/* เดิม "B (ตัวหาร)" -> "เทียบกับ B" */}
                          <span className="w-20 text-xs font-bold">เทียบกับ B</span>
                          <OperandPicker
                            v={c.den}
                            onChange={(next) => setCond(i, { den: next })}
                            activityOptions={activityOptions}
                            infoTypes={infoTypes}
                            isDenominator
                          />
                        </div>
                      )}

                      {!ci && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          className="rounded border px-2 py-1"
                          value={effectiveOp(c)}
                          onChange={(v) => setCond(i, { operator: v as Operator })}
                          options={[
                            { value: '>', label: 'มากกว่า' },
                            { value: '>=', label: 'มากกว่าหรือเท่ากับ' },
                            { value: '<', label: 'น้อยกว่า' },
                            { value: '<=', label: 'น้อยกว่าหรือเท่ากับ' },
                            { value: '=', label: 'เท่ากับ' },
                          ]}
                        />
                        <input
                          className="w-32 rounded border px-2 py-1"
                          inputMode="decimal"
                          placeholder="ค่า"
                          value={c.value}
                          onChange={(e) => setCond(i, { value: e.target.value })}
                        />
                        <span className="text-xs text-[#64748B]">
                          หน่วย: <b>{unitHint(c)}</b>
                        </span>
                      </div>
                      )}

                      {/* หมายเหตุอธิบายการเทียบ 2 ค่า พร้อมตัวอย่าง (แสดงเฉพาะเมื่อเลือก "เทียบ 2 ค่า") */}
                      {!ci && c.mode === 'ratio' && (
                        <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs leading-5 text-[#475569]">
                          <p className="font-semibold text-[#334155]">หมายเหตุ: “A เทียบ B” คือ ค่า A ต่อ B 1 หน่วย</p>
                          <p className="mt-1">
                            ตัวอย่าง: A = ปริมาณการใช้น้ำ, B = จำนวนพนักงาน
                            → ระบบดูว่า <b>พนักงาน 1 คน ใช้น้ำเท่าไร</b>
                          </p>
                          <p>
                            องค์กรใช้น้ำ 1,200 ลบ.ม. มีพนักงาน 40 คน = 1,200 / 40 ={' '}
                            <b>30 ลบ.ม. ต่อคน</b> ถ้าตั้งเงื่อนไข “มากกว่า 25” องค์กรนี้จะได้รับคำแนะนำ
                          </p>
                          <p className="mt-1 text-[#94A3B8]">
                            ลำดับมีผล: ถ้าสลับเป็น A = จำนวนพนักงาน, B = ปริมาณการใช้น้ำ จะได้ “พนักงานต่อน้ำ 1 ลบ.ม.” (40 / 1,200 = 0.03)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
              <FieldError message={recErrors.conds} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRecModal(false)}
                className="btn btn-outline rounded-lg px-4 py-2 text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary rounded-lg px-4 py-2 text-sm"
              >
                {saving && 'กำลังบันทึก...'}
                {!saving && editRecId && 'บันทึกการแก้ไข'}
                {!saving && !editRecId && 'บันทึก'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}