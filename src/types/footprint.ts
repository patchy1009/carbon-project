// ชนิดข้อมูลของหน้ากรอกข้อมูลกิจกรรม
import type { CarbonScope } from './activity-management';
import type { OcrSource } from '@/lib/bills/types';

export interface ActivityDetailWithValues {
  scopedetail_id: string;
  detail_name: string | null;
  unit: string | null;
  ocr_source: OcrSource | null; // บิลที่เติมช่องนี้ (ดู supabase/activity_detail_ocr_source.sql)
  activity: {
    activity_id: string;
    activity_name: string | null;
    scope_id: string | null;
  } | null;
  emission_factor: { ef_value: number | null } | null;
  global_warming_potential: { gwp_value: number | null } | null;
}

/* กลุ่มกิจกรรม 1 กลุ่มภายในขอบเขต: activity_detail ที่มี activity_id เดียวกัน
 * แสดงหัวกลุ่มด้วย activity.activity_name */
export interface ActivityGroup {
  activity_id: string;
  activity_name: string | null;
  details: ActivityDetailWithValues[];
}

export interface ScopeGroup {
  scope: CarbonScope;
  details: ActivityDetailWithValues[]; // รายการทั้งหมดของขอบเขต (ใช้ตอนตรวจ/คำนวณ/OCR เหมือนเดิม)
  activities: ActivityGroup[]; // รายการเดียวกัน แต่จัดกลุ่มตามกิจกรรม (ใช้ตอนแสดงผลเท่านั้น)
}