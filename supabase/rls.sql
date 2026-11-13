-- กำหนดสิทธิ์การเข้าถึงข้อมูล (RLS) ของระบบ Carbon Calculator
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
--
-- auth.uid() คือ id ของคนที่ล็อกอินอยู่ ซึ่งเป็นค่าเดียวกับ acc_id, org_id และ admin_id
-- ตารางข้อมูลกลาง : ผู้ที่ล็อกอินอ่านได้ แอดมินเท่านั้นที่เพิ่ม แก้ไข ลบได้
-- ตารางขององค์กร  : องค์กรจัดการได้เฉพาะข้อมูลตัวเอง แอดมินอ่านได้อย่างเดียว


-- ===== ฟังก์ชันตรวจสิทธิ์ =====
-- ใช้ security definer เพราะตาราง user เปิด RLS อยู่
-- ถ้าไม่ใส่ policy ของตาราง user จะเรียก is_admin() วนกลับมาไม่จบ

-- คนที่ล็อกอินเป็นแอดมินหรือไม่
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public."user"
    where acc_id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- คนที่ล็อกอินเป็นองค์กรหรือไม่
create or replace function public.is_org()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public."user"
    where acc_id = auth.uid() and role = 'organization' and status = 'active'
  );
$$;

-- รายการบันทึกกิจกรรมนี้เป็นขององค์กรที่ล็อกอินอยู่หรือไม่
create or replace function public.owns_activity_list(p_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.org_activity_list
    where orgactlist_id = p_id and org_id = auth.uid()
  );
$$;

-- โครงการ T-VER นี้เป็นขององค์กรที่ล็อกอินอยู่หรือไม่
create or replace function public.owns_tree_project(p_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.org_tree_project
    where orgtreeproject_id = p_id and org_id = auth.uid()
  );
$$;


-- ===== ตาราง user =====
-- ผู้ใช้ดูได้เฉพาะข้อมูลตัวเอง และแก้ role/status ของตัวเองไม่ได้
alter table public."user" enable row level security;

drop policy if exists "user: read own" on public."user";
create policy "user: read own" on public."user"
for select to authenticated
using (acc_id = auth.uid() or public.is_admin());

drop policy if exists "user: admin manage" on public."user";
create policy "user: admin manage" on public."user"
for all to authenticated
using (public.is_admin())
with check (public.is_admin());


-- ===== ตารางข้อมูลกลาง =====

-- carbon_scope
alter table public.carbon_scope enable row level security;

drop policy if exists "read: authenticated" on public.carbon_scope;
create policy "read: authenticated" on public.carbon_scope
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.carbon_scope;
create policy "write: admin" on public.carbon_scope
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- activity
alter table public.activity enable row level security;

drop policy if exists "read: authenticated" on public.activity;
create policy "read: authenticated" on public.activity
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.activity;
create policy "write: admin" on public.activity
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- activity_detail
alter table public.activity_detail enable row level security;

drop policy if exists "read: authenticated" on public.activity_detail;
create policy "read: authenticated" on public.activity_detail
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.activity_detail;
create policy "write: admin" on public.activity_detail
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ef_type
alter table public.ef_type enable row level security;

drop policy if exists "read: authenticated" on public.ef_type;
create policy "read: authenticated" on public.ef_type
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.ef_type;
create policy "write: admin" on public.ef_type
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- emission_factor
alter table public.emission_factor enable row level security;

drop policy if exists "read: authenticated" on public.emission_factor;
create policy "read: authenticated" on public.emission_factor
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.emission_factor;
create policy "write: admin" on public.emission_factor
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- global_warming_potential
alter table public.global_warming_potential enable row level security;

drop policy if exists "read: authenticated" on public.global_warming_potential;
create policy "read: authenticated" on public.global_warming_potential
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.global_warming_potential;
create policy "write: admin" on public.global_warming_potential
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- office_info_type
alter table public.office_info_type enable row level security;

drop policy if exists "read: authenticated" on public.office_info_type;
create policy "read: authenticated" on public.office_info_type
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.office_info_type;
create policy "write: admin" on public.office_info_type
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- carbon_reduction_recommendation
alter table public.carbon_reduction_recommendation enable row level security;

drop policy if exists "read: authenticated" on public.carbon_reduction_recommendation;
create policy "read: authenticated" on public.carbon_reduction_recommendation
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.carbon_reduction_recommendation;
create policy "write: admin" on public.carbon_reduction_recommendation
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- recommendation_condition
alter table public.recommendation_condition enable row level security;

drop policy if exists "read: authenticated" on public.recommendation_condition;
create policy "read: authenticated" on public.recommendation_condition
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.recommendation_condition;
create policy "write: admin" on public.recommendation_condition
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- tree_list
alter table public.tree_list enable row level security;

drop policy if exists "read: authenticated" on public.tree_list;
create policy "read: authenticated" on public.tree_list
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.tree_list;
create policy "write: admin" on public.tree_list
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- tver_project_detail
alter table public.tver_project_detail enable row level security;

