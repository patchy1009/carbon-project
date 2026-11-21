// หมวดของหัวข้อข้อมูลสำนักงาน (office_info_type.info_group)
//   ใช้ทั้งหน้าแอดมิน (เลือกหมวดของหัวข้อ) และหน้าข้อมูลสำนักงานขององค์กร (แสดงแยกเป็นหมวด)
//   รายชื่อต้องตรงกับ check constraint ใน supabase/office_info_group.sql ลำดับในอาร์เรย์ = ลำดับที่แสดง

export const INFO_GROUPS = [
  'แสงสว่าง',
  'เครื่องปรับอากาศ',
  'คอมพิวเตอร์',
  'ห้องประชุม',
  'น้ำประปา',
  'การเดินทางพนักงาน',
  'รถยนต์องค์กร',
  'กระดาษ',
] as const;

export type InfoGroup = (typeof INFO_GROUPS)[number];

// หัวข้อเดิมที่ยังไม่ได้เลือกหมวด (info_group = null) แสดงในหมวดนี้ ท้ายสุด
export const OTHER_GROUP_LABEL = 'อื่น ๆ';

// จัดรายการเป็นกลุ่มตามหมวด เรียงตาม INFO_GROUPS แล้วตามด้วย "อื่น ๆ" (ไม่แสดงหมวดที่ไม่มีรายการ)
//   รายการในหมวดคงลำดับเดิม
export function groupByInfoGroup<T extends { info_group?: string | null }>(items: T[]) {
  const known = new Set<string>(INFO_GROUPS);
  const groups = INFO_GROUPS.map((g) => ({ label: g as string, items: items.filter((i) => i.info_group === g) }));
  groups.push({ label: OTHER_GROUP_LABEL, items: items.filter((i) => !i.info_group || !known.has(i.info_group)) });
  return groups.filter((g) => g.items.length > 0);
}
