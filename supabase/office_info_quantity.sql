-- จำนวนของแต่ละตัวเลือก ในหัวข้อข้อมูลสำนักงานแบบตัวเลือก
--   เช่น หัวข้อ "ชนิดหลอดไฟ" (หน่วย: ดวง) -> LED 30 ดวง, Fluorescent 20 ดวง
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
--   ต้องรัน rls.sql และ office_info_choice.sql มาก่อน
--
-- โครงสร้าง
--   office_info_type.has_quantity = true  -> หัวข้อแบบตัวเลือกนี้ให้กรอกจำนวนของทุกตัวเลือก (หน่วยใช้ office_info_type.unit)
--                                  false -> เลือกค่าเดียวจาก dropdown แบบเดิม
--   org_activity_list (รายการบันทึก)
--     └─ org_office_info (หัวข้อของรายการนี้, amount ว่างสำหรับหัวข้อที่กรอกจำนวน)   orginfo_id
--          └─ org_office_info_option (จำนวนของแต่ละตัวเลือก)                       orginfooption_id
--
-- ยังไม่ได้บังคับว่า option_id ต้องเป็นตัวเลือกของหัวข้อเดียวกับแถวแม่ (หน้าเว็บส่งเฉพาะตัวเลือกของหัวข้อนั้นอยู่แล้ว)


-- ===== 1) หัวข้อแบบตัวเลือก: กรอกจำนวนไหม =====
alter table public.office_info_type
  add column if not exists has_quantity boolean not null default false;


-- ===== 2) จำนวนของแต่ละตัวเลือก =====
create table if not exists public.org_office_info_option (
  orginfooption_id uuid primary key default gen_random_uuid(),
  orginfo_id  uuid not null references public.org_office_info(orginfo_id) on delete cascade,
  option_id   uuid not null references public.office_info_option(option_id) on delete no action,
  quantity    numeric(14,4) not null check (quantity >= 0),
  updated_at  timestamptz not null default now(),
  unique (orginfo_id, option_id)  -- ตัวเลือกเดียวกันห้ามซ้ำในหัวข้อเดียวกัน
);
-- orginfo_id cascade  : ลบหัวข้อของรายการ (หรือลบทั้งรายการ) -> จำนวนหายตาม
-- option_id no action : แอดมินลบตัวเลือกที่องค์กรกรอกจำนวนไว้แล้วไม่ได้
--                       (ลบทั้งหัวข้อได้ เพราะแถวที่เกี่ยวข้องถูกลบตามในคำสั่งเดียวกัน แล้วค่อยตรวจตอนจบคำสั่ง)

create index if not exists org_office_info_option_option_idx
  on public.org_office_info_option (option_id);


-- ===== 3) สิทธิ์ (RLS): แบบเดียวกับ org_office_info =====
-- แถวแม่ (org_office_info) นี้เป็นของรายการที่องค์กรที่ล็อกอินเป็นเจ้าของหรือไม่
create or replace function public.owns_office_info(p_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.org_office_info i
    join public.org_activity_list l on l.orgactlist_id = i.orgactlist_id
    where i.orginfo_id = p_id and l.org_id = auth.uid()
  );
$$;

alter table public.org_office_info_option enable row level security;

drop policy if exists "org: own rows" on public.org_office_info_option;
create policy "org: own rows" on public.org_office_info_option
for all to authenticated
using (public.owns_office_info(orginfo_id))
with check (public.owns_office_info(orginfo_id));

drop policy if exists "admin: read all" on public.org_office_info_option;
create policy "admin: read all" on public.org_office_info_option
for select to authenticated
using (public.is_admin());
