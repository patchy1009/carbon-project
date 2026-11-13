-- [MERGE aom + cyn2 รอบ 3] RLS ของตาราง project_cost_type (ต้นทุนโครงการ หน้าแอดมิน allotaxdoc ที่ cyn2 ให้บันทึกลง DB)
-- เขียนตามรูปแบบ supabase/rls.sql ของ aom: ข้อมูลกลาง -> ผู้ที่ล็อกอินอ่านได้ / แอดมินเท่านั้นที่เพิ่ม แก้ ลบได้
-- วิธีใช้: รัน supabase/rls.sql ก่อน (ต้องมีฟังก์ชัน is_admin) แล้ว Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- ตาราง project_target_rule (เป้าหมายโครงการ) อยู่ใน supabase/rls_tver_allocation.sql แล้ว

alter table public.project_cost_type enable row level security;

drop policy if exists "read: authenticated" on public.project_cost_type;
create policy "read: authenticated" on public.project_cost_type
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.project_cost_type;
create policy "write: admin" on public.project_cost_type
for all to authenticated
using (public.is_admin())
with check (public.is_admin());
