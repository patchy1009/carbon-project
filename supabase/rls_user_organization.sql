-- [MERGE aom + cyn2] สิทธิ์ของตาราง user และ organization (ความปลอดภัยแบบ aom)
-- วิธีใช้: รัน supabase/rls.sql ก่อน แล้ว Supabase > SQL Editor > วางทั้งไฟล์นี้ > Run (รันซ้ำได้)
--
-- หลักการ
--   - acc_id = auth.uid() เสมอ (FK ของ org_id ในตารางอื่นชี้ไป auth.users.id)
--   - องค์กรสมัครเอง: เพิ่มแถว user ของตัวเองได้ แต่ต้องเป็น role 'organization' + status 'active' เท่านั้น
--     (กันคนสมัครแล้วส่ง role = 'admin' มาเอง)
--   - การเพิ่มแถวต้องทำหลังยืนยัน OTP (มี session แล้ว) -> ดู src/app/organization/register/page.tsx
--   - องค์กรแก้ได้เฉพาะ username ของตัวเอง (แก้ role/status ไม่ได้)
--   - แอดมินอ่านได้อย่างเดียว ไม่มีสิทธิ์แก้ตาราง user
--     (ถ้าจะระงับบัญชี/สร้างแอดมินใหม่ ให้ทำใน Supabase Dashboard ซึ่งใช้สิทธิ์ service role)


-- ===== ตาราง user =====
alter table public."user" enable row level security;

-- เอาสิทธิ์ "แอดมินจัดการได้ทั้งหมด" จาก rls.sql ออก (แอดมินเหลือแค่อ่าน ผ่าน policy "user: read own")
drop policy if exists "user: admin manage" on public."user";

-- องค์กรเพิ่มแถวของตัวเองตอนสมัคร
drop policy if exists "user: org insert own" on public."user";
create policy "user: org insert own" on public."user"
for insert to authenticated
with check (acc_id = auth.uid() and role = 'organization' and status = 'active');

-- องค์กรแก้แถวของตัวเอง (หน้า account_user แก้ username)
drop policy if exists "user: update own" on public."user";
create policy "user: update own" on public."user"
for update to authenticated
using (acc_id = auth.uid())
with check (acc_id = auth.uid());

-- RLS เลือกได้แค่ "แถว" ไม่ได้เลือก "คอลัมน์" -> จำกัดคอลัมน์ที่แก้ได้ด้วย grant
-- ถ้าไม่ทำ องค์กรจะ update role ของตัวเองเป็น 'admin' ได้
revoke update on public."user" from authenticated, anon;
grant update (username) on public."user" to authenticated;

-- ห้ามลบแถว user ผ่าน API (ไม่มี policy delete = ลบไม่ได้)

-- เช็ก username ซ้ำตอนสมัคร (เรียกจาก src/app/api/auth/register/route.tsx)
-- คนที่ยังไม่ล็อกอินอ่านตาราง user ไม่ได้ จึงใช้ security definer อ่านแทน
-- ตอบแค่ true (ซ้ำ) / false (ไม่ซ้ำ) ไม่คืนข้อมูลอื่นของผู้ใช้
create or replace function public.is_username_taken(p_username text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public."user"
    where username = trim(p_username)
  );
$$;

revoke all on function public.is_username_taken(text) from public;
grant execute on function public.is_username_taken(text) to anon, authenticated;


-- ===== ตาราง organization =====
-- org_id เป็น PK ของตารางนี้เอง, acc_id ชี้ไป auth.users.id
alter table public.organization enable row level security;

drop policy if exists "org: read own" on public.organization;
create policy "org: read own" on public.organization
for select to authenticated
using (acc_id = auth.uid() or public.is_admin());

drop policy if exists "org: insert own" on public.organization;
create policy "org: insert own" on public.organization
for insert to authenticated
with check (acc_id = auth.uid());

drop policy if exists "org: update own" on public.organization;
create policy "org: update own" on public.organization
for update to authenticated
using (acc_id = auth.uid())
with check (acc_id = auth.uid());