drop policy if exists "read: authenticated" on public.tver_project_detail;
create policy "read: authenticated" on public.tver_project_detail
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.tver_project_detail;
create policy "write: admin" on public.tver_project_detail
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- documents
alter table public.documents enable row level security;

drop policy if exists "read: authenticated" on public.documents;
create policy "read: authenticated" on public.documents
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.documents;
create policy "write: admin" on public.documents
for all to authenticated
using (public.is_admin())
with check (public.is_admin());


-- ===== ให้ฐานข้อมูลใส่ admin_id เองตอนเพิ่มข้อมูล =====
-- หน้าเว็บไม่ต้องส่ง admin_id มา ฐานข้อมูลจะใช้ id ของแอดมินที่ล็อกอินอยู่
alter table public.carbon_scope alter column admin_id set default auth.uid();
alter table public.emission_factor alter column admin_id set default auth.uid();
alter table public.global_warming_potential alter column admin_id set default auth.uid();
alter table public.office_info_type alter column admin_id set default auth.uid();
alter table public.carbon_reduction_recommendation alter column admin_id set default auth.uid();
alter table public.tree_list alter column admin_id set default auth.uid();
alter table public.tver_project_detail alter column admin_id set default auth.uid();
alter table public.documents alter column admin_id set default auth.uid();


-- ===== ตารางขององค์กรที่มี org_id =====

-- org_activity_list
alter table public.org_activity_list enable row level security;
alter table public.org_activity_list alter column org_id set default auth.uid();

drop policy if exists "org: own rows" on public.org_activity_list;
create policy "org: own rows" on public.org_activity_list
for all to authenticated
using (org_id = auth.uid())
with check (org_id = auth.uid() and public.is_org());

drop policy if exists "admin: read all" on public.org_activity_list;
create policy "admin: read all" on public.org_activity_list
for select to authenticated
using (public.is_admin());

-- org_tree_project
alter table public.org_tree_project enable row level security;
alter table public.org_tree_project alter column org_id set default auth.uid();

drop policy if exists "org: own rows" on public.org_tree_project;
create policy "org: own rows" on public.org_tree_project
for all to authenticated
using (org_id = auth.uid())
with check (org_id = auth.uid() and public.is_org());

drop policy if exists "admin: read all" on public.org_tree_project;
create policy "admin: read all" on public.org_tree_project
for select to authenticated
using (public.is_admin());


-- ===== ตารางลูกขององค์กร (ไม่มี org_id จึงตรวจจากตารางแม่) =====

-- org_activity_detail
alter table public.org_activity_detail enable row level security;

drop policy if exists "org: own rows" on public.org_activity_detail;
create policy "org: own rows" on public.org_activity_detail
for all to authenticated
using (public.owns_activity_list(orgactlist_id))
with check (public.owns_activity_list(orgactlist_id));

drop policy if exists "admin: read all" on public.org_activity_detail;
create policy "admin: read all" on public.org_activity_detail
for select to authenticated
using (public.is_admin());

-- org_office_info
alter table public.org_office_info enable row level security;

drop policy if exists "org: own rows" on public.org_office_info;
create policy "org: own rows" on public.org_office_info
for all to authenticated
using (public.owns_activity_list(orgactlist_id))
with check (public.owns_activity_list(orgactlist_id));

drop policy if exists "admin: read all" on public.org_office_info;
create policy "admin: read all" on public.org_office_info
for select to authenticated
using (public.is_admin());

-- org_tree_project_detail
alter table public.org_tree_project_detail enable row level security;

drop policy if exists "org: own rows" on public.org_tree_project_detail;
create policy "org: own rows" on public.org_tree_project_detail
for all to authenticated
using (public.owns_tree_project(orgtreeproject_id))
with check (public.owns_tree_project(orgtreeproject_id));

drop policy if exists "admin: read all" on public.org_tree_project_detail;
create policy "admin: read all" on public.org_tree_project_detail
for select to authenticated
using (public.is_admin());


-- ===== ตารางที่เว็บไม่ได้ใช้ =====
-- ถ้ายังไม่ได้ลบตาราง ให้เปิด RLS ไว้โดยไม่มี policy เพื่อไม่ให้เว็บอ่านหรือเขียนได้
alter table if exists public.login_attempts enable row level security;
alter table if exists public.profiles enable row level security;


-- ===== Storage: ไฟล์เอกสาร =====
-- ผู้ที่ล็อกอินอ่านได้ แอดมินเท่านั้นที่อัปโหลดและลบได้
drop policy if exists "documents: read" on storage.objects;
create policy "documents: read" on storage.objects
for select to authenticated
using (bucket_id = 'documents');

drop policy if exists "documents: admin write" on storage.objects;
create policy "documents: admin write" on storage.objects
for all to authenticated
using (bucket_id = 'documents' and public.is_admin())
with check (bucket_id = 'documents' and public.is_admin());

-- เลิกใช้ bucket bills แล้ว จึงลบ policy เดิมออก
drop policy if exists "bills: own folder" on storage.objects;


-- ===== ตรวจผล (ลบ -- ข้างหน้าแล้วรันทีละบรรทัด) =====
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
-- select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;
