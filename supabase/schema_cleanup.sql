-- ปรับโครงสร้างตาราง (NOT NULL, ลบคอลัมน์ที่ไม่ได้ใช้, rec_uid -> rec_id, period_month -> period_date)
-- วิธีใช้: Supabase > SQL Editor > รัน "ทีละขั้น" ตามลำดับ (ขั้น 0 -> 4) อย่าวางทั้งไฟล์ทีเดียว
--   ขั้น 0   = ตรวจอย่างเดียว ไม่แก้อะไร
--   ขั้น 1-3 = เติมค่า / ตั้ง NOT NULL / ลบคอลัมน์ที่ไม่ได้ใช้
--   ขั้น 4   = เปลี่ยนที่ต้องไปคู่กับโค้ด — โค้ดใน repo แก้ไว้แล้ว (status, rec_id, join_date, period_date)
-- ⚠️ โค้ดใน repo ตอนนี้ใช้โครงสร้างใหม่แล้ว: รันให้ครบถึงขั้น 4 ก่อนเปิดเว็บ ไม่งั้นหน้า Dashboard / บันทึกกิจกรรม /
--    แนวทางลดคาร์บอน / T-VER จะ error ว่าไม่มีคอลัมน์ (period_date, rec_id)
-- ก่อนเริ่ม: Supabase > Database > Backups (หรือ export ตารางที่เกี่ยวข้องเป็น CSV) เผื่อต้องย้อนกลับ
-- ไม่เปลี่ยนตามที่ตกลง: office_info_type.unit, carbon_reduction_recommendation.scopedetail_id และคอลัมน์ den_* (ค่าว่างมีความหมาย)


-- =====================================================================
-- ขั้น 0: ตรวจว่ามีแถวที่จะทำให้ตั้ง NOT NULL ไม่ผ่านไหม (ทุกแถวต้องได้ 0)
-- ถ้าไม่ใช่ 0 ให้ไปขั้น 1 ก่อน
-- =====================================================================
select 'activity.scope_id' as col, count(*) from public.activity where scope_id is null
union all select 'activity.activity_name', count(*) from public.activity where activity_name is null
union all select 'activity_detail.activity_id', count(*) from public.activity_detail where activity_id is null
union all select 'activity_detail.detail_name', count(*) from public.activity_detail where detail_name is null
union all select 'activity_detail.unit', count(*) from public.activity_detail where unit is null
union all select 'admin.acc_id', count(*) from public.admin where acc_id is null
union all select 'carbon_reduction_recommendation.recommendation', count(*) from public.carbon_reduction_recommendation where recommendation is null
union all select 'carbon_reduction_recommendation.admin_id', count(*) from public.carbon_reduction_recommendation where admin_id is null
union all select 'carbon_scope.admin_id', count(*) from public.carbon_scope where admin_id is null
union all select 'carbon_scope.scope_number', count(*) from public.carbon_scope where scope_number is null
union all select 'carbon_scope.scope_name', count(*) from public.carbon_scope where scope_name is null
union all select 'documents.document_name', count(*) from public.documents where document_name is null
union all select 'documents.file_path', count(*) from public.documents where file_path is null
union all select 'documents.admin_id', count(*) from public.documents where admin_id is null
union all select 'ef_type.type_name', count(*) from public.ef_type where type_name is null
union all select 'emission_factor.ef_name', count(*) from public.emission_factor where ef_name is null
union all select 'emission_factor.ef_value', count(*) from public.emission_factor where ef_value is null
union all select 'emission_factor.real_unit', count(*) from public.emission_factor where real_unit is null
union all select 'emission_factor.eftype_id', count(*) from public.emission_factor where eftype_id is null
union all select 'emission_factor.admin_id', count(*) from public.emission_factor where admin_id is null
union all select 'global_warming_potential.gas_name', count(*) from public.global_warming_potential where gas_name is null
union all select 'global_warming_potential.gwp_value', count(*) from public.global_warming_potential where gwp_value is null
union all select 'global_warming_potential.admin_id', count(*) from public.global_warming_potential where admin_id is null
union all select 'office_info_type.info_name', count(*) from public.office_info_type where info_name is null
union all select 'office_info_type.admin_id', count(*) from public.office_info_type where admin_id is null
union all select 'org_activity_detail.orgactlist_id', count(*) from public.org_activity_detail where orgactlist_id is null
union all select 'org_activity_list.org_id', count(*) from public.org_activity_list where org_id is null
union all select 'org_activity_list.orgact_name', count(*) from public.org_activity_list where orgact_name is null
union all select 'org_activity_list.period_month', count(*) from public.org_activity_list where period_month is null
union all select 'org_office_info.info_id', count(*) from public.org_office_info where info_id is null
union all select 'org_tree_project.org_id', count(*) from public.org_tree_project where org_id is null
union all select 'org_tree_project.project_name', count(*) from public.org_tree_project where project_name is null
union all select 'org_tree_project_detail.orgtreeproject_id', count(*) from public.org_tree_project_detail where orgtreeproject_id is null
union all select 'org_tree_project_detail.tverdetail_id', count(*) from public.org_tree_project_detail where tverdetail_id is null
union all select 'org_tree_project_detail.amount', count(*) from public.org_tree_project_detail where amount is null
union all select 'tree_list.admin_id', count(*) from public.tree_list where admin_id is null
union all select 'tree_list.tree_name', count(*) from public.tree_list where tree_name is null
union all select 'tver_project_detail.admin_id', count(*) from public.tver_project_detail where admin_id is null
union all select 'tver_project_detail.detail_name', count(*) from public.tver_project_detail where detail_name is null
union all select 'recommendation_condition: rec_uid ที่หาแม่ไม่เจอ', count(*)
  from public.recommendation_condition c
  where not exists (select 1 from public.carbon_reduction_recommendation r where r.rec_uid = c.rec_uid)
