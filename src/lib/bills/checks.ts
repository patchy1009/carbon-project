// lib/bills/checks.ts
import type { ActivityPeriod, Check, Extracted } from './types';
import { monthLabel } from './dates';

// เพดานเตือนปริมาณสูงผิดปกติ (ต่อ 1 บิล) TODO: ปรับตามขนาดองค์กรของหนู
const HIGH: Record<Extracted['billType'], number> = { electricity: 100000, water: 5000, fuel: 5000 };

export function runChecks(ex: Extracted, act: ActivityPeriod): Check[] {
  const out: Check[] = [];
  const add = (level: Check['level'], code: string, message: string) => out.push({ level, code, message });

  if (ex.quantity === null) add('warn', 'NO_QTY', 'อ่านปริมาณไม่ได้ กรุณากรอกเอง');
  else if (ex.quantity <= 0) add('fail', 'QTY_ZERO', 'ปริมาณต้องมากกว่า 0');
  else if (ex.quantity > HIGH[ex.billType]) add('warn', 'QTY_HIGH', 'ปริมาณสูงผิดปกติ ตรวจจุดทศนิยมและหน่วยอีกครั้ง');

  if (!ex.billMonth) {
    add('warn', 'NO_MONTH', 'อ่านเดือนของบิลไม่ได้ กรุณาเลือกเอง');
  } else {
    const ok =
      act.type === 'month'
        ? ex.billMonth === act.month
        : ex.billMonth.slice(0, 4) === act.month.slice(0, 4);
    if (!ok) {
      const want = act.type === 'month' ? monthLabel(act.month) : `ปี ${+act.month.slice(0, 4) + 543}`;
      add('fail', 'MONTH_MISMATCH', `บิลนี้เป็นของ ${monthLabel(ex.billMonth)} แต่กิจกรรมนี้คือ ${want}`);
    }
  }

  if (ex.spansTwoMonths) {
    add('warn', 'SPANS_TWO', 'รอบบิลคาบเกี่ยว 2 เดือน ระบบเลือกเดือนที่มีจำนวนวันมากกว่า ตรวจให้แน่ใจว่าตรงกับกิจกรรม');
  }
  if (ex.confidence === 'low') {
    add('warn', 'LOW_CONF', 'ระบบอ่านได้ไม่ครบ ตรวจค่าทุกช่องก่อนยืนยัน');
  }
  if (!out.length) add('ok', 'OK', 'เดือนและปริมาณตรงกับกิจกรรม');
  return out;
}