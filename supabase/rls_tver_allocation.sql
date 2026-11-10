-- [MERGE aom + cyn2] RLS ของตารางที่ cyn2 ใช้ในขั้น "จัดสรรคาร์บอนเครดิต" และหน้า "คำนวณภาษี"
-- เขียนตามรูปแบบเดียวกับ supabase/rls.sql ของ aom (ความปลอดภัยแบบ aom)
-- วิธีใช้: รัน supabase/rls.sql ก่อน (ต้องมีฟังก์ชัน is_admin / is_org / owns_tree_project)
--         แล้ว Supabase > SQL Editor > วางทั้งไฟล์นี้ > Run (รันซ้ำได้)
--
-- ก่อนไฟล์นี้: 3 ตารางด้านล่างไม่มี policy ใน repo -> ถ้าใน DB ยังไม่ได้เปิด RLS
--             ใครที่มี anon key ก็อ่าน/แก้การจัดสรรเครดิตของทุกบริษัทได้
--
-- ยังไม่ครอบคลุม (ต้องตกลงกันก่อน ดู booklet):
--   - organization : ย้ายไปอยู่ supabase/rls_user_organization.sql แล้ว
--   - activity_based : หน้า activity_based ใช้ทั้งเป็น "ข้อมูลกลางของแอดมิน" (อ่านทั้งตาราง)
--                      และ "บันทึกขององค์กร" (insert org_id) ในตารางเดียวกัน -> ควรแยกตารางก่อนเขียน policy


-- ===== ตารางข้อมูลกลาง: เป้าหมายการจัดสรร (Net Zero / Carbon Neutral / Credit Selling) =====
alter table public.project_target_rule enable row level security;

drop policy if exists "read: authenticated" on public.project_target_rule;
create policy "read: authenticated" on public.project_target_rule
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.project_target_rule;
create policy "write: admin" on public.project_target_rule
for all to authenticated
using (public.is_admin())
with check (public.is_admin());


-- ===== ตารางลูกของโครงการ T-VER (ไม่มี org_id จึงตรวจจากตารางแม่ org_tree_project) =====

-- org_credit_allocation: ผลการจัดสรรของ 1 โครงการ
alter table public.org_credit_allocation enable row level security;

drop policy if exists "org: own rows" on public.org_credit_allocation;
create policy "org: own rows" on public.org_credit_allocation
for all to authenticated
using (public.owns_tree_project(orgtreeproject_id))
with check (public.owns_tree_project(orgtreeproject_id));

drop policy if exists "admin: read all" on public.org_credit_allocation;
create policy "admin: read all" on public.org_credit_allocation
for select to authenticated
using (public.is_admin());

-- การจัดสรรนี้เป็นขององค์กรที่ล็อกอินอยู่หรือไม่ (allocation -> project -> org_id)
create or replace function public.owns_credit_allocation(p_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.org_credit_allocation a
    join public.org_tree_project p on p.orgtreeproject_id = a.orgtreeproject_id
    where a.orgallocate_id = p_id and p.org_id = auth.uid()
  );
$$;

-- org_credit_allocation_detail: รายการปล่อยก๊าซที่ถูกเลือกไปหักลบ
-- ต้องเป็นทั้ง "การจัดสรรของเรา" และ "รายการปล่อยก๊าซของเรา" (กันเอารายการของบริษัทอื่นมาผูก)
alter table public.org_credit_allocation_detail enable row level security;

drop policy if exists "org: own rows" on public.org_credit_allocation_detail;
create policy "org: own rows" on public.org_credit_allocation_detail
for all to authenticated
using (public.owns_credit_allocation(orgallocate_id))
with check (
  public.owns_credit_allocation(orgallocate_id)
  and public.owns_activity_list(orgactlist_id)
);

drop policy if exists "admin: read all" on public.org_credit_allocation_detail;
create policy "admin: read all" on public.org_credit_allocation_detail
for select to authenticated
using (public.is_admin());
