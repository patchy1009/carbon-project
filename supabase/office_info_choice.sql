-- เงื่อนไขแนวทางลดคาร์บอนแบบ "ตัวเลือก" (ไม่ใช่ตัวเลข)
--   เช่น แนวทาง "เปลี่ยนเป็นหลอด LED" แนะนำเมื่อ ชนิดหลอดไฟ เป็นหนึ่งใน [ฟลูออเรสเซนต์, หลอดไส้]
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
--   ต้องรัน rls.sql มาก่อน (ใช้ฟังก์ชัน is_admin)
--
-- สิ่งที่ไฟล์นี้ทำ
--   1) office_info_type          + คอลัมน์ input_type (ชนิดของหัวข้อ) แทนการเดาจากหน่วย
--   2) office_info_option        ตารางใหม่: ตัวเลือกของหัวข้อแบบ choice
--   3) recommendation_condition  operator เพิ่ม 'in' / 'not_in' และ value ว่างได้ (เงื่อนไขตัวเลือกไม่มีตัวเลข)
--   4) recommendation_condition_option  ตารางใหม่: เงื่อนไขไหนตรงกับตัวเลือกไหน (ตารางเชื่อม)
--   5) RLS ของตารางใหม่ + trigger ตรวจ Syntax คล้าย SQL ของชื่อตัวเลือก
-- org_office_info ไม่ต้องแก้: หัวข้อแบบ choice เก็บ option_id ลงคอลัมน์ amount (เป็นข้อความอยู่แล้ว)


-- ===== 1) ชนิดของหัวข้อข้อมูลสำนักงาน =====
alter table public.office_info_type
  add column if not exists input_type text not null default 'number';

alter table public.office_info_type
  drop constraint if exists office_info_type_input_type_check;
alter table public.office_info_type
  add constraint office_info_type_input_type_check
  check (input_type in ('number', 'percent', 'text', 'choice'));

-- เติมค่าให้หัวข้อเดิมตามกฎที่หน้าเว็บใช้เดาอยู่ (ไม่มีหน่วย = ข้อความ, มี % = เปอร์เซ็นต์, อื่นๆ = ตัวเลข)
-- แตะเฉพาะแถวที่ยังเป็นค่าเริ่มต้น เพื่อให้รันซ้ำแล้วไม่ทับค่าที่แอดมินเปลี่ยนเป็น choice ไปแล้ว
update public.office_info_type
set input_type = case
    when nullif(trim(unit), '') is null then 'text'
    when unit like '%\%%' then 'percent'
    else 'number'
  end
where input_type = 'number';


-- ===== 2) ตัวเลือกของหัวข้อ =====
create table if not exists public.office_info_option (
  option_id  uuid primary key default gen_random_uuid(),
  info_id    uuid not null references public.office_info_type(info_id) on delete cascade,
  label      text not null check (length(trim(label)) between 1 and 100),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (info_id, label)  -- หัวข้อเดียวกันห้ามมีตัวเลือกชื่อซ้ำ
);


-- ===== 3) เงื่อนไขรองรับตัวดำเนินการแบบตัวเลือก =====
-- ลบ check constraint เดิมของ operator (ไม่รู้ชื่อแน่ จึงหาจากนิยามที่อ้างถึง operator)
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.recommendation_condition'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%operator%'
  loop
    execute format('alter table public.recommendation_condition drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.recommendation_condition
  add constraint recommendation_condition_operator_check
  check (operator in ('>', '>=', '<', '<=', '=', 'in', 'not_in'));

-- เงื่อนไขตัวเลือกไม่มีตัวเลขให้เทียบ
alter table public.recommendation_condition alter column value drop not null;

-- ตัวเลข: ต้องมี value / ตัวเลือก: ไม่มี value และไม่ใช้โหมดอัตราส่วน
alter table public.recommendation_condition
  drop constraint if exists recommendation_condition_value_check;
alter table public.recommendation_condition
  add constraint recommendation_condition_value_check
  check (
    (operator in ('in', 'not_in') and value is null and den_source_type is null)
    or (operator not in ('in', 'not_in') and value is not null)
  );


-- ===== 4) ตารางเชื่อม: เงื่อนไข <-> ตัวเลือก =====
create table if not exists public.recommendation_condition_option (
  condition_id uuid not null references public.recommendation_condition(condition_id) on delete cascade,
  option_id    uuid not null references public.office_info_option(option_id) on delete no action,
  primary key (condition_id, option_id)
);
-- ลบเงื่อนไข  -> แถวในตารางนี้หายตาม (cascade)
-- ลบตัวเลือกที่ยังมีเงื่อนไขใช้อยู่ -> ฐานข้อมูลไม่ยอม (no action)
--   ใช้ no action ไม่ใช่ restrict: ตอนลบทั้งหัวข้อ ตัวเลือกและเงื่อนไขถูกลบตามพร้อมกัน (cascade)
--   restrict ตรวจทันทีระหว่างลบ อาจ error ทั้งที่แถวเงื่อนไขกำลังจะถูกลบ / no action ตรวจตอนจบคำสั่ง

-- ฐานข้อมูลที่รันไฟล์รุ่นแรกไปแล้ว (เป็น restrict): เปลี่ยนเป็น no action
alter table public.recommendation_condition_option
  drop constraint if exists recommendation_condition_option_option_id_fkey;
alter table public.recommendation_condition_option
  add constraint recommendation_condition_option_option_id_fkey
  foreign key (option_id) references public.office_info_option(option_id) on delete no action;

create index if not exists recommendation_condition_option_option_idx
  on public.recommendation_condition_option (option_id);


-- ===== 5) สิทธิ์ (RLS): ผู้ที่ล็อกอินอ่านได้ แอดมินเท่านั้นที่เพิ่ม แก้ไข ลบได้ (แบบเดียวกับ rls.sql) =====
alter table public.office_info_option enable row level security;

drop policy if exists "read: authenticated" on public.office_info_option;
create policy "read: authenticated" on public.office_info_option
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.office_info_option;
create policy "write: admin" on public.office_info_option
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table public.recommendation_condition_option enable row level security;

drop policy if exists "read: authenticated" on public.recommendation_condition_option;
create policy "read: authenticated" on public.recommendation_condition_option
for select to authenticated
using (true);

drop policy if exists "write: admin" on public.recommendation_condition_option;
create policy "write: admin" on public.recommendation_condition_option
for all to authenticated
using (public.is_admin())
with check (public.is_admin());


-- ===== ตรวจ Syntax คล้าย SQL ของชื่อตัวเลือก (ถ้ารัน sql_syntax_triggers.sql ไว้แล้ว) =====
do $$
begin
  if exists (select 1 from pg_proc where proname = 'reject_sql_syntax'
             and pronamespace = 'public'::regnamespace) then
    execute 'drop trigger if exists trg_info_option_no_sql on public.office_info_option';
    execute 'create trigger trg_info_option_no_sql
               before insert or update of label on public.office_info_option
               for each row execute function public.reject_sql_syntax(''label'')';
  end if;
end $$;
