-- =====================================================================
-- ตารางของโหมดใหม่ "จำลองโครงการ T-VER จากเป้าหมายการกักเก็บคาร์บอน"
--   องค์กรกรอก: ชื่อโครงการ, เป้าหมาย (tCO2e), ปีที่ t, ชื่อพันธุ์ไม้ (พิมพ์เอง) + ระยะปลูก + แปลงที่มี
--   ระบบคำนวณ: ต้องปลูกกี่ต้น ที่ดินพอไหม ถ้าไม่พอต้องเพิ่มกี่ไร่ (สูตรอยู่ที่ src/app/organization/tver-target/calculation.ts)
--
-- เก็บเฉพาะข้อมูลที่องค์กรกรอก ผลลัพธ์คำนวณใหม่ทุกครั้งจากสูตรเดียวกัน (ไม่เก็บซ้ำ จึงไม่มีทางไม่ตรงกัน)
-- แยกจาก org_tree_project ของโหมดเดิม: ไม่กระทบการจัดสรรคาร์บอนเครดิตและการคำนวณภาษี
--
-- โครงสร้าง: แผน 1 แผน -> มีได้หลายพันธุ์ -> แต่ละพันธุ์มีได้หลายกลุ่มแปลง (ขนาดแปลง × จำนวนแปลง)
--
-- วิธีใช้: รัน supabase/rls.sql และ supabase/sql_syntax_triggers.sql ก่อน
--         (ต้องมีฟังก์ชัน is_admin / is_org / reject_sql_syntax)
--         แล้ว Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
--
-- เงื่อนไข T-VER ที่ "ไม่" ใส่เป็น check ในฐานข้อมูล:
--   แปลงละไม่เกิน 30 ไร่ และพื้นที่รวมไม่เกิน 1,000 ไร่ ตรวจในหน้าเว็บตามเงื่อนไขที่แอดมินตั้งไว้ใน tver_project_detail
--   (แบบเดียวกับโหมดเดิม) ถ้าแอดมินแก้ค่า ระบบจะใช้ค่าใหม่ทันที ไม่ต้องแก้ฐานข้อมูล
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) ตาราง
-- ---------------------------------------------------------------------

-- แผนจำลอง 1 แผนขององค์กร
create table if not exists public.org_tree_target_plan (
  targetplan_id uuid primary key default gen_random_uuid(),
  org_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_name  varchar(150) not null,
  target_tco2e  numeric(12,2) not null check (target_tco2e > 0),               -- เป้าหมายการกักเก็บ (tCO2e)
  target_year   int not null check (target_year between 1 and 10),            -- ปีที่ t (ระยะคิดเครดิตป่าไม้ 10 ปี)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- พันธุ์ไม้ในแผน (1 แผนห้ามมีพันธุ์ซ้ำ)
create table if not exists public.org_tree_target_species (
  targetspecies_id uuid primary key default gen_random_uuid(),
  targetplan_id    uuid not null references public.org_tree_target_plan (targetplan_id) on delete cascade,
  -- องค์กรพิมพ์ชื่อพันธุ์เอง: T-VER ไม่มีรายชื่อพันธุ์ที่อนุญาต (ไม้ยืนต้นใดก็ได้ ยกเว้นไผ่ ต้นจาก)
  tree_name        varchar(100) not null,
  spacing_tree_m   numeric(5,2) not null check (spacing_tree_m >= 1),         -- ระยะห่างระหว่างต้น (ม.)
  spacing_row_m    numeric(5,2) not null check (spacing_row_m >= 1),          -- ระยะห่างระหว่างแถว (ม.)
  sort_order       int not null default 0,                                    -- ลำดับที่องค์กรกรอก (เปิดแผนแล้วเรียงเหมือนเดิม)
  constraint org_tree_target_species_unique_name unique (targetplan_id, tree_name)
);

-- กลุ่มแปลงของแต่ละพันธุ์ เช่น 30 ไร่ × 2 แปลง
create table if not exists public.org_tree_target_plot (
  targetplot_id    uuid primary key default gen_random_uuid(),
  targetspecies_id uuid not null references public.org_tree_target_species (targetspecies_id) on delete cascade,
  plot_size_rai    numeric(6,2) not null check (plot_size_rai > 0),           -- ขนาดแปลง (ไร่)
  plot_count       int not null check (plot_count >= 1),                      -- จำนวนแปลง
  sort_order       int not null default 0                                     -- ลำดับที่องค์กรกรอก
);

-- เผื่อรันไฟล์รุ่นก่อนหน้าไปแล้ว
alter table public.org_tree_target_species add column if not exists sort_order int not null default 0;
alter table public.org_tree_target_plot add column if not exists sort_order int not null default 0;

-- รุ่นก่อนเก็บรหัสพันธุ์ (tree_id อ้าง tree_list) -> เปลี่ยนเป็นชื่อพันธุ์ที่องค์กรพิมพ์เอง
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'org_tree_target_species' and column_name = 'tree_id'
  ) then
    alter table public.org_tree_target_species add column if not exists tree_name varchar(100);
    update public.org_tree_target_species s
      set tree_name = coalesce(t.tree_name, 'ไม่ทราบชื่อพันธุ์')
      from public.tree_list t
      where t.tree_id = s.tree_id and s.tree_name is null;
    update public.org_tree_target_species set tree_name = 'ไม่ทราบชื่อพันธุ์' where tree_name is null;
    alter table public.org_tree_target_species alter column tree_name set not null;
    alter table public.org_tree_target_species drop constraint if exists org_tree_target_species_unique_tree;
    alter table public.org_tree_target_species drop column tree_id;
    alter table public.org_tree_target_species
      add constraint org_tree_target_species_unique_name unique (targetplan_id, tree_name);
  end if;
