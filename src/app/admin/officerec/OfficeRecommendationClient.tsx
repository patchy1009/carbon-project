'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { deleteRecord, insertRecord } from '@/lib/supabaseCrud';

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

// ---------- ตัวช่วยตรวจข้อมูล (อยู่ในไฟล์นี้ ไม่พึ่งไฟล์อื่น) ----------
const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const cleanText = (s: string) => s.replace(/\s+/g, ' ').trim();
const cleanNumber = (v: string) =>
  v
    .trim()
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(/,/g, '')
    .replace(/\s/g, '');
const isNumeric = (s: string) => /^\d+(\.\d+)?$/.test(s);
const isNumberOnlyText = (s: string) => /^[\d\s.,-]+$/.test(s);
const round2 = (n: number) => Math.round(n * 100) / 100;

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
  const [infoErrors, setInfoErrors] = useState<Record<string, string>>({});

  const [recForm, setRecForm] = useState<RecForm>(emptyRec);
  const [conds, setConds] = useState<CondForm[]>([]);
  const [recErrors, setRecErrors] = useState<Record<string, string>>({});
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
  async function handleAddInfo(e: React.FormEvent) {
    e.preventDefault();

    const name = cleanText(infoForm.info_name);
    const unit = cleanText(infoForm.unit);
    const detail = infoForm.info_detail.trim();

    const errs: Record<string, string> = {};
    if (!name) errs.info_name = 'กรุณากรอกชื่อหัวข้อ';
    else if (isNumberOnlyText(name)) errs.info_name = 'ชื่อหัวข้อต้องไม่เป็นตัวเลขอย่างเดียว';
    setInfoErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const created = await insertRecord<InfoType>(
      'office_info_type',
      { info_name: name, unit: unit || null, info_detail: detail || null },
      '*',
      'เพิ่มหัวข้อข้อมูลสำนักงาน'
    );
    if (!created) return;

    setInfoTypes((prev) => [...prev, created]);
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
  function openRecModal() {
    setRecForm(emptyRec);
    setConds([]);
    setRecErrors({});
    setShowRecModal(true);
  }

  // ตรวจ 1 ค่าในเงื่อนไข คืนข้อความ error หรือ null
  function operandError(o: OperandForm): string | null {
    if (o.source_type === 'activity' && !o.scopedetail_id) return 'กรุณาเลือกกิจกรรม';
    if (o.source_type === 'office_info' && !o.info_id) return 'กรุณาเลือกข้อมูลสำนักงาน';
    return null;
  }

  function validateRec() {
    const errs: Record<string, string> = {};

    const name = cleanText(recForm.recommendation);
    if (!name) errs.recommendation = 'กรุณากรอกชื่อแนวทาง';
    else if (isNumberOnlyText(name)) errs.recommendation = 'ชื่อแนวทางต้องไม่เป็นตัวเลขอย่างเดียว';

    const minS = cleanNumber(recForm.percent_min);
    const maxS = cleanNumber(recForm.percent_max);
    let min = 0;
    let max: number | null = null;

    if (!minS) errs.percent_min = 'กรุณากรอกเปอร์เซ็นต์ที่ลดได้';
    else if (!isNumeric(minS)) errs.percent_min = 'ต้องเป็นตัวเลขที่ไม่ติดลบ';
    else {
      min = Number(minS);
      if (min <= 0 || min > 100) errs.percent_min = 'ต้องมากกว่า 0 และไม่เกิน 100';
    }

    if (maxS) {
      if (!isNumeric(maxS)) errs.percent_max = 'ต้องเป็นตัวเลขที่ไม่ติดลบ';
      else {
        max = Number(maxS);
        if (max <= 0 || max > 100) errs.percent_max = 'ต้องมากกว่า 0 และไม่เกิน 100';
        else if (!errs.percent_min && max < min) errs.percent_max = 'ต้องไม่น้อยกว่าค่าต่ำสุด';
      }
    }

    // เงื่อนไข
    for (let i = 0; i < conds.length; i++) {
      const c = conds[i];
      const label = `เงื่อนไขข้อ ${i + 1}`;
      const v = cleanNumber(c.value);

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
      if (!v || !isNumeric(v)) {
        errs.conds = `${label}: ค่าที่ใช้เทียบต้องเป็นตัวเลขที่ไม่ติดลบ`;
        break;
      }
    }

    return { errs, name, min, max };
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

  async function handleAddRec(e: React.FormEvent) {
    e.preventDefault();

    const { errs, name, min, max } = validateRec();
    setRecErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);

    // ค่าตัวแทน = ค่ากลางของช่วง (ถ้ากรอกค่าเดียว = ค่านั้น)
    const high = max ?? min;
    const mid = round2((min + high) / 2);

    // 1) บันทึกแนวทาง (เริ่มเป็นร่าง ต้องกด "เผยแพร่" ก่อนองค์กรจะเห็น)
    const created = await insertRecord<RecRow>(
      'carbon_reduction_recommendation',
      {
        recommendation: name,
        carbon_reduction_amount: mid,
        percent_min: min,
        percent_max: high,
        scopedetail_id: recForm.scopedetail_id || null,
        calc_method: 'percent',
        status: 'draft',
      },
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
        .insert(
          conds.map((c) => ({
            rec_uid: created.rec_uid,
            ...numCols(c.num),
            ...denCols(c.mode === 'ratio' ? c.den : null),
            operator: c.operator,
            value: Number(cleanNumber(c.value)),
          }))
        )
        .select('*');

      if (error) {
        await supabase
          .from('carbon_reduction_recommendation')
          .delete()
          .eq('rec_uid', created.rec_uid);
        setSaving(false);
        return alert('บันทึกเงื่อนไขไม่สำเร็จ: ' + error.message);
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
            onClick={() => {
              setInfoErrors({});
              setShowInfoModal(true);
            }}
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
                  <td className="px-5 py-4 text-[#64748B]">{i.info_detail ?? '-'}</td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => handleDeleteInfo(i.info_id)}
                      className="text-[#94A3B8] hover:text-red-500"
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
            onClick={openRecModal}
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
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => handleDeleteRec(r.rec_uid)}
                        className="text-[#94A3B8] hover:text-red-500"
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
        <Dialog title="เพิ่มหัวข้อข้อมูลสำนักงาน" onClose={() => setShowInfoModal(false)}>
          <form onSubmit={handleAddInfo} noValidate className="space-y-4">
            <div>
              <input
                className={inputCls(!!infoErrors.info_name)}
                placeholder="ชื่อหัวข้อ เช่น จำนวนพนักงาน"
                value={infoForm.info_name}
                onChange={(e) => setInfoForm({ ...infoForm, info_name: e.target.value })}
              />
              <Err m={infoErrors.info_name} />
            </div>
            <input
              className={inputCls()}
              placeholder="หน่วย เช่น คน, ตร.ม., kWh/ปี, % (เว้นว่างได้ = ช่องข้อความ)"
              value={infoForm.unit}
              onChange={(e) => setInfoForm({ ...infoForm, unit: e.target.value })}
            />
            <textarea
              className={inputCls()}
              rows={3}
              placeholder="คำอธิบายที่จะแสดงให้บริษัทเห็น (ไม่บังคับ) เช่น ให้กรอกค่าเฉลี่ยของทั้งอาคาร"
              value={infoForm.info_detail}
              onChange={(e) => setInfoForm({ ...infoForm, info_detail: e.target.value })}
            />
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
        <Dialog title="เพิ่มแนวทางลดคาร์บอน" onClose={() => setShowRecModal(false)} wide>
          <form onSubmit={handleAddRec} noValidate className="space-y-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">ชื่อแนวทาง</label>
              <input
                className={inputCls(!!recErrors.recommendation)}
                placeholder="เช่น เปลี่ยนมาใช้เครื่องปรับอากาศระบบ Inverter"
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
                className={inputCls()}
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
                {saving ? 'กำลังบันทึก...' : 'บันทึกเป็นร่าง'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}