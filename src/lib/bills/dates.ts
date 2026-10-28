// lib/bills/dates.ts
export const MONTH_RE =
  /(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|มี\.?ค\.?|ม\.?ค\.?|ก\.?พ\.?|เม\.?ย\.?|พ\.?ค\.?|มิ\.?ย\.?|ก\.?ค\.?|ส\.?ค\.?|ก\.?ย\.?|ต\.?ค\.?|พ\.?ย\.?|ธ\.?ค\.?)/.source;

const MONTH_NO: Record<string, number> = {
  'มกราคม': 1, 'มค': 1, 'กุมภาพันธ์': 2, 'กพ': 2, 'มีนาคม': 3, 'มีค': 3,
  'เมษายน': 4, 'เมย': 4, 'พฤษภาคม': 5, 'พค': 5, 'มิถุนายน': 6, 'มิย': 6,
  'กรกฎาคม': 7, 'กค': 7, 'สิงหาคม': 8, 'สค': 8, 'กันยายน': 9, 'กย': 9,
  'ตุลาคม': 10, 'ตค': 10, 'พฤศจิกายน': 11, 'พย': 11, 'ธันวาคม': 12, 'ธค': 12,
};
export const monthNo = (s: string) => MONTH_NO[s.replace(/\./g, '')] ?? null;

// ปี พ.ศ. 4 หลัก (2569) หรือ 2 หลัก (69) -> ค.ศ.
export function toCE(y: number) {
  if (y >= 2400) return y - 543;
  if (y >= 100) return y;
  return y >= 50 ? y + 2500 - 543 : 2000 + y;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (y: number, m: number, d = 1) => `${y}-${pad(m)}-${pad(d)}`;

const SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const monthLabel = (d: string) => `${SHORT[+d.slice(5, 7) - 1]} ${+d.slice(0, 4) + 543}`;

export type FoundDate = { iso: string; idx: number };

// หาวันที่ทุกรูปแบบ: 20 ม.ค. 69, 20 มกราคม 2569, 20/01/2569
export function findDates(t: string): FoundDate[] {
  const out: FoundDate[] = [];
  const push = (y: number, m: number | null, d: number, idx: number) => {
    const ce = toCE(y);
    if (!m || m < 1 || m > 12 || d < 1 || d > 31 || ce < 2015 || ce > 2100) return;
    out.push({ iso: iso(ce, m, d), idx });
  };
  const th = new RegExp(/(\d{1,2})\s*/.source + MONTH_RE + /\s*(\d{2,4})/.source, 'g');
  for (const m of t.matchAll(th)) push(+m[3], monthNo(m[2]), +m[1], m.index ?? 0);
  for (const m of t.matchAll(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/g)) {
    push(+m[3], +m[2], +m[1], m.index ?? 0);
  }
  return out.sort((a, b) => a.idx - b.idx);
}

// ช่วงที่คาบเกี่ยว 2 เดือน: ให้เดือนที่มีจำนวนวันมากกว่าเป็นเดือนของบิล
export function majorityMonth(start: string, end: string) {
  const d = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  if (isNaN(+d) || isNaN(+e) || e < d || (+e - +d) / 86400000 > 62) return null;
  const counts = new Map<string, number>();
  for (; d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 7) + '-01';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];
  return { month: top[0], spansTwoMonths: counts.size > 1 };
}