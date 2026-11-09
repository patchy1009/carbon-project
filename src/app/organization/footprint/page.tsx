/* [MERGE aom + cyn2] ไฟล์นี้ใช้โค้ด aom ทั้งหมด
 *   cyn2 แก้ query ให้ join org_activity_list เพื่อหา org_id (เพราะ org_office_info ไม่มีคอลัมน์ org_id แล้ว)
 *   แต่ aom แก้ปัญหาเดียวกันไว้ครบกว่า: โหลดเฉพาะข้อมูลของรายการที่กำลังแก้ไข (orgactlist_id) + ตรวจสิทธิ์เจ้าของ
 *   ถ้าใช้แบบ cyn2 รายการใหม่จะเห็นค่าของทุกรายการเก่าปนกัน จึงไม่รับส่วนนั้นมา */
// ส่วนที่ทำงานฝั่ง server ของขั้นที่ 1: ดึงหัวข้อข้อมูลสำนักงาน และค่าเดิมถ้าเป็นโหมดแก้ไข
export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import OfficeInfoClient, { type OfficeInfoType, type SavedInfo } from './OfficeInfoClient';

// อ่านค่า edit และ resume จาก URL ดึงข้อมูล แล้วส่งให้ OfficeInfoClient
export default async function FootprintOfficePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; resume?: string }>;
}) {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();
  // edit   = กำลังแก้ไขรายการเดิม ต้องส่งต่อไปขั้นที่ 2
  // resume = ย้อนกลับมาจากขั้นที่ 2 -> เอาค่าที่กรอกค้างไว้ (ยังไม่บันทึก) กลับมา
  const { edit, resume } = await searchParams;

  const typesRes = await supabase
    .from('office_info_type')
    .select('info_id, info_name, unit, info_detail')
    .order('updated_at', { ascending: true });
  if (typesRes.error) console.error('office_info_type error:', typesRes.error.message);

  // เดิมโหลดข้อมูลสำนักงานทั้งหมดขององค์กร (ชุดเดียวใช้ร่วมทุกรายการ) จึงเห็นค่าเก่าค้างตอนสร้างรายการใหม่
  // ตอนนี้: รายการใหม่ = ฟอร์มว่าง / แก้ไข = โหลดเฉพาะของรายการนั้น (org_office_info.orgactlist_id)
  // org_office_info ไม่มี org_id แล้ว -> ตรวจก่อนว่ารายการนี้เป็นขององค์กรที่ล็อกอิน
  // แล้วค่อยโหลดข้อมูลสำนักงานของรายการนั้นด้วย orgactlist_id
  let saved: SavedInfo[] = [];
  if (edit) {
    const { data: log } = await supabase
      .from('org_activity_list')
      .select('orgactlist_id')
      .eq('orgactlist_id', edit)
      .eq('org_id', orgId)
      .maybeSingle();
    if (log) {
      const savedRes = await supabase
        .from('org_office_info')
        .select('orginfo_id, info_id, amount')
        .eq('orgactlist_id', edit);
      if (savedRes.error) console.error('org_office_info error:', savedRes.error.message);
      saved = (savedRes.data ?? []) as SavedInfo[];
    }
  }

  return (
    <OfficeInfoClient
      key={`${edit ?? 'new'}:${resume ?? ''}`}
      orgId={orgId}
      editId={edit ?? null}
      resume={resume === '1'}
      types={(typesRes.data ?? []) as OfficeInfoType[]}
      saved={saved}
    />
  );
}
