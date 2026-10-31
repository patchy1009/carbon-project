'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FootprintStepper from '@/components/FootprintStepper';
import { validateForm, isDecimal, maxLength, type formSchema } from '@/lib/validation';
import { normalizeNumberString, normalizeText } from '@/lib/normalization';
import { clearOfficeDraft, draftScope, readOfficeDraft, writeOfficeDraft } from '@/lib/officeDraft';

/* [ปรับปรุง] ข้อมูลสำนักงานเป็นของ "แต่ละรายการ" (org_office_info.orgactlist_id) ไม่ใช่ชุดเดียวทั้งองค์กร
 * - รายการใหม่: ฟอร์มว่างเสมอ / แก้ไข: เริ่มจากค่าที่บันทึกไว้ของรายการนั้น
 * - ปุ่ม "ถัดไป": ตรวจข้อมูลแล้วพักค่าไว้ (sessionStorage) ยังไม่บันทึกลง DB
 *   บันทึกจริงตอนกด "คำนวณ" ในขั้นที่ 2 (รายการใหม่ยังไม่มี orgactlist_id จนถึงตอนนั้น)
 * - ย้อนกลับจากขั้นที่ 2 (ปุ่มกลับ หรือ Back ของเบราว์เซอร์ -> ?resume=1): เห็นค่าที่กรอกไว้ */

export type OfficeInfoType = {
  info_id: string;
  info_name: string | null;
  unit: string | null;
  info_detail: string | null;
};
export type SavedInfo = {
  orginfo_id: string;
  info_id: string | null;
  amount: string | null;
};

// ตารางไม่มีคอลัมน์ "ชนิดข้อมูล" จึงเดาจากหน่วย:
//   ไม่มีหน่วย → ข้อความ | หน่วยมี % → เปอร์เซ็นต์ (0-100) | มีหน่วยอื่น → ตัวเลข
type Kind = 'text' | 'number' | 'percent';
const kindOf = (t: OfficeInfoType): Kind =>
  !t.unit?.trim() ? 'text' : t.unit.includes('%') ? 'percent' : 'number';

/* [แก้ไข] เดิมไฟล์นี้มี cleanNumber และ validate ของตัวเอง (ซ้ำกับไฟล์กลาง)
 * ตอนนี้สร้าง schema ตามหัวข้อที่แอดมินตั้งไว้ แล้วใช้ validateForm กลาง
 * ทุกช่องไม่บังคับกรอก (ไม่ใส่ required) เพราะบริษัทอาจยังไม่มีข้อมูลบางหัวข้อ
 *   - ข้อความ  : normalizeText + ยาวไม่เกิน 255 ตัวอักษร
 *   - ตัวเลข   : แปลงเลขไทย/ลบ comma + ไม่ติดลบ + ทศนิยมไม่เกิน 4 หลัก   [เพิ่ม] จำกัดทศนิยม
 *   - เปอร์เซ็นต์: เหมือนตัวเลข + ไม่เกิน 100 + ทศนิยมไม่เกิน 2 หลัก */
function buildSchema(types: OfficeInfoType[]): formSchema<string> {
  const schema: formSchema<string> = {};
  for (const t of types) {
    const label = t.info_name ?? 'ข้อมูลนี้';
    const kind = kindOf(t);
    schema[t.info_id] =
      kind === 'text'
        ? { normalize: normalizeText, rules: [maxLength(label, 255)] }
        : {
            normalize: normalizeNumberString,
            rules: [
              kind === 'percent'
                ? isDecimal(label, { allowNegative: false, max: 100, maxDecimals: 2 })
                : isDecimal(label, { allowNegative: false, maxDecimals: 4 }),
            ],
          };
  }
  return schema;
}

function validate(types: OfficeInfoType[], form: Record<string, string>) {
  const result = validateForm(form, buildSchema(types));
  return { errors: (result.ok ? {} : result.errors) as Record<string, string>, clean: result.clean };
}

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
    for (const r of savedRows) if (r.info_id) savedByInfo[r.info_id] = r.amount ?? '';
    const init: Record<string, string> = {};
    for (const t of types) init[t.info_id] = savedByInfo[t.info_id] ?? '';
    return init;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openHint, setOpenHint] = useState<Record<string, boolean>>({});

  // [แก้ไข] เข้ามาใหม่ (navbar/dashboard/ปุ่มแก้ไขจากรายงาน) = เริ่มจากค่าตั้งต้น ล้างค่าที่พักไว้
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

  function setField(id: string, value: string) {
    setForm((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: '' }));
  }

  // [แก้ไข] ปุ่ม "ถัดไป": ตรวจข้อมูลแล้วพักค่าไว้ ยังไม่บันทึกลง DB
  // (บันทึกจริงตอนกด "คำนวณและดูรายงาน" ในขั้นที่ 2 ทั้งรายการใหม่และรายการที่แก้ไข)
  function handleNext(e: React.FormEvent) {
    e.preventDefault();

    const { errors: errs, clean } = validate(types, form);
    setErrors(errs);
    // [แก้ไข] ไม่เด้ง alert แล้ว แสดงกรอบแดง + ข้อความใต้ช่องที่ผิดอย่างเดียว
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

        <div className="grid grid-cols-2 gap-x-8 gap-y-5 p-4">
          {types.length === 0 && (
            <p className="col-span-2 py-6 text-center text-sm text-[#6B7280]">
              ผู้ดูแลระบบยังไม่ได้ตั้งค่าหัวข้อข้อมูลสำนักงาน สามารถข้ามไปขั้นตอนถัดไปได้
            </p>
          )}

          {types.map((t) => {
            const kind = kindOf(t);
            const err = errors[t.info_id];
            return (
              <div key={t.info_id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs tracking-wide text-[#3E4943]">
                    {t.info_name}
                    {t.unit ? ` (${t.unit})` : ''}
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
      </div>

      <div className="mt-8 flex items-center gap-4">
        {/* [แก้ไข] ปุ่ม "ถัดไป" ไปหน้ากรอกข้อมูลการดำเนินกิจกรรม (ยังไม่บันทึกลง DB) */}
        <button
          type="submit"
          className="h-[60px] rounded-full bg-[#32885F] px-10 text-base font-semibold tracking-wide text-white"
        >
          ถัดไป ›
        </button>
        {/* ข้ามขั้นตอน = ไม่ใช้ค่าในหน้านี้ (รายการใหม่: ไม่มีข้อมูลสำนักงาน / แก้ไข: คงค่าเดิมใน DB) */}
        <Link href={nextHref} onClick={() => clearOfficeDraft(scope)} className="text-sm text-[#6B7280] underline">
          ข้ามขั้นตอนนี้
        </Link>
      </div>
    </form>
  );
}