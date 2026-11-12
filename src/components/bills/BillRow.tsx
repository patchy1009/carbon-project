// components/bills/BillRow.tsx
'use client';
/* แถวตรวจบิล 1 ใบ: แสดงค่าที่ OCR อ่านได้ ให้ผู้ใช้แก้ แล้วกด "ยืนยันข้อมูล"
 * - แก้ได้: เลขที่บิล, เดือน/ปี, ชนิดน้ำมัน, ปริมาณ
 *   [ลบ] ช่องประเภทบิล: บิลอยู่ในหมวดที่แนบอยู่แล้ว (ถ้าแนบผิดหมวด ระบบเตือนให้ย้าย)
 * - แสดงคำเตือนจาก OCR (warnings) และผลตรวจของระบบ (checks.ts)
 * - แสดงว่าจะเติมลงช่องกิจกรรมไหน เป็นปริมาณเท่าไรหลังแปลงหน่วย
 * - ยืนยันแล้วช่องจะล็อก ต้องกด "แก้ไข" ก่อน (ยกเลิกการยืนยัน)
 * - รูปย่อของบิลที่แนบ กดแล้วเปิดดูเต็มจอ ซูมได้ (ImageViewer) เพื่อตรวจทานค่าที่ OCR อ่านเทียบกับรูปจริง */
import Select from '@/components/Select'; // dropdown กลาง (แทน <select> ของ browser ให้หน้าตาเหมือนกันทั้งระบบ)
import { useEffect, useState, type ReactNode } from 'react';
import ImageViewer from '@/components/ImageViewer';
import { normalizeNumberString, normalizeToArabicNumber } from '@/lib/normalization';
import { canConfirm, hasFail, hasWarn, type BillTarget } from '@/lib/bills/checks';
import { unitFactor, round4 } from '@/lib/bills/units';
import {
  BILL_UNIT, BILL_UNIT_LABEL, FUEL_TYPES,
  type ActivityPeriod, type Check, type FuelType,
} from '@/lib/bills/types';
import type { BillEdit, PendingBill } from '@/lib/bills/useBillOcr';
import { AlertIcon, CheckIcon, XIcon } from '@/components/icons'; // ไอคอนแทนสัญลักษณ์ ✕ ⚠ ✓

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

