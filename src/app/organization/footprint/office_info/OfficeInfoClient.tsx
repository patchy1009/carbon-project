'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FootprintStepper from '@/components/FootprintStepper';
import { validateForm, isDecimal, maxLength, existsIn, type formSchema } from '@/lib/validation';
import Select from '@/components/Select'; // dropdown กลาง ใช้กับหัวข้อแบบตัวเลือก
import { groupByInfoGroup } from '@/lib/officeInfoGroups'; // แบ่งหัวข้อเป็นหมวด
import { DAYS_INFO_NAME, HOURS_INFO_NAME } from '@/lib/measureFormulas'; // หัวข้อที่สูตรแนวทางใช้ (จำกัดค่าสูงสุด)
import { noSqlSyntax } from '@/lib/sqlSyntax'; // ตรวจ Syntax ป้องกัน SQL Injection (ช่องข้อความ)
import { normalizeNumberString, normalizeText } from '@/lib/normalization';
import { clearOfficeDraft, draftScope, qtyKey, readOfficeDraft, writeOfficeDraft } from '@/lib/officeDraft';
import { showConfirm } from '@/lib/dialog'; // popup ถามเมื่อยังไม่กรอกข้อมูลสักช่อง (กลับไปกรอก / ข้ามไปขั้นถัดไป)

/* ข้อมูลสำนักงานเป็นของ "แต่ละรายการ" (org_office_info.orgactlist_id) ไม่ใช่ชุดเดียวทั้งองค์กร
 * - รายการใหม่: ฟอร์มว่างเสมอ / แก้ไข: เริ่มจากค่าที่บันทึกไว้ของรายการนั้น
 * - ปุ่ม "ถัดไป": ตรวจข้อมูลแล้วพักค่าไว้ (sessionStorage) ยังไม่บันทึกลง DB
 *   บันทึกจริงตอนกด "คำนวณ" ในขั้นที่ 2 (รายการใหม่ยังไม่มี orgactlist_id จนถึงตอนนั้น)
 * - ย้อนกลับจากขั้นที่ 2 (ปุ่มกลับ หรือ Back ของเบราว์เซอร์ -> ?resume=1): เห็นค่าที่กรอกไว้ */

// ตัวเลือกของหัวข้อแบบ choice (ตาราง office_info_option)
export type OfficeInfoOption = { option_id: string; label: string; sort_order: number };
export type OfficeInfoType = {
  info_id: string;
  info_name: string | null;
  unit: string | null;
  info_detail: string | null;
  input_type: string | null; // number | percent | text | choice (supabase/office_info_choice.sql)
  info_group: string | null; // หมวด (supabase/office_info_group.sql) ใช้แบ่งหัวข้อเป็นหมวดในหน้านี้
  has_quantity?: boolean;    // แบบตัวเลือก: กรอกจำนวนของทุกตัวเลือก (supabase/office_info_quantity.sql)
  office_info_option?: OfficeInfoOption[];
};
export type SavedInfo = {
  orginfo_id: string;
  info_id: string | null;
  amount: string | null; // หัวข้อแบบตัวเลือก (เลือกค่าเดียว) = option_id ที่เลือก / แบบกรอกจำนวน = ว่าง
  org_office_info_option?: { option_id: string; quantity: number | string }[]; // จำนวนของแต่ละตัวเลือก
};

// เพดานของหัวข้อที่สูตรแนวทางลดคาร์บอนใช้ (lib/measureFormulas.ts) กันกรอกเกินจริง เช่น 480 วัน/ปี
//   ชั่วโมงทำงานต่อวัน ≤ 24 / จำนวนวันทำงาน (วัน/ปี) ≤ 366 / หัวข้ออื่นไม่จำกัด
function maxOf(t: OfficeInfoType): number | undefined {
  const squash = (s: string | null) => (s ?? '').replace(/\s+/g, '');
  if (squash(t.info_name) === squash(HOURS_INFO_NAME)) return 24;
  if (squash(t.info_name) === squash(DAYS_INFO_NAME)) return 366;
  return undefined;
}

// หัวข้อแบบตัวเลือกที่ให้กรอกจำนวนของแต่ละตัวเลือก
const isQtyChoice = (t: OfficeInfoType) => kindOf(t) === 'choice' && !!t.has_quantity;

