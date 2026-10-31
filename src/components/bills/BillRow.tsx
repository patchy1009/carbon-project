// components/bills/BillRow.tsx
'use client';
/* [ปรับปรุง] แถวตรวจบิล 1 ใบ: แสดงค่าที่ OCR อ่านได้ ให้ผู้ใช้แก้ แล้วกด "ยืนยันข้อมูล"
 * - แก้ได้: เลขที่บิล, เดือน/ปี, ชนิดน้ำมัน, ปริมาณ
 *   [ลบ] ช่องประเภทบิล: บิลอยู่ในหมวดที่แนบอยู่แล้ว (ถ้าแนบผิดหมวด ระบบเตือนให้ย้าย)
 * - แสดงคำเตือนจาก OCR (warnings) และผลตรวจของระบบ (checks.ts)
 * - แสดงว่าจะเติมลงช่องกิจกรรมไหน เป็นปริมาณเท่าไรหลังแปลงหน่วย
 * - ยืนยันแล้วช่องจะล็อก ต้องกด "แก้ไข" ก่อน (ยกเลิกการยืนยัน) */
import type { ReactNode } from 'react';
import { normalizeNumberString, normalizeToArabicNumber } from '@/lib/normalization';
import { canConfirm, hasFail, hasWarn, type BillTarget } from '@/lib/bills/checks';
import { unitFactor, round4 } from '@/lib/bills/units';
import {
  BILL_UNIT, BILL_UNIT_LABEL, FUEL_TYPES,
  type ActivityPeriod, type Check, type FuelType,
} from '@/lib/bills/types';
import type { BillEdit, PendingBill } from '@/lib/bills/useBillOcr';

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

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
  const years = [...new Set([baseYear - 1, baseYear, baseYear + 1, ...(item.year ? [item.year] : [])])].sort();

  const fail = hasFail(checks);
  const warn = hasWarn(checks);
  const border = locked && !fail
    ? 'border-emerald-300 bg-emerald-50'
    : fail ? 'border-red-300 bg-red-50' : warn ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white';

  // ตัวอย่างปริมาณหลังแปลงหน่วยของช่องกิจกรรม เช่น 41,000 ลิตร -> 41 ลบ.ม.
  const billUnit = item.billType ? BILL_UNIT[item.billType] : null;
  const qty = normalizeToArabicNumber(normalizeNumberString(item.quantity));
  const factor = billUnit && target ? unitFactor(billUnit, target.unit) : null;
  const preview = qty !== null && factor !== null ? round4(qty * factor) : null;

  const field = 'w-full rounded border px-2 py-1 disabled:bg-slate-100 disabled:text-slate-500';

  return (
    <li className={`rounded-lg border p-3 text-sm ${border}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{item.file.name}</span>
        <button type="button" onClick={onRemove} aria-label="เอาไฟล์ออก" className="shrink-0 text-slate-500 hover:text-red-600">
          {trashIcon}
        </button>
      </div>

      {item.status === 'reading' && <p className="mt-2 text-slate-500">กำลังอ่านบิล (ประมาณ 5-20 วินาที)...</p>}
      {item.status === 'error' && <p className="mt-2 text-red-600">✕ {item.error} (กรุณาเอาไฟล์นี้ออก)</p>}

      {item.status === 'ready' && (
        <>
          {item.note && <p className="mt-2 text-amber-700">⚠ {item.note}</p>}

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
                <select
                  disabled={locked}
                  value={item.month}
                  onChange={(e) => onEdit({ month: +e.target.value })}
                  className={field}
                >
                  <option value={0}>เลือกเดือน</option>
                  {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
                </select>
                <select
                  disabled={locked}
                  value={item.year}
                  onChange={(e) => onEdit({ year: +e.target.value })}
                  className="rounded border px-2 py-1 disabled:bg-slate-100"
                >
                  <option value={0}>ปี</option>
                  {years.map((y) => <option key={y} value={y}>{y + 543}</option>)}
                </select>
              </div>
            </label>

            {item.billType === 'fuel' && (
              <label className="block">
                <span className="text-xs text-slate-500">ชนิดน้ำมัน</span>
                <select
                  disabled={locked}
                  value={item.fuelType}
                  onChange={(e) => onEdit({ fuelType: e.target.value as FuelType | '' })}
                  className={`${field} ${item.fuelType === '' ? 'border-amber-400' : ''}`}
                >
                  <option value="">เลือกชนิดน้ำมัน</option>
                  {FUEL_TYPES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
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
                  {c.level === 'fail' ? '✕ ' : '⚠ '}{c.message}
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
                <span className="font-semibold text-emerald-700">✓ ยืนยันข้อมูลแล้ว</span>
                <button type="button" onClick={() => onEdit({ confirmed: false })} className="text-xs text-slate-600 underline">
                  แก้ไข
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={!canConfirm(item, checks)}
                onClick={() => onEdit({ confirmed: true })}
                className="rounded-full bg-[#32885F] px-4 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
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
