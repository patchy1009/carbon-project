// components/bills/YearlySummary.tsx
'use client';
/* [เพิ่มใหม่] ตาราง 12 เดือนของช่องกิจกรรม 1 ช่อง (ใช้เมื่อบันทึกแบบรายปี)
 * - เดือนที่มีบิล: แสดงผลรวมจากบิลของเดือนนั้น
 * - เดือนที่ไม่มีบิล: ให้เลือก "กรอกเอง" หรือ "ใช้ค่าเดือนก่อนหน้า"
 * - แถวล่างสุดแสดงผลรวมทั้งปี */
import { resolveYear, type GapChoice, type TargetSummary } from '@/lib/bills/aggregate';

const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 4 });

export default function YearlySummary({
  summary,
  gaps,
  onGapChange,
}: {
  summary: TargetSummary;
  gaps: Record<number, GapChoice>;
  onGapChange: (month: number, choice: GapChoice | null) => void;
}) {
  const r = resolveYear(summary, gaps);
  const unit = summary.target.unit ?? '';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1 pr-2 font-normal">เดือน</th>
            <th className="py-1 pr-2 font-normal">ที่มา</th>
            <th className="py-1 text-right font-normal">ปริมาณ ({unit})</th>
          </tr>
        </thead>
        <tbody>
          {MONTHS_SHORT.map((label, i) => {
            const month = i + 1;
            const billCount = summary.bills.filter((b) => b.month === month).length;
            const g = gaps[month];
            return (
              <tr key={label} className={`border-t ${r.values[i] === null ? 'bg-amber-50' : ''}`}>
                <td className="py-1 pr-2">{label}</td>
                <td className="py-1 pr-2">
                  {billCount > 0 ? (
                    <span className="text-emerald-700">จากบิล {billCount} ใบ</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-amber-700">ไม่มีบิล:</span>
                      <select
                        value={g?.mode ?? ''}
                        onChange={(e) => {
                          const mode = e.target.value;
                          onGapChange(month, mode === 'prev' ? { mode: 'prev' } : mode === 'manual' ? { mode: 'manual', value: '' } : null);
                        }}
                        className="rounded border px-1 py-0.5"
                      >
                        <option value="">เลือกวิธี</option>
                        <option value="manual">กรอกเอง</option>
                        {month > 1 && <option value="prev">ใช้ค่าเดือนก่อนหน้า</option>}
                      </select>
                      {g?.mode === 'manual' && (
                        <input
                          inputMode="decimal"
                          value={g.value}
                          placeholder={`ปริมาณ (${unit})`}
                          onChange={(e) => onGapChange(month, { mode: 'manual', value: e.target.value })}
                          className={`w-28 rounded border px-1 py-0.5 ${r.errors[i] ? 'border-red-500' : ''}`}
                        />
                      )}
                      {r.errors[i] && <span className="text-red-600">{r.errors[i]}</span>}
                    </div>
                  )}
                </td>
                <td className="py-1 text-right font-medium">{r.values[i] === null ? '–' : fmt(r.values[i]!)}</td>
              </tr>
            );
          })}
          <tr className="border-t-2 font-semibold">
            <td className="py-1 pr-2" colSpan={2}>
              รวมทั้งปี
              {r.missing.length > 0 && (
                <span className="ml-2 font-normal text-amber-700">
                  (ยังขาด {r.missing.length} เดือน: {r.missing.map((m) => MONTHS_SHORT[m - 1]).join(', ')})
                </span>
              )}
            </td>
            <td className="py-1 text-right">{fmt(r.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