// ชนิดของช่อง: อ่านจาก office_info_type.input_type ที่แอดมินตั้ง
//   [เดิม] ตารางไม่มีคอลัมน์ชนิด จึงเดาจากหน่วย (ไม่มีหน่วย = ข้อความ / มี % = เปอร์เซ็นต์ / อื่นๆ = ตัวเลข)
//   ยังใช้กฎเดิมเป็นค่าสำรอง ถ้ายังไม่ได้รัน supabase/office_info_choice.sql
type Kind = 'text' | 'number' | 'percent' | 'choice';
function kindOf(t: OfficeInfoType): Kind {
  if (t.input_type === 'text' || t.input_type === 'number' || t.input_type === 'percent' || t.input_type === 'choice') {
    return t.input_type;
  }
  if (!t.unit?.trim()) return 'text';
  if (t.unit.includes('%')) return 'percent';
  return 'number';
}

// ตัวเลือกของหัวข้อ เรียงตามลำดับที่แอดมินตั้ง
const optionsOf = (t: OfficeInfoType) =>
  (t.office_info_option ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

/* เดิมไฟล์นี้มี cleanNumber และ validate ของตัวเอง (ซ้ำกับไฟล์กลาง)
 * ตอนนี้สร้าง schema ตามหัวข้อที่แอดมินตั้งไว้ แล้วใช้ validateForm กลาง
 * ทุกช่องไม่บังคับกรอก (ไม่ใส่ required) เพราะบริษัทอาจยังไม่มีข้อมูลบางหัวข้อ
 *   - ข้อความ  : normalizeText + ยาวไม่เกิน 255 ตัวอักษร + ไม่มี Syntax คล้ายคำสั่ง SQL
 *   - ตัวเลข   : แปลงเลขไทย/ลบ comma + ไม่ติดลบ + ทศนิยมไม่เกิน 4 หลัก   จำกัดทศนิยม
 *   - เปอร์เซ็นต์: เหมือนตัวเลข + ไม่เกิน 100 + ทศนิยมไม่เกิน 2 หลัก
 *   - ตัวเลือก : ต้องเป็นตัวเลือกของหัวข้อนี้จริง (กันค่าเก่าของตัวเลือกที่ถูกลบ)
 *   - ตัวเลือกแบบกรอกจำนวน: จำนวนของแต่ละตัวเลือก ไม่ติดลบ ทศนิยมไม่เกิน 4 หลัก (ช่อง key = qtyKey) */
function buildSchema(types: OfficeInfoType[]): formSchema<string> {
  const schema: formSchema<string> = {};
  for (const t of types) {
    const label = t.info_name ?? 'ข้อมูลนี้';
    const kind = kindOf(t);
    if (isQtyChoice(t)) {
      for (const o of optionsOf(t)) {
        schema[qtyKey(t.info_id, o.option_id)] = {
          normalize: normalizeNumberString,
          rules: [isDecimal(`จำนวน ${o.label}`, { allowNegative: false, maxDecimals: 4 })],
        };
      }
      continue;
    }
    schema[t.info_id] =
      kind === 'choice'
        ? { rules: [existsIn(label, optionsOf(t).map((o) => o.option_id))] }
        : kind === 'text'
        ? { normalize: normalizeText, rules: [maxLength(label, 255), noSqlSyntax(label)] }
        : {
            normalize: normalizeNumberString,
            rules: [
              kind === 'percent'
                ? isDecimal(label, { allowNegative: false, max: 100, maxDecimals: 2 })
                : isDecimal(label, { allowNegative: false, maxDecimals: 4, max: maxOf(t) }),
            ],
          };
  }
  return schema;
}

// ตรวจทั้งฟอร์ม แล้วคืนข้อความ error และค่าที่ปรับรูปแบบแล้ว
function validate(types: OfficeInfoType[], form: Record<string, string>) {
  const result = validateForm(form, buildSchema(types));
  return { errors: (result.ok ? {} : result.errors) as Record<string, string>, clean: result.clean };
}

// ขั้นที่ 1 ของการบันทึกฟุตพรินต์: กรอกข้อมูลสำนักงาน แล้วเก็บไว้ชั่วคราวก่อนไปขั้นที่ 2
export default function OfficeInfoClient({
  orgId,
  editId = null, // มีค่า = โหมดแก้ไขรายการเดิม ต้องพกไปขั้นที่ 2
  resume = false, // true = กลับมาจากขั้นที่ 2 ของรายการใหม่
  types,
  saved: savedRows,
}: {
  orgId: string;
  editId?: string | null;
  resume?: boolean;
  types: OfficeInfoType[];
  saved: SavedInfo[];
}) {
  const router = useRouter();
  const nextHref = editId
    ? `/organization/footprint/activity?edit=${editId}`
    : '/organization/footprint/activity';
  const scope = draftScope(editId); // 'new' หรือ id ของรายการที่แก้ไข

  // ค่าเริ่มต้น: รายการใหม่ = ว่าง / แก้ไข = ค่าที่บันทึกไว้ของรายการนั้น
  const [form, setForm] = useState<Record<string, string>>(() => {
    const savedByInfo: Record<string, string> = {};
    const savedQty: Record<string, string> = {}; // key = qtyKey
    for (const r of savedRows) {
      if (!r.info_id) continue;
      savedByInfo[r.info_id] = r.amount ?? '';
      for (const q of r.org_office_info_option ?? []) {
        savedQty[qtyKey(r.info_id, q.option_id)] = String(parseFloat(Number(q.quantity).toPrecision(7)));
      }
    }
    const init: Record<string, string> = {};
    for (const t of types) {
      // กรอกจำนวน: 1 ช่องต่อ 1 ตัวเลือก
      if (isQtyChoice(t)) {
        for (const o of optionsOf(t)) init[qtyKey(t.info_id, o.option_id)] = savedQty[qtyKey(t.info_id, o.option_id)] ?? '';
        continue;
      }
      const v = savedByInfo[t.info_id] ?? '';
      // หัวข้อแบบตัวเลือก: ค่าเก่าที่ไม่ใช่ตัวเลือกปัจจุบัน (ตัวเลือกถูกลบ / หัวข้อเพิ่งเปลี่ยนเป็นตัวเลือก) -> เริ่มจากไม่ระบุ
      init[t.info_id] =
        kindOf(t) === 'choice' && !optionsOf(t).some((o) => o.option_id === v) ? '' : v;
    }
    return init;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openHint, setOpenHint] = useState<Record<string, boolean>>({});

  // เข้ามาใหม่ (navbar/dashboard/ปุ่มแก้ไขจากรายงาน) = เริ่มจากค่าตั้งต้น ล้างค่าที่พักไว้
  //         ย้อนกลับมาจากขั้นที่ 2 (?resume=1) = เติมค่าที่กรอกไว้กลับเข้าฟอร์ม
  // อ่าน sessionStorage ได้หลังหน้าโหลดในเบราว์เซอร์แล้วเท่านั้น จึงทำใน useEffect
  useEffect(() => {
    if (!resume) {
      clearOfficeDraft(scope);
      return;
    }
    const draft = readOfficeDraft(orgId, scope);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- เติมค่าจาก sessionStorage ครั้งเดียวหลังโหลด
    if (draft) setForm((prev) => ({ ...prev, ...draft }));
  }, [resume, orgId, scope]);

  // เก็บค่าที่ผู้ใช้พิมพ์ แล้วล้าง error ของช่องนั้น
  function setField(id: string, value: string) {
    setForm((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: '' }));
  }

  // ปุ่ม "ถัดไป": ตรวจข้อมูลแล้วพักค่าไว้ ยังไม่บันทึกลง DB
  // (บันทึกจริงตอนกด "คำนวณและดูรายงาน" ในขั้นที่ 2 ทั้งรายการใหม่และรายการที่แก้ไข)
  async function handleNext(e: React.FormEvent) {
    e.preventDefault();

    // เอาปุ่ม "ข้ามขั้นตอนนี้" ออกแล้ว -> ถ้ายังไม่กรอกสักช่อง เด้ง popup ให้เลือกว่าจะกลับไปกรอก หรือข้ามไปขั้นที่ 2
    // (ข้อมูลส่วนนี้ไม่บังคับ ใช้แค่แนะนำแนวทางลดคาร์บอน / ถ้าแอดมินยังไม่ได้ตั้งหัวข้อเลย ไม่มีช่องให้กรอก ไปต่อได้เลย)
    if (types.length > 0 && Object.values(form).every((v) => (v ?? '').trim() === '')) {
      const skip = await showConfirm(
        'ข้อมูลนี้ใช้ในการแนะนำแนวทางลดคาร์บอนฟุตพรินต์ขององค์กร\nถ้าข้ามไป หน้ารายงานจะไม่มีคำแนะนำในส่วนนี้',
        { title: 'ยังไม่ได้กรอกข้อมูลสำนักงาน', tone: 'warning', confirmText: 'ข้ามไปขั้นถัดไป', cancelText: 'กลับไปกรอก' },
      );
      if (!skip) return;
    }

    const { errors: errs, clean } = validate(types, form);
    setErrors(errs);
    // ไม่เด้ง alert แล้ว แสดงกรอบแดง + ข้อความใต้ช่องที่ผิดอย่างเดียว
    if (Object.keys(errs).length > 0) return;

    writeOfficeDraft(orgId, scope, clean);
    // เปลี่ยน URL หน้านี้ใน history เป็น ?resume=1 ก่อนไปขั้นที่ 2
    // กด Back ของเบราว์เซอร์กลับมาจะได้เห็นค่าที่กรอกไว้ (ไม่ถูกล้างเหมือนเข้ามาใหม่)
    const here = new URLSearchParams(window.location.search);
    here.set('resume', '1');
    window.history.replaceState(null, '', `?${here.toString()}`);
    router.push(nextHref);
  }

  /* [ปิดใช้งาน] เดิมโหมดแก้ไขบันทึกข้อมูลสำนักงานลง DB ทันทีที่กดปุ่มในหน้านี้
   * ตอนนี้ย้ายไปบันทึกตอนกดคำนวณในขั้นที่ 2 (FootprintClient -> saveOfficeInfo) ให้เหมือนรายการใหม่ */

  return (
    <form onSubmit={handleNext} noValidate className="max-w-[1150px] mx-auto px-8 py-8">
      <h1 className="mb-4 text-[32px] font-medium text-black">วิเคราะห์การปล่อยก๊าซเรือนกระจก</h1>
      <FootprintStepper current={1} />


      <div className="overflow-hidden rounded-[25px] border border-[#BDC9C1] bg-white">
        <div className="flex items-center gap-2 border-b border-[#BDC9C1] bg-[#F2F4F6] px-4 py-2">
          <span className="h-3 w-3 rounded-full bg-[#6FB898]" />
          <h2 className="text-base text-[#191C1E]">ข้อมูลสำนักงาน</h2>
        </div>
        {/* คำชี้แจงว่ากรอกข้อมูลส่วนนี้ไปทำอะไร */}
        <p className="px-4 pt-4 text-sm text-[#4B5563]">
          ข้อมูลสำนักงานใช้ในการแนะนำแนวทางลดคาร์บอนฟุตพรินต์ที่เหมาะกับองค์กรของคุณ (แสดงในหน้ารายงาน)
        </p>

        <div className="space-y-6 p-4">
          {types.length === 0 && (
            <p className="col-span-2 py-6 text-center text-sm text-[#6B7280]">
              ผู้ดูแลระบบยังไม่ได้ตั้งค่าหัวข้อข้อมูลสำนักงาน กด &quot;ถัดไป&quot; เพื่อไปขั้นตอนถัดไปได้
            </p>
          )}

          {/* แสดงแยกตามหมวดที่แอดมินตั้ง (ลำดับตาม INFO_GROUPS) หัวข้อที่ยังไม่มีหมวดอยู่ในหมวด "อื่น ๆ" ท้ายสุด */}
          {groupByInfoGroup(types).map((group) => (
          <section key={group.label}>
            <h3 className="mb-3 border-b border-[#E5E7EB] pb-1 text-sm font-semibold text-[#266955]">{group.label}</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          {group.items.map((t) => {
            const kind = kindOf(t);
            const err = errors[t.info_id];
            return (
              <div key={t.info_id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs tracking-wide text-[#3E4943]">
                    {t.info_name}
                    {t.unit && (kind !== 'choice' || isQtyChoice(t)) ? ` (${t.unit})` : ''}
                  </label>
                  {t.info_detail && (
                    <button
                      type="button"
                      onClick={() => setOpenHint((p) => ({ ...p, [t.info_id]: !p[t.info_id] }))}
                      aria-label="ดูคำอธิบาย"
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6FDBF5] text-xs font-bold text-white"
                    >
                      i
                    </button>
                  )}
                </div>

                {isQtyChoice(t) ? (
                  // หัวข้อแบบตัวเลือกที่กรอกจำนวน: 1 ช่องต่อ 1 ตัวเลือก (เว้นว่าง = ไม่มี)
                  <div className="space-y-2">
                    {optionsOf(t).map((o) => {
                      const key = qtyKey(t.info_id, o.option_id);
                      return (
                        <div key={o.option_id}>
                          <div
                            className={`flex h-11 items-center gap-3 rounded-[20px] border bg-[#F7F9FB] px-[18px] ${
                              errors[key] ? 'border-red-500' : 'border-[#BDC9C1]'
                            }`}
                          >
                            <span className="w-1/2 truncate text-sm text-[#3E4943]">{o.label}</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={form[key] ?? ''}
                              onChange={(e) => setField(key, e.target.value)}
                              placeholder="0"
                              className="w-full bg-transparent text-right text-base text-[#191C1E] outline-none"
                            />
                            {t.unit && <span className="whitespace-nowrap text-base text-[#6B7280]">{t.unit}</span>}
                          </div>
                          {errors[key] && <p className="text-xs text-red-600">{errors[key]}</p>}
                        </div>
                      );
                    })}
                  </div>
                ) : kind === 'choice' ? (
                  // หัวข้อแบบตัวเลือก: เลือกจากรายการที่แอดมินตั้ง (บันทึกเป็น option_id) ไม่บังคับเลือก
                  <Select
                    className={`flex h-11 w-full rounded-[20px] border bg-[#F7F9FB] px-[18px] text-base text-[#191C1E] ${
                      err ? 'border-red-500' : 'border-[#BDC9C1]'
                    }`}
                    value={form[t.info_id] ?? ''}
                    onChange={(v) => setField(t.info_id, v)}
                    options={[
                      { value: '', label: 'ไม่ระบุ' },
                      ...optionsOf(t).map((o) => ({ value: o.option_id, label: o.label })),
                    ]}
                  />
                ) : (
                <div
                  className={`flex h-11 items-center justify-between rounded-[20px] border bg-[#F7F9FB] px-[18px] ${
                    err ? 'border-red-500' : 'border-[#BDC9C1]'
                  }`}
                >
                  <input
                    type="text"
                    inputMode={kind === 'text' ? 'text' : 'decimal'}
                    value={form[t.info_id] ?? ''}
                    onChange={(e) => setField(t.info_id, e.target.value)}
                    placeholder={kind === 'text' ? '' : '0.00'}
                    className="w-full bg-transparent text-base text-[#191C1E] outline-none"
                  />
                  {t.unit && (
                    <span className="whitespace-nowrap pl-2 text-base text-[#6B7280]">{t.unit}</span>
                  )}
                </div>
                )}

                {err && <p className="text-xs text-red-600">{err}</p>}
                {openHint[t.info_id] && t.info_detail && (
                  <p className="whitespace-pre-line rounded-xl bg-[#F2F4F6] px-3 py-2 text-xs text-[#4B5563]">
                    {t.info_detail}
                  </p>
                )}
              </div>
            );
          })}
            </div>
          </section>
          ))}
        </div>
      </div>

      <div className="mt-8 flex items-center gap-4">
        {/* ปุ่ม "ถัดไป" ไปหน้ากรอกข้อมูลการดำเนินกิจกรรม (ยังไม่บันทึกลง DB) */}
        <button
          type="submit"
          // ทรงเดียวกับปุ่ม "ถัดไป" ในหน้าข้อมูลการดำเนินกิจกรรม (ขั้นที่ 2)
          className="btn btn-outline flex h-[60px] items-center gap-1 rounded-[20px] px-8 text-base font-semibold"
        >
          ถัดไป <span className="btn-arrow">›</span>
        </button>
        {/* [ลบ] ลิงก์ "ข้ามขั้นตอนนี้" -> ตอนนี้ข้ามได้จาก popup ตอนกด "ถัดไป" โดยไม่กรอก (ดู handleNext) */}
      </div>
    </form>
  );
}