// แสดงบิล 1 ใบ: รูปบิล ค่าที่ OCR อ่านได้ ผลตรวจ และปุ่มยืนยัน
export default function BillRow(props: {
  item: PendingBill;
  checks: Check[];
  period: ActivityPeriod;
  target: BillTarget | undefined;   // ช่องกิจกรรมที่บิลนี้จะเติม
  onEdit: (p: BillEdit) => void;
  onRemove: () => void;
  trashIcon: ReactNode;
}) {
  const { item, checks, period, target, onEdit, onRemove, trashIcon } = props;
  const locked = item.confirmed;

  // ปีให้เลือก: รอบปีของกิจกรรม ±1 และปีที่ OCR อ่านได้ (ค.ศ. แสดงเป็น พ.ศ.)
  const baseYear = +period.month.slice(0, 4);
  // ตัวเลือกปี: ปีก่อนหน้า ปีนี้ ปีถัดไป และปีที่ OCR อ่านได้ (ถ้าไม่ซ้ำกับ 3 ปีแรก)
  const years = [baseYear - 1, baseYear, baseYear + 1];
  if (item.year && !years.includes(item.year)) years.push(item.year);
  years.sort();

  const fail = hasFail(checks);
  const warn = hasWarn(checks);
  // สีกรอบบอกสถานะของบิล: ยืนยันแล้ว = เขียว, ไม่ผ่าน = แดง, มีคำเตือน = เหลือง, ปกติ = ขาว
  let border = 'border-slate-200 bg-white';
  if (locked && !fail) border = 'border-emerald-300 bg-emerald-50';
  else if (fail) border = 'border-red-300 bg-red-50';
  else if (warn) border = 'border-amber-300 bg-amber-50';

  // ตัวอย่างปริมาณหลังแปลงหน่วยของช่องกิจกรรม เช่น 41,000 ลิตร -> 41 ลบ.ม.
  const billUnit = item.billType ? BILL_UNIT[item.billType] : null;
  const qty = normalizeToArabicNumber(normalizeNumberString(item.quantity));
  const factor = billUnit && target ? unitFactor(billUnit, target.unit) : null;
  const preview = qty !== null && factor !== null ? round4(qty * factor) : null;

  const field = 'w-full rounded border px-2 py-1 disabled:bg-slate-100 disabled:text-slate-500';

  // ลิงก์ชั่วคราว (blob:) ของรูปบิลในเครื่องผู้ใช้ ใช้แสดงรูปย่อและหน้าต่างดูรูป
  // รูปไม่ถูกอัปโหลดหรือบันทึกที่ไหน และคืนหน่วยความจำ (revoke) เมื่อเอาไฟล์ออก/ออกจากหน้า
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  useEffect(() => {
    const url = URL.createObjectURL(item.file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- สร้าง URL ของไฟล์ได้เฉพาะในเบราว์เซอร์ จึงทำหลังแสดงผล
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [item.file]);

  return (
    <li className={`rounded-lg border p-3 text-sm ${border}`}>
      <div className="flex items-center justify-between gap-3">
        {/* รูปย่อของบิล: กดเพื่อเปิดดูเต็มจอและซูม */}
        <div className="flex min-w-0 items-center gap-3">
          {imageUrl && (
            <button
              type="button"
              onClick={() => setViewing(true)}
              title="กดเพื่อดูรูปเต็มจอและซูม"
              aria-label={`ดูรูปบิล ${item.file.name}`}
              className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-slate-300 bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- รูปจากไฟล์ในเครื่อง (blob:) ใช้ next/image ไม่ได้ */}
              <img src={imageUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-110" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5M11 8v6M8 11h6" />
                </svg>
              </span>
            </button>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{item.file.name}</p>
            {imageUrl && (
              <button
                type="button"
                onClick={() => setViewing(true)}
                className="text-xs font-medium text-[#2A7550] underline-offset-2 hover:underline"
              >
                ดูรูปเพื่อตรวจทาน
              </button>
            )}
          </div>
        </div>
        <button type="button" onClick={onRemove} aria-label="เอาไฟล์ออก" className="shrink-0 text-slate-500 hover:text-red-600">
          {trashIcon}
        </button>
      </div>

      {/* หน้าต่างดูรูปเต็มจอ ซูม/ลาก/หมุนได้ */}
      {viewing && imageUrl && (
        <ImageViewer src={imageUrl} title={item.file.name} onClose={() => setViewing(false)} />
      )}

      {item.status === 'reading' && <p className="mt-2 text-slate-500">กำลังอ่านบิล (ประมาณ 5-20 วินาที)...</p>}
      {item.status === 'error' && (
        <p className="mt-2 flex items-start gap-1.5 text-red-600"><XIcon className="mt-1 h-3.5 w-3.5 shrink-0" />{item.error} (กรุณาเอาไฟล์นี้ออก)</p>
      )}

      {item.status === 'ready' && (
        <>
          {item.note && <p className="mt-2 flex items-start gap-1.5 text-amber-700"><AlertIcon className="mt-1 h-3.5 w-3.5 shrink-0" />{item.note}</p>}

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs text-slate-500">เลขที่บิล</span>
              <input
                disabled={locked}
                value={item.billNumber}
                maxLength={50}
                onChange={(e) => onEdit({ billNumber: e.target.value })}
                className={`${field} ${item.billNumber.trim() === '' ? 'border-amber-400' : ''}`}
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">เดือน/ปีของบิล</span>
              <div className="flex gap-1">
                <Select
                  disabled={locked}
                  value={item.month}
                  onChange={(v) => onEdit({ month: +v })}
                  className={field}
                  options={[{ value: 0, label: 'เลือกเดือน', placeholder: true }, ...MONTHS.map((n, i) => ({ value: i + 1, label: n }))]}
                />
                <Select
                  disabled={locked}
                  value={item.year}
                  onChange={(v) => onEdit({ year: +v })}
                  className="rounded border px-2 py-1 disabled:bg-slate-100"
                  options={[{ value: 0, label: 'ปี', placeholder: true }, ...years.map((y) => ({ value: y, label: y + 543 }))]}
                />
              </div>
            </label>

            {item.billType === 'fuel' && (
              <label className="block">
                <span className="text-xs text-slate-500">ชนิดน้ำมัน</span>
                <Select
                  disabled={locked}
                  value={item.fuelType}
                  onChange={(v) => onEdit({ fuelType: v as FuelType | '' })}
                  className={`${field} ${item.fuelType === '' ? 'border-amber-400' : ''}`}
                  options={[{ value: '', label: 'เลือกชนิดน้ำมัน', placeholder: true }, ...FUEL_TYPES]}
                />
              </label>
            )}

            <label className="block">
              <span className="text-xs text-slate-500">
                ปริมาณ{billUnit ? ` (${BILL_UNIT_LABEL[billUnit]})` : ''}
              </span>
              <input
                disabled={locked}
                inputMode="decimal"
                value={item.quantity}
                onChange={(e) => onEdit({ quantity: e.target.value })}
                className={`${field} ${item.quantity.trim() === '' ? 'border-amber-400' : ''}`}
              />
            </label>
          </div>

          {/* ช่องกิจกรรมที่จะถูกเติม (ตามความสัมพันธ์ ocr_source ที่แอดมินตั้ง) */}
          {target && (
            <p className="mt-2 text-xs text-slate-600">
              จะนำไปรวมในช่อง <b>{target.detail_name}</b>
              {preview !== null && <> : <b>{preview.toLocaleString('th-TH')}</b> {target.unit}</>}
            </p>
          )}

          {/* คำเตือนที่ระบบ OCR ส่งมา */}
          {(item.ocr?.warnings?.length ?? 0) > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
              {item.ocr!.warnings.map((w) => <li key={w}>ระบบอ่านบิลแจ้ง: {w}</li>)}
            </ul>
          )}

          {checks.length > 0 && (
            <ul className="mt-2 space-y-1">
              {checks.map((c) => (
                <li key={c.code} className={c.level === 'fail' ? 'text-red-700' : 'text-amber-700'}>
                  {c.level === 'fail' ? <XIcon className="mr-1 inline h-3.5 w-3.5 align-[-2px]" /> : <AlertIcon className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />}{c.message}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {warn && !fail && !locked && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={item.ack} onChange={(e) => onEdit({ ack: e.target.checked })} />
                <span>ตรวจแล้ว รับทราบคำเตือนข้างต้น</span>
              </label>
            )}
            {locked ? (
              <>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><CheckIcon className="h-4 w-4" />ยืนยันข้อมูลแล้ว</span>
                <button type="button" onClick={() => onEdit({ confirmed: false })} className="text-xs text-slate-600 underline">
                  แก้ไข
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={!canConfirm(item, checks)}
                onClick={() => onEdit({ confirmed: true })}
                className="btn btn-primary rounded-full px-4 py-1.5 text-xs font-semibold disabled:bg-slate-300 disabled:shadow-none"
              >
                ยืนยันข้อมูล
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}
