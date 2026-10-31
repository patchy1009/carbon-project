// lib/officeDraft.ts
/* [เพิ่มใหม่] ค่าข้อมูลสำนักงานที่กรอกในขั้นที่ 1 (ยังไม่บันทึกลง DB)
 * กด "ถัดไป" -> เก็บไว้ใน sessionStorage -> ขั้นที่ 2 กด "คำนวณ" แล้วจึงบันทึกลง org_office_info พร้อมรายการ
 * - ย้อนกลับมาขั้นที่ 1 (ปุ่มกลับ หรือปุ่ม Back ของเบราว์เซอร์) ค่าที่กรอกไว้ยังอยู่
 * - แยกตามรายการ: 'new' = รายการใหม่, หรือ orgactlist_id ของรายการที่กำลังแก้ไข
 * - อยู่แค่แท็บนี้ ปิดแท็บแล้วหาย และผูกกับ org_id กันข้อมูลของบัญชีอื่นที่ล็อกอินในแท็บเดียวกันหลุดมา */

const keyOf = (scope: string) => `footprint:office-draft:${scope}`;

export type OfficeDraft = Record<string, string>; // key = info_id, value = ค่าที่ normalize แล้ว

/* scope: 'new' หรือ orgactlist_id ของรายการที่แก้ไข */
export const draftScope = (editId: string | null | undefined) => editId ?? 'new';

export function readOfficeDraft(orgId: string, scope: string): OfficeDraft | null {
  try {
    const raw = sessionStorage.getItem(keyOf(scope));
    if (!raw) return null;
    const d = JSON.parse(raw) as { orgId: string; values: OfficeDraft };
    return d.orgId === orgId ? d.values : null;
  } catch {
    return null;
  }
}

export function writeOfficeDraft(orgId: string, scope: string, values: OfficeDraft) {
  try {
    sessionStorage.setItem(keyOf(scope), JSON.stringify({ orgId, values }));
  } catch {
    // โหมดส่วนตัว/ปิด storage: ข้ามไป (ข้อมูลสำนักงานจะไม่ถูกบันทึกกับรายการนี้)
  }
}

export function clearOfficeDraft(scope: string) {
  try {
    sessionStorage.removeItem(keyOf(scope));
  } catch {
    // ไม่มี storage ก็ไม่มีอะไรให้ลบ
  }
}

/* มีค่าอย่างน้อย 1 หัวข้อไหม (ใช้แสดงคำเตือน "ยังไม่ได้กรอกข้อมูลสำนักงาน") */
export const hasOfficeValues = (d: OfficeDraft | null) => !!d && Object.values(d).some((v) => v !== '');
