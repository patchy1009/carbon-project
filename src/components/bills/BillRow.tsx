// components/bills/BillRow.tsx
'use client';
import type { ReactNode } from 'react';
import type { ActivityPeriod, Check } from '@/lib/bills/types';
import type { PendingBill } from '@/lib/bills/useBillOcr';

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const UNIT = { electricity: 'kWh', water: 'ลบ.ม.', fuel: 'ลิตร' } as const;

type Edit = Partial<Pick<PendingBill, 'billMonth' | 'quantity' | 'fuelType' | 'ack'>>;

export default function BillRow(props: {
  item: PendingBill;
  checks: Check[];
  period: ActivityPeriod;
  onEdit: (p: Edit) => void;
  onRemove: () => void;
  trashIcon: ReactNode;
}) {
  const { item, checks, period, onEdit, onRemove, trashIcon } = props;
  const baseYear = +period.month.slice(0, 4);
  const y = item.billMonth ? +item.billMonth.slice(0, 4) : baseYear;
  const m = item.billMonth ? +item.billMonth.slice(5, 7) : 0;
  const setMonth = (yy: number, mm: number) =>
    onEdit({ billMonth: mm ? `${yy}-${String(mm).padStart(2, '0')}-01` : '' });

  const hasFail = checks.some((c) => c.level === 'fail');
  const hasWarn = checks.some((c) => c.level === 'warn');
  const border = hasFail ? 'border-red-300 bg-red-50' : hasWarn ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white';

  return (
    <li className={`rounded-lg border p-3 text-sm ${border}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{item.file.name}</span>
        <button type="button" onClick={onRemove} aria-label="เอาไฟล์ออก" className="shrink-0 text-slate-500 hover:text-red-600">
          {trashIcon}
        </button>
      </div>

      {item.status === 'reading' && <p className="mt-2 text-slate-500">กำลังอ่านบิล (รูปใช้เวลาประมาณ 5-20 วินาที)...</p>}
      {item.status === 'error' && <p className="mt-2 text-red-600">{item.error}</p>}

      {item.status === 'ready' && (
        <>
          {item.note && <p className="mt-2 text-amber-700">{item.note}</p>}
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs text-slate-500">เดือนของบิล</span>
              <div className="flex gap-1">
                <select value={m} onChange={(e) => setMonth(y, +e.target.value)} className="w-full rounded border px-2 py-1">
                  <option value={0}>เลือกเดือน</option>
                  {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
                </select>
                <select value={y} onChange={(e) => setMonth(+e.target.value, m)} className="rounded border px-2 py-1">
                  {[baseYear - 1, baseYear, baseYear + 1].map((yy) => <option key={yy} value={yy}>{yy + 543}</option>)}
                </select>
              </div>
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">ปริมาณ ({UNIT[item.type]})</span>
              <input
                inputMode="decimal"
                value={item.quantity}
                onChange={(e) => onEdit({ quantity: e.target.value.replace(/[^0-9.]/g, '') })}
                className={`w-full rounded border px-2 py-1 ${item.quantity.trim() === '' ? 'border-amber-400' : ''}`}
              />
            </label>

            {item.type === 'fuel' && (
              <label className="block">
                <span className="text-xs text-slate-500">ชนิดน้ำมัน</span>
                <select value={item.fuelType} onChange={(e) => onEdit({ fuelType: e.target.value as PendingBill['fuelType'] })} className="w-full rounded border px-2 py-1">
                  <option value="">ไม่ระบุ</option>
                  <option value="diesel">ดีเซล</option>
                  <option value="gasoline">เบนซิน/แก๊สโซฮอล์</option>
                </select>
              </label>
            )}
          </div>

          {checks.length > 0 && (
            <ul className="mt-2 space-y-1">
              {checks.map((c) => (
                <li key={c.code} className={c.level === 'fail' ? 'text-red-700' : 'text-amber-700'}>
                  {c.level === 'fail' ? '✕ ' : '⚠ '}{c.message}
                </li>
              ))}
            </ul>
          )}

          {hasWarn && !hasFail && (
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={item.ack} onChange={(e) => onEdit({ ack: e.target.checked })} />
              <span>ตรวจแล้ว รับทราบคำเตือนข้างต้น</span>
            </label>
          )}
        </>
      )}
    </li>
  );
}