/* สีประจำ Scope 1 / 2 / 3 — ใช้ร่วมกันทุกหน้า ให้ scope เดียวกันเป็นสีเดียวกันทั้งระบบ
 *   - หน้ากรอกข้อมูลกิจกรรม (FootprintClient.tsx): กรอบ หัวกล่อง ชื่อกลุ่มกิจกรรม
 *   - หน้ารายงาน (ReportClient.tsx): การ์ดสรุป และแท่งกราฟ
 * เปลี่ยนสีที่ไฟล์นี้ที่เดียว ทุกหน้าเปลี่ยนตาม
 *   main   = สีหลัก (จุดสี แท่งกราฟ เส้นขอบบนการ์ด)
 *   text   = สีตัวอักษรบนพื้นขาว (เข้มกว่า main เพื่อให้อ่านง่าย)
 *   soft   = พื้นหลังอ่อนของหัวกล่อง
 *   border = เส้นขอบกล่อง */
export type ScopeColor = { main: string; text: string; soft: string; border: string };

export const SCOPE_COLORS: Record<1 | 2 | 3, ScopeColor> = {
  1: { main: '#0D9488', text: '#0F766E', soft: '#F0FDFA', border: '#99F6E4' }, // เขียวน้ำทะเล
  2: { main: '#2563EB', text: '#1D4ED8', soft: '#EFF6FF', border: '#BFDBFE' }, // น้ำเงิน
  3: { main: '#F97316', text: '#C2410C', soft: '#FFF7ED', border: '#FED7AA' }, // ส้ม
};

// ไม่มี scope_number (ว่าง) ใช้สีเทา
const NEUTRAL: ScopeColor = { main: '#6FB898', text: '#3E4943', soft: '#F2F4F6', border: '#BDC9C1' };

/* ชุดสีสำรองสำหรับ scope ที่เพิ่มใหม่ (4, 5, ...) ไม่ต้องมาแก้ไฟล์นี้ทุกครั้งที่เพิ่ม scope
 * scope 4 ได้สีแรก, 5 ได้สีที่สอง, ... ใช้ครบแล้ววนกลับมาสีแรก (scope 8 = สีเดียวกับ 4)
 * เลือกสีที่ไม่ชนกับ scope 1-3 (เขียวน้ำทะเล / น้ำเงิน / ส้ม)
 * อยากได้สีเพิ่ม: ต่อท้ายรายการนี้ได้เลย */
const EXTRA_COLORS: ScopeColor[] = [
  { main: '#7C3AED', text: '#6D28D9', soft: '#F5F3FF', border: '#DDD6FE' }, // ม่วง
  { main: '#DB2777', text: '#BE185D', soft: '#FDF2F8', border: '#FBCFE8' }, // ชมพู
  { main: '#CA8A04', text: '#A16207', soft: '#FEFCE8', border: '#FDE68A' }, // เหลืองทอง
  { main: '#65A30D', text: '#4D7C0F', soft: '#F7FEE7', border: '#D9F99D' }, // เขียวใบไม้
];

// เลือกชุดสีตามเลข Scope: 1-3 ใช้สีหลัก เลขอื่นวนใช้สีสำรอง ไม่มีเลขใช้สีเทา
export function scopeColor(scopeNumber: number | null | undefined): ScopeColor {
  if (scopeNumber === 1 || scopeNumber === 2 || scopeNumber === 3) return SCOPE_COLORS[scopeNumber];
  if (scopeNumber == null || scopeNumber < 1) return NEUTRAL;
  return EXTRA_COLORS[(scopeNumber - 4) % EXTRA_COLORS.length]; // วนใช้ชุดสีสำรอง
}
