-- [MERGE aom + cyn2 รอบ 2] RLS ของ 2 ตารางที่หน้า "กิจกรรมพิเศษ" ของ cyn2 ใช้ (footprint/general_activity)
-- เขียนตามรูปแบบเดียวกับ supabase/rls.sql ของ aom (ความปลอดภัยแบบ aom)
-- วิธีใช้: รัน supabase/rls.sql ก่อน (ต้องมีฟังก์ชัน is_org)
--         แล้ว Supabase > SQL Editor > วางทั้งไฟล์นี้ > Run (รันซ้ำได้)
--
-- ทำไมต้องมี: หน้า general_activity อ่าน/ลบ/เพิ่มแถวด้วย org_id = ผู้ที่ล็อกอิน (supabase.auth.getUser())
--   แต่ถ้า DB ไม่เปิด RLS ใครที่มี anon key ก็อ่าน/ลบข้อมูลประชุม/เดินทางของทุกบริษัทได้
--   ทั้ง 2 ตารางเป็น "ข้อมูลขององค์กร" ล้วน (ไม่ใช่ข้อมูลกลาง) จึงใช้กฎเดียวกับ org_activity_list:
--   องค์กรเห็น/แก้ได้เฉพาะแถวที่ org_id = ตัวเอง
--
-- ตาราง activity_based (ของรอบก่อน) หน้าใหม่ไม่ใช้แล้ว


-- ===== การประชุม / อบรม / อีเวนต์ =====
alter table public.general_activity_meeting enable row level security;

drop policy if exists "org: own rows" on public.general_activity_meeting;
create policy "org: own rows" on public.general_activity_meeting
for all to authenticated
using (org_id = auth.uid() and public.is_org())
with check (org_id = auth.uid() and public.is_org());


-- ===== การเดินทาง / ขนส่ง =====
alter table public.general_activity_traveling enable row level security;

drop policy if exists "org: own rows" on public.general_activity_traveling;
create policy "org: own rows" on public.general_activity_traveling
for all to authenticated
using (org_id = auth.uid() and public.is_org())
with check (org_id = auth.uid() and public.is_org());
