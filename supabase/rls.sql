-- =====================================================================
-- RLS (Row Level Security) ของระบบ Carbon Calculator — ครบทุกตาราง
-- วิธีใช้: Supabase Dashboard > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้ ไม่พัง)
--
-- หลักการ:
--   auth.uid()  = id ของบัญชีที่ล็อกอินอยู่ (Supabase Auth)
--               = "user".acc_id = org_id (ฝั่งองค์กร) = admin_id (ฝั่งแอดมิน)
--   - ตารางข้อมูลกลาง (EF, กิจกรรม, ต้นไม้ ...) : ทุกคนที่ล็อกอินอ่านได้ / แอดมินเท่านั้นแก้ได้
--   - ตารางขององค์กร (มี org_id)                 : องค์กรเห็น/แก้เฉพาะของตัวเอง / แอดมินอ่านได้ทุกแถว
--   - ตารางลูกที่ไม่มี org_id                      : ตรวจความเป็นเจ้าของผ่านตารางแม่
--   - ตารางที่แอปไม่ได้ใช้ (login_attempts, profiles): เปิด RLS ไว้เฉยๆ = ฝั่งเว็บอ่าน/เขียนไม่ได้เลย
--
-- [แก้ไข] เวอร์ชันนี้:
--   - org_office_info ไม่มี org_id แล้ว (ผูกกับรายการด้วย orgactlist_id) -> ย้ายไปตรวจผ่าน org_activity_list
--   - ทุกคำสั่งเช็กก่อนว่าตาราง/คอลัมน์มีอยู่จริง (เช่น org_bill_file ที่เลิกใช้แล้ว) ถ้าไม่มีจะข้ามไป
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

-- ใช้ตรวจว่า "รายการบันทึกการปล่อยก๊าซ" นี้เป็นขององค์กรที่ล็อกอินอยู่ไหม (ใช้กับตารางลูก)
create or replace function public.owns_activity_list(p_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.org_activity_list l
    where l.orgactlist_id = p_id and l.org_id = auth.uid()
  );
$$;

-- ใช้ตรวจว่า "โครงการ T-VER" นี้เป็นขององค์กรที่ล็อกอินอยู่ไหม
create or replace function public.owns_tree_project(p_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.org_tree_project p
    where p.orgtreeproject_id = p_id and p.org_id = auth.uid()
  );
$$;


-- ---------------------------------------------------------------------
-- 1) ตาราง "user" : เห็นเฉพาะแถวของตัวเอง แอดมินเห็นทั้งหมด
--    (ห้ามผู้ใช้แก้ role/status ของตัวเอง -> ไม่มี policy update สำหรับผู้ใช้ทั่วไป)
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
--    ถ้ามีคอลัมน์ admin_id: ให้ DB ใส่ id แอดมินที่ล็อกอินอยู่ให้เองตอน insert
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
    continue when to_regclass('public.' || t) is null; -- ไม่มีตารางนี้ = ข้าม

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "read: authenticated" on public.%I', t);
    execute format(
      'create policy "read: authenticated" on public.%I for select to authenticated using (true)', t);

    execute format('drop policy if exists "write: admin" on public.%I', t);
    execute format(
      'create policy "write: admin" on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);

    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = t and column_name = 'admin_id') then
      execute format('alter table public.%I alter column admin_id set default auth.uid()', t);
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 3) ตารางขององค์กรที่มีคอลัมน์ org_id
--    องค์กรจัดการได้เฉพาะแถวที่ org_id = ตัวเอง / แอดมินอ่านได้ทุกแถว
--    DB ใส่ org_id = id ที่ล็อกอินอยู่ให้เองตอน insert
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['org_activity_list', 'org_tree_project', 'org_bill_file'] loop
    continue when to_regclass('public.' || t) is null;

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
-- 4) ตารางลูกที่ไม่มี org_id -> ตรวจผ่านตารางแม่
--    org_activity_detail, org_office_info -> org_activity_list (orgactlist_id)
--    org_tree_project_detail             -> org_tree_project  (orgtreeproject_id)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['org_activity_detail', 'org_office_info'] loop
    continue when to_regclass('public.' || t) is null;

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "org: own rows" on public.%I', t);
    execute format(
      'create policy "org: own rows" on public.%I for all to authenticated
         using (public.owns_activity_list(orgactlist_id))
         with check (public.owns_activity_list(orgactlist_id))', t);

    execute format('drop policy if exists "admin: read all" on public.%I', t);
    execute format(
      'create policy "admin: read all" on public.%I for select to authenticated
         using (public.is_admin())', t);
  end loop;
end $$;

alter table public.org_tree_project_detail enable row level security;

drop policy if exists "org: own rows" on public.org_tree_project_detail;
create policy "org: own rows" on public.org_tree_project_detail
  for all to authenticated
  using (public.owns_tree_project(orgtreeproject_id))
  with check (public.owns_tree_project(orgtreeproject_id));

drop policy if exists "admin: read all" on public.org_tree_project_detail;
create policy "admin: read all" on public.org_tree_project_detail
  for select to authenticated using (public.is_admin());


-- ---------------------------------------------------------------------
-- 5) ตารางที่แอปไม่ได้ใช้ผ่านหน้าเว็บ
--    เปิด RLS โดยไม่มี policy = ผู้ใช้ฝั่งเว็บ (anon/authenticated) อ่าน-เขียนไม่ได้เลย
--    (service role / SQL Editor ยังใช้ได้ตามปกติ)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['login_attempts', 'profiles'] loop
    continue when to_regclass('public.' || t) is null;
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 6) Storage
--    bills     : (ระบบเก่า เลิกใช้แล้ว) ไฟล์อยู่ที่ "<org_id>/..." -> โฟลเดอร์แรกต้องเป็น id ตัวเอง
--                ยังคงไว้เพื่อให้องค์กรลบไฟล์เก่าของตัวเองได้ (ปุ่มลบใน dashboard)
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


-- ---------------------------------------------------------------------
-- 7) ตรวจผล: ดูว่าทุกตารางเปิด RLS แล้ว และมี policy อะไรบ้าง
-- ---------------------------------------------------------------------
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
-- select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;