order by 1;


-- =====================================================================
-- ขั้น 1: เติมค่าให้แถวเก่าที่ว่าง (รันเฉพาะข้อที่ขั้น 0 ไม่เป็น 0)
-- =====================================================================

-- 1.0 แนวทางลดคาร์บอนเก่าที่ผิดกฎ recommendation_percent_range (ต้องแก้ก่อน ไม่งั้นข้อ 1.1 แก้แถวไม่ได้)
--     เปอร์เซ็นต์ต้องไม่เกิน 100 และหน้าแอดมินเก็บเป็นช่วง min-max + ค่ากลาง (carbon_reduction_amount)
--     Carpool: เดิม 150 (เกิน 100% น่าจะพิมพ์เกิน) -> ตั้งเป็น 15% ถ้าค่าจริงไม่ใช่ เปลี่ยนตัวเลข 3 ตัวด้านล่าง
--              หรือแก้ภายหลังในหน้าแอดมิน "สำนักงาน & คำแนะนำ"
update public.carbon_reduction_recommendation
set carbon_reduction_amount = 15, percent_min = 15, percent_max = 15
where rec_id = 'ef7a5820-27cc-46a4-80c0-ee18cd91c2ba';
--     หลอด LED: มีค่ากลาง 20 แต่ไม่มีช่วง -> เติมช่วงเป็น 20-20 ให้หน้าแอดมิน/รายงานแสดงถูก
update public.carbon_reduction_recommendation
set percent_min = 20, percent_max = 20
where rec_id = 'b35ad641-e1d1-4b21-9b60-0521cc73633a';

-- 1.1 admin_id ที่ว่าง (แถวที่เพิ่มก่อนตั้งค่า default auth.uid()) -> ใส่เป็นแอดมิน 5763e9e3-e338-4a7d-833e-aca0a328c18d
do $$
declare
  fill_admin constant uuid := '5763e9e3-e338-4a7d-833e-aca0a328c18d';
  t text;
begin
  -- กันพิมพ์ id ผิด: ต้องเป็นบัญชีแอดมินที่มีอยู่จริงในตาราง user
  if not exists (select 1 from public."user" where acc_id = fill_admin and role = 'admin') then
    raise exception 'ไม่พบแอดมิน % ในตาราง user (role = admin)', fill_admin;
  end if;
  foreach t in array array['carbon_reduction_recommendation', 'carbon_scope', 'documents', 'emission_factor',
                           'global_warming_potential', 'office_info_type', 'tree_list', 'tver_project_detail']
  loop
    execute format('update public.%I set admin_id = $1 where admin_id is null', t) using fill_admin;
  end loop;
end $$;

