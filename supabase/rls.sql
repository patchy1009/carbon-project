-- =====================================================================
-- RLS ของระบบ Carbon Calculator
-- วิธีใช้: Supabase Dashboard > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- หลักการ:  auth.uid() = id ของบัญชีที่ล็อกอิน = "user".acc_id = org_id / admin_id
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0) ฟังก์ชันช่วยเช็ก role
--    security definer = อ่านตาราง "user" ได้โดยไม่ติด RLS ของตัวมันเอง (กัน policy วนซ้ำ)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public."user"
    where acc_id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_org()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public."user"
    where acc_id = auth.uid() and role = 'organization' and status = 'active'
  );
$$;


-- ---------------------------------------------------------------------
-- 1) ตาราง "user" : เห็นเฉพาะแถวของตัวเอง แอดมินเห็นทั้งหมด
--    (ห้ามให้ผู้ใช้แก้ role/status เอง -> ไม่มี policy update สำหรับผู้ใช้ทั่วไป)
-- ---------------------------------------------------------------------
alter table public."user" enable row level security;

drop policy if exists "user: read own" on public."user";
create policy "user: read own" on public."user"
  for select to authenticated
  using (acc_id = auth.uid() or public.is_admin());

drop policy if exists "user: admin manage" on public."user";
create policy "user: admin manage" on public."user"
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 2) ตารางข้อมูลกลางที่แอดมินดูแล
--    ทุกคนที่ล็อกอินอ่านได้ / แอดมินเท่านั้นเพิ่ม-แก้-ลบ
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'carbon_scope', 'activity', 'activity_detail',
    'ef_type', 'emission_factor', 'global_warming_potential',
    'office_info_type', 'carbon_reduction_recommendation', 'recommendation_condition',
    'tree_list', 'tver_project_detail', 'documents'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "read: authenticated" on public.%I', t);
    execute format(
      'create policy "read: authenticated" on public.%I for select to authenticated using (true)', t);

    execute format('drop policy if exists "write: admin" on public.%I', t);
    execute format(
      'create policy "write: admin" on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ตารางที่มีคอลัมน์ admin_id: ให้ DB ใส่ id แอดมินที่ล็อกอินอยู่ให้อัตโนมัติตอน insert
-- (โค้ดฝั่ง Next.js ไม่ต้องส่ง admin_id เอง)
do $$
declare t text;
begin
  foreach t in array array[
    'carbon_scope', 'emission_factor', 'global_warming_potential', 'office_info_type',
    'carbon_reduction_recommendation', 'tree_list', 'tver_project_detail', 'documents'
  ] loop
    execute format('alter table public.%I alter column admin_id set default auth.uid()', t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 3) ตารางขององค์กรที่มีคอลัมน์ org_id
--    องค์กรจัดการได้เฉพาะแถวที่ org_id = ตัวเอง / แอดมินอ่านได้ทุกแถว
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'org_activity_list', 'org_office_info', 'org_tree_project', 'org_bill_file'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I alter column org_id set default auth.uid()', t);

    execute format('drop policy if exists "org: own rows" on public.%I', t);
    execute format(
      'create policy "org: own rows" on public.%I for all to authenticated
         using (org_id = auth.uid())
         with check (org_id = auth.uid() and public.is_org())', t);

    execute format('drop policy if exists "admin: read all" on public.%I', t);
    execute format(
      'create policy "admin: read all" on public.%I for select to authenticated
         using (public.is_admin())', t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 4) ตารางลูกที่ไม่มี org_id -> เช็กผ่านตารางแม่
-- ---------------------------------------------------------------------
alter table public.org_activity_detail enable row level security;

drop policy if exists "org: own rows" on public.org_activity_detail;
create policy "org: own rows" on public.org_activity_detail
  for all to authenticated
  using (exists (
    select 1 from public.org_activity_list l
    where l.orgactlist_id = org_activity_detail.orgactlist_id and l.org_id = auth.uid()))
  with check (exists (
    select 1 from public.org_activity_list l
    where l.orgactlist_id = org_activity_detail.orgactlist_id and l.org_id = auth.uid()));

drop policy if exists "admin: read all" on public.org_activity_detail;
create policy "admin: read all" on public.org_activity_detail
  for select to authenticated using (public.is_admin());

alter table public.org_tree_project_detail enable row level security;

drop policy if exists "org: own rows" on public.org_tree_project_detail;
create policy "org: own rows" on public.org_tree_project_detail
  for all to authenticated
  using (exists (
    select 1 from public.org_tree_project p
    where p.orgtreeproject_id = org_tree_project_detail.orgtreeproject_id and p.org_id = auth.uid()))
  with check (exists (
    select 1 from public.org_tree_project p
    where p.orgtreeproject_id = org_tree_project_detail.orgtreeproject_id and p.org_id = auth.uid()));

drop policy if exists "admin: read all" on public.org_tree_project_detail;
create policy "admin: read all" on public.org_tree_project_detail
  for select to authenticated using (public.is_admin());


-- ---------------------------------------------------------------------
-- 5) Storage
--    bills     : ไฟล์เก็บที่ path "<org_id>/<orgactlist_id>/<ไฟล์>" -> โฟลเดอร์แรกต้องเป็น id ตัวเอง
--    documents : ทุกคนที่ล็อกอินอ่านได้ / แอดมินเท่านั้นอัปโหลด-ลบ
-- ---------------------------------------------------------------------
drop policy if exists "bills: own folder" on storage.objects;
create policy "bills: own folder" on storage.objects
  for all to authenticated
  using (bucket_id = 'bills' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'bills' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents: read" on storage.objects;
create policy "documents: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents');

drop policy if exists "documents: admin write" on storage.objects;
create policy "documents: admin write" on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and public.is_admin())
  with check (bucket_id = 'documents' and public.is_admin());