end $$;

create index if not exists org_tree_target_plan_org_id_idx on public.org_tree_target_plan (org_id);
create index if not exists org_tree_target_species_plan_idx on public.org_tree_target_species (targetplan_id);
create index if not exists org_tree_target_plot_species_idx on public.org_tree_target_plot (targetspecies_id);


-- ---------------------------------------------------------------------
-- 2) สิทธิ์การเข้าถึง (RLS) แบบเดียวกับ rls.sql
--    องค์กรจัดการได้เฉพาะแผนของตัวเอง แอดมินอ่านได้อย่างเดียว
-- ---------------------------------------------------------------------

-- แผนนี้เป็นขององค์กรที่ล็อกอินอยู่หรือไม่
create or replace function public.owns_target_plan(p_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.org_tree_target_plan
    where targetplan_id = p_id and org_id = auth.uid()
  );
$$;

-- พันธุ์ไม้ในแผนนี้เป็นขององค์กรที่ล็อกอินอยู่หรือไม่ (species -> plan -> org_id)
create or replace function public.owns_target_species(p_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.org_tree_target_species s
    join public.org_tree_target_plan p on p.targetplan_id = s.targetplan_id
    where s.targetspecies_id = p_id and p.org_id = auth.uid()
  );
$$;

-- org_tree_target_plan
alter table public.org_tree_target_plan enable row level security;

drop policy if exists "org: own rows" on public.org_tree_target_plan;
create policy "org: own rows" on public.org_tree_target_plan
for all to authenticated
using (org_id = auth.uid())
with check (org_id = auth.uid() and public.is_org());

drop policy if exists "admin: read all" on public.org_tree_target_plan;
create policy "admin: read all" on public.org_tree_target_plan
for select to authenticated
using (public.is_admin());

-- org_tree_target_species (ไม่มี org_id จึงตรวจจากตารางแม่)
alter table public.org_tree_target_species enable row level security;

drop policy if exists "org: own rows" on public.org_tree_target_species;
create policy "org: own rows" on public.org_tree_target_species
for all to authenticated
using (public.owns_target_plan(targetplan_id))
with check (public.owns_target_plan(targetplan_id));

drop policy if exists "admin: read all" on public.org_tree_target_species;
create policy "admin: read all" on public.org_tree_target_species
for select to authenticated
using (public.is_admin());

-- org_tree_target_plot (ตรวจจากพันธุ์ -> แผน)
alter table public.org_tree_target_plot enable row level security;

drop policy if exists "org: own rows" on public.org_tree_target_plot;
create policy "org: own rows" on public.org_tree_target_plot
for all to authenticated
using (public.owns_target_species(targetspecies_id))
with check (public.owns_target_species(targetspecies_id));

drop policy if exists "admin: read all" on public.org_tree_target_plot;
create policy "admin: read all" on public.org_tree_target_plot
for select to authenticated
using (public.is_admin());


-- ---------------------------------------------------------------------
-- 3) ตรวจ Syntax ป้องกัน SQL Injection ที่ชื่อโครงการและชื่อพันธุ์ไม้ (ใช้ trigger กลางจาก sql_syntax_triggers.sql)
-- ---------------------------------------------------------------------
drop trigger if exists trg_target_plan_no_sql on public.org_tree_target_plan;
create trigger trg_target_plan_no_sql
  before insert or update of project_name on public.org_tree_target_plan
  for each row execute function public.reject_sql_syntax('project_name');

drop trigger if exists trg_target_species_no_sql on public.org_tree_target_species;
create trigger trg_target_species_no_sql
  before insert or update of tree_name on public.org_tree_target_species
  for each row execute function public.reject_sql_syntax('tree_name');


-- ---------------------------------------------------------------------
-- ตรวจผล (ลบ -- ข้างหน้าแล้วรันทีละบรรทัด)
-- ---------------------------------------------------------------------
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename like 'org_tree_target%';
-- select tablename, policyname, cmd from pg_policies where schemaname = 'public' and tablename like 'org_tree_target%' order by 1, 2;

-- ให้ Supabase API โหลดโครงสร้างตารางใหม่ทันที
notify pgrst, 'reload schema';
