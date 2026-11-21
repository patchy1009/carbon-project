-- หมวดของหัวข้อข้อมูลสำนักงาน (office_info_type.info_group)
--   แอดมินเลือกหมวดตอนเพิ่ม/แก้หัวข้อ -> หน้าข้อมูลสำนักงานขององค์กรแสดงแยกเป็นหมวด
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
--
-- รายชื่อหมวดต้องตรงกับ INFO_GROUPS ใน src/lib/officeInfoGroups.ts (ลำดับในไฟล์นั้น = ลำดับที่แสดง)
--   ถ้าจะเพิ่ม/เปลี่ยนชื่อหมวด ต้องแก้ทั้ง 2 ที่ แล้วรันไฟล์นี้ใหม่
-- หัวข้อเดิมที่ยังไม่มีหมวด (null) แสดงในหมวด "อื่น ๆ" ท้ายสุด และแอดมินต้องเลือกหมวดตอนแก้ไขครั้งถัดไป

alter table public.office_info_type
  add column if not exists info_group text;

alter table public.office_info_type
  drop constraint if exists office_info_type_info_group_check;
alter table public.office_info_type
  add constraint office_info_type_info_group_check
  check (info_group is null or info_group in (
    'แสงสว่าง',
    'เครื่องปรับอากาศ',
    'คอมพิวเตอร์',
    'ห้องประชุม',
    'น้ำประปา',
    'การเดินทางพนักงาน',
    'รถยนต์องค์กร',
    'กระดาษ'
  ));
