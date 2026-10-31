-- =====================================================================
-- แยก "ข้อมูลสำนักงาน" ให้เป็นของแต่ละรายการบันทึก (org_activity_list)
-- เดิม org_office_info มีแค่ org_id -> ทุกรายการขององค์กรใช้ข้อมูลชุดเดียวกัน
--   สร้างรายการใหม่จึงเห็นค่าเก่าค้าง และแก้ค่าแล้วกระทบรายงานของรายการเก่าทุกอัน
-- หลังรันไฟล์นี้: 1 รายการ = ข้อมูลสำนักงาน 1 ชุด ผูกด้วย orgactlist_id
--   และไม่มี org_id แล้ว (รู้ว่าเป็นขององค์กรไหนได้จาก org_activity_list.org_id)
-- วิธีใช้: Supabase Dashboard > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
--
-- โครงสร้างหลังรัน:
--   org_office_info (
--     orginfo_id    uuid  PK
--     orgactlist_id uuid  NOT NULL  FK -> org_activity_list (ลบรายการ = ลบข้อมูลสำนักงานของรายการนั้นตาม)
--     info_id       uuid            FK -> office_info_type   (หัวข้อคำถาม เช่น จำนวนพนักงาน)
--     amount        varchar
--     updated_at    timestamptz
--     UNIQUE (orgactlist_id, info_id)  -- 1 รายการ ตอบหัวข้อละ 1 ค่า
--   )
-- =====================================================================

-- 1) เพิ่มคอลัมน์ผูกกับรายการบันทึก
alter table public.org_office_info
  add column if not exists orgactlist_id uuid null;

alter table public.org_office_info
  drop constraint if exists org_office_info_orgactlist_id_fkey;
alter table public.org_office_info
  add constraint org_office_info_orgactlist_id_fkey
  foreign key (orgactlist_id) references public.org_activity_list (orgactlist_id) on delete cascade;

-- 2) ย้ายข้อมูลเดิม (ทำเฉพาะตอนที่ยังมีคอลัมน์ org_id อยู่ รันซ้ำหลังลบคอลัมน์แล้วจะข้าม)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'org_office_info' and column_name = 'org_id'
  ) then
    -- 2.1 คัดลอกข้อมูลชุดเดิมขององค์กร (orgactlist_id = null) ให้ทุกรายการที่มีอยู่แล้ว
    --     รายงานของรายการเก่าจะยังเห็นข้อมูลสำนักงานเหมือนเดิม
    execute $sql$
      insert into public.org_office_info (org_id, info_id, amount, orgactlist_id)
      select o.org_id, o.info_id, o.amount, l.orgactlist_id
      from public.org_office_info o
      join public.org_activity_list l on l.org_id = o.org_id
      where o.orgactlist_id is null
        and not exists (
          select 1 from public.org_office_info x
          where x.orgactlist_id = l.orgactlist_id and x.info_id = o.info_id
        )
    $sql$;
  end if;

  -- 2.2 ลบแถวชุดเดิมที่ไม่ผูกกับรายการใด (คัดลอกไปแล้วในข้อ 2.1
  --     ที่เหลือคือขององค์กรที่ยังไม่เคยสร้างรายการ ซึ่งไม่มีรายการไหนใช้)
  delete from public.org_office_info where orgactlist_id is null;
end $$;

-- 3) ทุกแถวต้องผูกกับรายการ
alter table public.org_office_info
  alter column orgactlist_id set not null;

-- 4) 1 รายการ ตอบหัวข้อละ 1 ค่า (แทน unique index แบบมีเงื่อนไขของเวอร์ชันก่อน)
drop index if exists public.org_office_info_activity_info_key;
alter table public.org_office_info
  drop constraint if exists org_office_info_orgactlist_info_key;
alter table public.org_office_info
  add constraint org_office_info_orgactlist_info_key unique (orgactlist_id, info_id);

-- 5) ลบคอลัมน์ org_id (ซ้ำซ้อนกับ org_activity_list.org_id)
-- ⚠️ ถ้าเคยรัน supabase/rls.sql ไว้ จะ error ว่า "cannot drop column org_id ... other objects depend on it"
--    เพราะ policy "org: own rows" ของตารางนี้อ้าง org_id อยู่ ให้แก้ RLS ของตารางนี้ก่อนแล้วค่อยรันข้อนี้
--    (ไม่ใช้ CASCADE เพราะจะลบ policy ทิ้งเงียบๆ)
alter table public.org_office_info
  drop column if exists org_id;
