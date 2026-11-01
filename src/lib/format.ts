/* [กลาง] จัดรูปแบบตัวเลข/วันที่สำหรับแสดงผล (เดิมเขียนซ้ำในหลายหน้า) */

// 1234.5 -> "1,234.5" (null -> "0")
export function formatNumber(n: number | null | undefined): string {
  return new Intl.NumberFormat('th-TH').format(n ?? 0);
}

/* วันที่แบบไทย ปี พ.ศ.
 *   'short'   -> "2 ส.ค. 2569"   (ค่าเริ่มต้น)
 *   'long'    -> "2 สิงหาคม 2569"
 *   'numeric' -> "02/08/2569" */
export function formatThaiDate(date: string, style: 'short' | 'long' | 'numeric' = 'short'): string {
  const opts: Intl.DateTimeFormatOptions =
    style === 'numeric'
      ? { day: '2-digit', month: '2-digit', year: 'numeric' }
      : { day: 'numeric', month: style, year: 'numeric' };
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', opts).format(new Date(date));
}