-- 1.2 แถวขององค์กรที่ org_id ว่าง = ไม่มีใครมองเห็นอยู่แล้ว (RLS) -> ดูก่อน แล้วค่อยลบ
select orgactlist_id, orgact_name, created_at from public.org_activity_list where org_id is null;
select orgtreeproject_id, project_name, created_at from public.org_tree_project where org_id is null;
-- ถ้าดูแล้วเป็นข้อมูลทดลอง ลบได้ (เอาเครื่องหมาย -- ออกแล้วรัน):
-- delete from public.org_activity_list where org_id is null;
-- delete from public.org_tree_project where org_id is null;

-- 1.3 org_tree_project: เติม join_date ที่ว่างด้วยวันที่สุ่ม ก่อนจะลบ join_year (ขั้น 4)
--     มี join_year = สุ่มวันในปีนั้น / ไม่มี join_year = สุ่มวันระหว่าง 1 ม.ค. 2024 - 31 ธ.ค. 2026
update public.org_tree_project
set join_date = case
  when join_year is not null
    then make_date(join_year, 1, 1) + floor(random() * 365)::int
  else date '2024-01-01' + floor(random() * (date '2026-12-31' - date '2024-01-01' + 1))::int
end
where join_date is null;

-- 1.4 ตาราง admin: แถวที่ acc_id ว่าง (ผลขั้น 0 = 1 แถว) = ข้อมูลแอดมินที่ไม่ผูกกับบัญชีไหน
--     ถ้ายังไม่มีแถวของแอดมิน 5763e9e3-... ในตาราง admin -> ผูกแถวนี้กับบัญชีนั้น
--     ถ้ามีแถวของบัญชีนั้นอยู่แล้ว -> แถวที่ว่างเป็นแถวซ้ำที่ใช้ไม่ได้ ลบทิ้ง
update public.admin
set acc_id = '5763e9e3-e338-4a7d-833e-aca0a328c18d'
where acc_id is null
  and not exists (select 1 from public.admin where acc_id = '5763e9e3-e338-4a7d-833e-aca0a328c18d');
delete from public.admin where acc_id is null;


-- =====================================================================
-- ขั้น 2: ตั้ง NOT NULL (ข้อที่ขั้น 0 ยังไม่เป็น 0 จะ error ที่บรรทัดนั้น)
-- โค้ดปัจจุบันส่งค่าเหล่านี้ครบอยู่แล้ว รันได้โดยไม่ต้องแก้โค้ด
-- =====================================================================
alter table public.activity
  alter column scope_id set not null,
  alter column activity_name set not null;

alter table public.activity_detail
  alter column activity_id set not null,
  alter column detail_name set not null,
  alter column unit set not null;

alter table public.admin alter column acc_id set not null;

alter table public.carbon_reduction_recommendation
  alter column recommendation set not null,
  alter column admin_id set not null;
-- scopedetail_id ไม่ตั้ง NOT NULL: ค่าว่าง = "แนวทางทั่วไป ไม่ผูกกิจกรรม" (ดูคำอธิบายในแชต)

alter table public.carbon_scope
  alter column admin_id set not null,
  alter column scope_number set not null,
  alter column scope_name set not null;

alter table public.documents
  alter column document_name set not null,
  alter column file_path set not null,
  alter column admin_id set not null;

alter table public.ef_type alter column type_name set not null;

alter table public.emission_factor
  alter column ef_name set not null,
  alter column ef_value set not null,
  alter column real_unit set not null,
  alter column eftype_id set not null,
  alter column admin_id set not null;

alter table public.global_warming_potential
  alter column gas_name set not null,
  alter column gwp_value set not null,
  alter column admin_id set not null;

alter table public.office_info_type
  alter column info_name set not null,
  alter column admin_id set not null;
-- unit ไม่ตั้ง NOT NULL: หน่วยว่าง = หัวข้อที่ให้บริษัทตอบเป็นข้อความ (ดูคำอธิบายในแชต)

alter table public.org_activity_detail alter column orgactlist_id set not null;

alter table public.org_activity_list
  alter column org_id set not null,
  alter column orgact_name set not null,
  alter column period_month set not null;

alter table public.org_office_info alter column info_id set not null;

alter table public.org_tree_project
  alter column org_id set not null,
  alter column project_name set not null;

