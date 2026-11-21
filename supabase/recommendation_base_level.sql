-- ฐานที่ใช้คำนวณ % ของแนวทางลดคาร์บอน เลือกได้ 3 ระดับ (เลือกได้ระดับเดียวต่อแนวทาง)
--   scopedetail_id   : รายการย่อย 1 รายการ (แบบเดิม) เช่น ปริมาณเชื้อเพลิง Diesel
--   base_activity_id : ทั้งกิจกรรม = รวมทุกรายการย่อยในกิจกรรมนั้น เช่น การเดินทางด้วยยานพาหนะขององค์กร (Diesel + Gasohol + ...)
--   base_scope_id    : ทั้ง Scope = รวมทุกกิจกรรมใน Scope นั้น
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)

alter table public.carbon_reduction_recommendation
  add column if not exists base_activity_id uuid references public.activity(activity_id) on delete set null;
alter table public.carbon_reduction_recommendation
  add column if not exists base_scope_id uuid references public.carbon_scope(scope_id) on delete set null;
-- ลบกิจกรรม/Scope ที่แนวทางใช้เป็นฐาน: หน้าแอดมินบล็อกไว้ก่อน (set null เป็นแค่กันพลาด)

-- เลือกฐานได้ระดับเดียว (หรือไม่ผูกเลย = แนะนำทั่วไป)
alter table public.carbon_reduction_recommendation
  drop constraint if exists carbon_reduction_recommendation_one_base_check;
alter table public.carbon_reduction_recommendation
  add constraint carbon_reduction_recommendation_one_base_check
  check (num_nonnulls(scopedetail_id, base_activity_id, base_scope_id) <= 1);
