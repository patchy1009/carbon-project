-- =====================================================================
-- เปลี่ยนเงื่อนไขโครงการ T-VER จากข้อความ (condition_value เช่น "<= 1000")
-- เป็น 2 คอลัมน์: condition_operator (เลือกจาก dropdown) + condition_number (ตัวเลข)
-- เหตุผล: เอาไปเทียบกับค่าที่องค์กรกรอกได้ตรงๆ ไม่ต้องแกะข้อความ
-- วิธีใช้: Supabase Dashboard > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- ⚠️ ต้องรันก่อนใช้หน้า T-VER เวอร์ชันใหม่ ไม่งั้นบันทึกจะ error ว่าไม่มีคอลัมน์
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) เพิ่มคอลัมน์ใหม่
-- ---------------------------------------------------------------------
alter table public.tver_project_detail
  add column if not exists condition_operator character varying null,
  add column if not exists condition_number numeric null;

-- ตัวดำเนินการต้องเป็นค่าใน dropdown เท่านั้น
alter table public.tver_project_detail
  drop constraint if exists tver_project_detail_condition_operator_check;
alter table public.tver_project_detail
  add constraint tver_project_detail_condition_operator_check
  check (condition_operator is null or condition_operator in ('>', '>=', '<', '<=', '='));

-- ต้องมีทั้งคู่ (มีเงื่อนไข) หรือไม่มีทั้งคู่ (ไม่มีเงื่อนไข)
alter table public.tver_project_detail
  drop constraint if exists tver_project_detail_condition_pair_check;
alter table public.tver_project_detail
  add constraint tver_project_detail_condition_pair_check
  check ((condition_operator is null) = (condition_number is null));

-- ค่าเงื่อนไขห้ามติดลบ
alter table public.tver_project_detail
  drop constraint if exists tver_project_detail_condition_number_check;
alter table public.tver_project_detail
  add constraint tver_project_detail_condition_number_check
  check (condition_number is null or condition_number >= 0);

-- ---------------------------------------------------------------------
-- 2) ย้ายข้อมูลเดิมจาก condition_value มาใส่คอลัมน์ใหม่ แล้วลบคอลัมน์เดิม
--    ทำเฉพาะตอนที่คอลัมน์ condition_value ยังอยู่ (รันไฟล์นี้ซ้ำได้)
--    ถ้ามีแถวที่อ่านไม่ออก จะ "ไม่ลบ" คอลัมน์เดิม และแจ้งรายการให้ไปแก้ก่อน
-- ---------------------------------------------------------------------
do $$
declare
  bad record;
  bad_count int;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tver_project_detail' and column_name = 'condition_value'
  ) then
    raise notice 'ไม่มีคอลัมน์ condition_value แล้ว (ย้ายข้อมูลเสร็จไปก่อนหน้านี้)';
    return;
  end if;

  -- แปลงข้อความ เช่น "<= 1000", ">=10 ปี", "≥ 1,000 ไร่"
  execute $sql$
    update public.tver_project_detail t
    set condition_operator = case
          when p.m[1] in ('≥', '=>') then '>='
          when p.m[1] in ('≤', '=<') then '<='
          else p.m[1]
        end,
        condition_number = replace(p.m[2], ',', '')::numeric
    from (
      select tverdetail_id as id,
             regexp_match(condition_value, '^\s*(>=|<=|=>|=<|≥|≤|>|<|=)\s*([0-9][0-9,]*(?:\.[0-9]+)?)') as m
      from public.tver_project_detail
      where nullif(trim(condition_value), '') is not null and condition_operator is null
    ) p
    where t.tverdetail_id = p.id and p.m is not null
  $sql$;

  -- แถวที่มีข้อความเงื่อนไขแต่แปลงไม่ได้
  execute $sql$
    select count(*) from public.tver_project_detail
    where nullif(trim(condition_value), '') is not null and condition_operator is null
  $sql$ into bad_count;

  if bad_count > 0 then
    for bad in execute $sql$
      select tverdetail_id, detail_name, condition_value from public.tver_project_detail
      where nullif(trim(condition_value), '') is not null and condition_operator is null
    $sql$ loop
      raise notice 'แปลงไม่ได้: % (%) = "%"', bad.detail_name, bad.tverdetail_id, bad.condition_value;
    end loop;
    raise notice 'ยังไม่ลบ condition_value: แก้ % แถวข้างบนก่อน (ใส่ condition_operator/condition_number เอง หรือล้าง condition_value) แล้วรันไฟล์นี้ใหม่', bad_count;
    return;
  end if;

  alter table public.tver_project_detail drop column condition_value;
  raise notice 'ย้ายข้อมูลเสร็จ และลบคอลัมน์ condition_value แล้ว';
end $$;