alter table public.org_tree_project_detail
  alter column orgtreeproject_id set not null,
  alter column tverdetail_id set not null,
  alter column amount set not null;

alter table public.tree_list
  alter column admin_id set not null,
  alter column tree_name set not null;

alter table public.tver_project_detail
  alter column admin_id set not null,
  alter column detail_name set not null;



-- =====================================================================
-- ขั้น 3: ลบคอลัมน์ที่ไม่มีโค้ดไหนใช้ (ตรวจแล้วใน src/)
-- =====================================================================
alter table public.carbon_reduction_recommendation
  drop column if exists reference_note,
  drop column if exists reference_url,
  drop column if exists confidence_level;


-- =====================================================================
-- ขั้น 4: เปลี่ยนที่ต้องแก้โค้ดคู่กัน — โค้ดใน repo แก้ตามรายการด้านล่างไว้แล้ว รันได้เลย
-- =====================================================================

-- 4.1 carbon_reduction_recommendation.status
--     โค้ดที่แก้แล้ว: OfficeRecommendationClient.tsx เอา status: 'published' ออก 2 จุด (แก้ไข/เพิ่มแนวทาง)
--                  และเอา status ออกจาก type RecRow
alter table public.carbon_reduction_recommendation drop column if exists status;

-- 4.2 rec_uid -> rec_id
--     โค้ดที่แก้แล้ว: เปลี่ยน rec_uid เป็น rec_id ทุกจุดใน
--       src/app/admin/officerec/OfficeRecommendationClient.tsx
--       src/lib/recommendation.ts
--       src/app/organization/footprint/report/[id]/page.tsx
alter table public.recommendation_condition add column if not exists rec_id uuid;

update public.recommendation_condition c
set rec_id = r.rec_id
from public.carbon_reduction_recommendation r
where r.rec_uid = c.rec_uid and c.rec_id is null;

-- ต้องได้ 0 ก่อนไปต่อ (ถ้าไม่ใช่ 0 = มีเงื่อนไขที่หาแนวทางแม่ไม่เจอ ให้ลบแถวพวกนั้นก่อน)
select count(*) as conditions_without_parent from public.recommendation_condition where rec_id is null;

alter table public.recommendation_condition alter column rec_id set not null;
alter table public.recommendation_condition drop constraint if exists recommendation_condition_rec_id_fkey;
alter table public.recommendation_condition
  add constraint recommendation_condition_rec_id_fkey
  foreign key (rec_id) references public.carbon_reduction_recommendation (rec_id) on delete cascade;
create index if not exists recommendation_condition_rec_id_idx on public.recommendation_condition (rec_id);

-- ลบ rec_uid: ฝั่งลูกก่อน (FK เดิมหายไปพร้อมคอลัมน์) แล้วค่อยฝั่งแม่
alter table public.recommendation_condition drop column if exists rec_uid;
alter table public.carbon_reduction_recommendation drop column if exists rec_uid;

-- 4.3 org_tree_project.join_year (ใช้ join_date แทน — เติมค่าไว้แล้วในขั้น 1.3)
--     โค้ดที่แก้แล้ว: เอา join_year ออก / เปลี่ยนไปใช้ join_date ใน
--       src/app/organization/dashboard/page.tsx (order by join_year -> join_date)
--       src/app/organization/dashboard/DashboardClient.tsx (ข้อความปีเข้าร่วม + สถานะวางแผน)
--       src/types/dashboard.ts
--       src/app/organization/tver-simulation/TverSimulationClient.tsx (บรรทัดที่บันทึก join_year)
--       src/app/organization/tver_simulation/page.tsx (select + 2 จุดที่ insert)
--       src/app/organization/tax_calculator/page.tsx (select)
alter table public.org_tree_project drop column if exists join_year;

-- 4.4 org_activity_list.period_month -> period_date
--     โค้ดที่แก้แล้ว: เปลี่ยนชื่อทุกจุดใน
--       src/app/organization/dashboard/page.tsx, DashboardClient.tsx
--       src/app/organization/footprint/activity/page.tsx, FootprintClient.tsx
--       src/types/ (ชนิดของ org_activity_list)
--     หมายเหตุ: rename คอลัมน์ ข้อมูลไม่หาย และ index/constraint เดิมตามไปด้วย
alter table public.org_activity_list rename column period_month to period_date;
