-- ตรวจ Syntax ป้องกัน SQL Injection ในฐานข้อมูลนที่ตรวจฝั่ง server ของทุกหน้า สำหรับตารางของฟีเจอร์
-- กฎตรงกับ src/lib/sqlSyntax.ts ทุกข้อ (STRONG / WEAK / โหมด lenient) ถ้าแก้ไฟล์นั้น ต้องแก้ที่นี่ให้ตรงกันด้วย
-- ทำงานเป็น trigger: ทุกครั้งที่เพิ่มหรือแก้ข้อมูล ถ้าข้อความคล้ายคำสั่ง SQL ฐานข้อมูลจะปฏิเสธ ไม่ว่าข้อมูลจะมาจากหน้าเว็บ API หรือยิงตรงเข้า Supabase
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
--
-- ต่างจาก JavaScript ที่ต้องรู้: \b ของ JS ใน Postgres ไม่มี จึงใช้ (?<![a-z0-9_]) / (?![a-z0-9_]) แทน
--   และใช้ [a-z0-9_] แทน \w, [0-9] แทน \d เพื่อให้นับเฉพาะอักษรอังกฤษเหมือน JS (Postgres นับอักษรไทยเป็น \w ด้วย)

create or replace function public.contains_sql_syntax(p_value text, p_lenient boolean default false)
returns boolean
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  s text;
  re text;
  -- รูปแบบที่เป็นคำสั่ง SQL ชัดเจน = STRONG ใน sqlSyntax.ts
  strong text[] := array[
    $p$(?<![a-z0-9_])union(?![a-z0-9_])(\s+all)?\s+select(?![a-z0-9_])$p$,
    $p$(?<![a-z0-9_])select(?![a-z0-9_])[^;]{0,200}?(?<![a-z0-9_])from(?![a-z0-9_])\s+[a-z0-9_.\"]+$p$,
    $p$(?<![a-z0-9_])insert\s+into(?![a-z0-9_])$p$,
    $p$(?<![a-z0-9_])update(?![a-z0-9_])\s+[a-z0-9_.\"]+\s+set(?![a-z0-9_])$p$,
    $p$(?<![a-z0-9_])delete\s+from(?![a-z0-9_])$p$,
    $p$(?<![a-z0-9_])(drop|alter|truncate|create)\s+(table|database|schema|view|function|role|user|index|policy|extension)(?![a-z0-9_])$p$,
    $p$(?<![a-z0-9_])xp_[a-z0-9_]+|(?<![a-z0-9_])sp_executesql(?![a-z0-9_])$p$,
    $p$(?<![a-z0-9_])(pg_sleep|benchmark|sleep)\s*\(\s*[0-9]$p$,
    $p$(?<![a-z0-9_])waitfor\s+delay(?![a-z0-9_])$p$,
    $p$(?<![a-z0-9_])(information_schema|pg_catalog|pg_shadow|pg_user|pg_read_file|sqlite_master)(?![a-z0-9_])$p$,
    $p$(?<![a-z0-9_])auth\.users(?![a-z0-9_])$p$,
    $p$(?<![a-z0-9_])(or|and)\s+['\"`]?[a-z0-9_.]+['\"`]?\s*(=|<>|!=|<=|>=|<|>|(?<![a-z0-9_])like(?![a-z0-9_]))\s*['\"`]?[a-z0-9_.]+$p$,
    $p$(?<![a-z0-9_])(or|and)\s*\(\s*['\"`]?[a-z0-9_.]+['\"`]?\s*(=|<>|!=|<|>)$p$,
    $p$['\"`]\s*(or|and)\s*['\"`(0-9]$p$,
    $p$['\"`]\s*(;|--|/\*)$p$
  ];
  -- อักขระ/โทเคนเดี่ยวที่ใช้ตัดต่อคำสั่งในโหมดปกติเท่านั้น = WEAK ใน sqlSyntax.ts
  weak text[] := array[
    $p$--$p$,
    $p$/\*$p$,
    $p$\*/$p$,
    $p$;$p$
  ];
begin
  if p_value is null then
    return false;
  end if;

  -- เตรียมข้อความแบบเดียวกับ prepare() ใน sqlSyntax.ts:
  --   แปลงอักขระเต็มความกว้างเป็นปกติ ตัดตัวอักษรล่องหน ยุบช่องว่าง และตัวพิมพ์เล็ก
  s := normalize(p_value, NFKC);
  s := regexp_replace(s, '[' || chr(8203) || '-' || chr(8205) || chr(8288) || chr(65279) || chr(173) || ']', '', 'g');
  s := lower(regexp_replace(s, '\s+', ' ', 'g'));

  if s = '' then
    return false;
  end if;

  foreach re in array strong loop
    if s ~ re then
      return true;
    end if;
  end loop;

  if p_lenient then
    return false;
  end if;

  foreach re in array weak loop
    if s ~ re then
      return true;
    end if;
  end loop;

  return false;
end;
$fn$;

-- trigger กลาง: ตรวจคอลัมน์ที่ระบุใน argument ของ trigger ถ้าคล้ายคำสั่ง SQL -> ปฏิเสธการบันทึก
create or replace function public.reject_sql_syntax()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  col text;
begin
  foreach col in array TG_ARGV loop
    if public.contains_sql_syntax(to_jsonb(NEW) ->> col) then
      raise exception 'ข้อมูลที่กรอกมีรูปแบบที่ไม่อนุญาต (คล้ายคำสั่ง SQL) กรุณากรอกใหม่'
        using errcode = '22023';
    end if;
  end loop;
  return NEW;
end;
$fn$;

-- ===== ติดตั้ง trigger =====

-- ชื่อผู้ใช้ และชื่อองค์กร
drop trigger if exists trg_user_no_sql on public."user";
create trigger trg_user_no_sql
  before insert or update of username on public."user"
  for each row execute function public.reject_sql_syntax('username');

drop trigger if exists trg_organization_no_sql on public.organization;
create trigger trg_organization_no_sql
  before insert or update of org_name on public.organization
  for each row execute function public.reject_sql_syntax('org_name');

-- กิจกรรมทั่วไป ประชุม เดินทาง
drop trigger if exists trg_meeting_no_sql on public.general_activity_meeting;
create trigger trg_meeting_no_sql
  before insert or update of activity_name, equipment_name on public.general_activity_meeting
  for each row execute function public.reject_sql_syntax('activity_name', 'equipment_name');

drop trigger if exists trg_traveling_no_sql on public.general_activity_traveling;
create trigger trg_traveling_no_sql
  before insert or update of activity_name on public.general_activity_traveling
  for each row execute function public.reject_sql_syntax('activity_name');

-- เป้าหมายโครงการ และรายการต้นทุนมาตรฐานของแอดมิน
drop trigger if exists trg_target_no_sql on public.project_target_rule;
create trigger trg_target_no_sql
  before insert or update of target_name on public.project_target_rule
  for each row execute function public.reject_sql_syntax('target_name');

drop trigger if exists trg_cost_type_no_sql on public.project_cost_type;
create trigger trg_cost_type_no_sql
  before insert or update of cost_name on public.project_cost_type
  for each row execute function public.reject_sql_syntax('cost_name');

-- ชื่อค่าใช้จ่ายในผลประเมินภาษี
drop trigger if exists trg_tax_detail_no_sql on public.org_tax_assessment_detail;
create trigger trg_tax_detail_no_sql
  before insert or update of cost_name on public.org_tax_assessment_detail
  for each row execute function public.reject_sql_syntax('cost_name');


-- ===== ตารางที่เพิ่มภายหลัง: ครอบคลุมทุกช่องข้อความที่ผู้ใช้กรอก (ทั้งแอดมินและองค์กร) =====
-- ชื่อตาราง/คอลัมน์ตรงกับที่หน้าเว็บบันทึก (ช่องตัวเลข / id / วันที่ ไม่ต้องตรวจ เพราะชนิดคอลัมน์รับแต่ค่าแบบนั้น)

-- [แอดมิน] Scope / กิจกรรม / รายการย่อย (admin/activities)
drop trigger if exists trg_scope_no_sql on public.carbon_scope;
create trigger trg_scope_no_sql
  before insert or update of scope_name, scope_detail on public.carbon_scope
  for each row execute function public.reject_sql_syntax('scope_name', 'scope_detail');

drop trigger if exists trg_activity_no_sql on public.activity;
create trigger trg_activity_no_sql
  before insert or update of activity_name on public.activity
  for each row execute function public.reject_sql_syntax('activity_name');

drop trigger if exists trg_activity_detail_no_sql on public.activity_detail;
create trigger trg_activity_detail_no_sql
  before insert or update of detail_name, unit, description on public.activity_detail
  for each row execute function public.reject_sql_syntax('detail_name', 'unit', 'description');

-- [แอดมิน] ประเภท EF / ค่า EF / ค่า GWP (admin/ef-gwp)
drop trigger if exists trg_ef_type_no_sql on public.ef_type;
create trigger trg_ef_type_no_sql
  before insert or update of type_name on public.ef_type
  for each row execute function public.reject_sql_syntax('type_name');

drop trigger if exists trg_emission_factor_no_sql on public.emission_factor;
create trigger trg_emission_factor_no_sql
  before insert or update of ef_name, real_unit on public.emission_factor
  for each row execute function public.reject_sql_syntax('ef_name', 'real_unit');

drop trigger if exists trg_gwp_no_sql on public.global_warming_potential;
create trigger trg_gwp_no_sql
  before insert or update of gas_name on public.global_warming_potential
  for each row execute function public.reject_sql_syntax('gas_name');

-- [แอดมิน] พันธุ์ไม้ / หัวข้อโครงการ T-VER (admin/tver)
drop trigger if exists trg_tree_no_sql on public.tree_list;
create trigger trg_tree_no_sql
  before insert or update of tree_name on public.tree_list
  for each row execute function public.reject_sql_syntax('tree_name');

drop trigger if exists trg_tver_detail_no_sql on public.tver_project_detail;
create trigger trg_tver_detail_no_sql
  before insert or update of detail_name, unit, detail on public.tver_project_detail
  for each row execute function public.reject_sql_syntax('detail_name', 'unit', 'detail');

-- [แอดมิน] หัวข้อข้อมูลสำนักงาน / แนวทางลดคาร์บอน (admin/officerec)
--   ชื่อตัวเลือก (office_info_option.label) มี trigger อยู่ใน office_info_choice.sql แล้ว
drop trigger if exists trg_info_type_no_sql on public.office_info_type;
create trigger trg_info_type_no_sql
  before insert or update of info_name, unit, info_detail on public.office_info_type
  for each row execute function public.reject_sql_syntax('info_name', 'unit', 'info_detail');

drop trigger if exists trg_recommendation_no_sql on public.carbon_reduction_recommendation;
create trigger trg_recommendation_no_sql
  before insert or update of recommendation on public.carbon_reduction_recommendation
  for each row execute function public.reject_sql_syntax('recommendation');

-- [แอดมิน] ชื่อเอกสาร (admin/allotaxdoc)
drop trigger if exists trg_documents_no_sql on public.documents;
create trigger trg_documents_no_sql
  before insert or update of document_name on public.documents
  for each row execute function public.reject_sql_syntax('document_name');

-- [องค์กร] ข้อมูลสำนักงานที่กรอก / ชื่อรายการบันทึก / ชื่อโครงการ T-VER
drop trigger if exists trg_org_office_info_no_sql on public.org_office_info;
create trigger trg_org_office_info_no_sql
  before insert or update of amount on public.org_office_info
  for each row execute function public.reject_sql_syntax('amount');

drop trigger if exists trg_activity_list_no_sql on public.org_activity_list;
create trigger trg_activity_list_no_sql
  before insert or update of orgact_name on public.org_activity_list
  for each row execute function public.reject_sql_syntax('orgact_name');

drop trigger if exists trg_tree_project_no_sql on public.org_tree_project;
create trigger trg_tree_project_no_sql
  before insert or update of project_name on public.org_tree_project
  for each row execute function public.reject_sql_syntax('project_name');
