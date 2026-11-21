-- ทดสอบ trigger ตรวจ Syntax คล้าย SQL (sql_syntax_triggers.sql + office_info_choice.sql)
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run
-- ไม่เปลี่ยนข้อมูลจริง: ทุกการแก้อยู่ในบล็อกที่ถูกยกเลิก (rollback) เสมอ
--
-- แต่ละคอลัมน์ทดสอบ 2 แบบ กับแถวแรกของตาราง
--   1) ข้อความอันตราย  x' OR 1=1 --   -> ต้องถูกปฏิเสธ (error 22023)
--   2) ข้อความปกติภาษาไทย            -> ต้องบันทึกได้ (ไม่โดนบล็อกผิด)
-- ผลลัพธ์แสดงเป็นตารางท้ายสคริปต์

drop table if exists pg_temp.sql_trigger_test;
create temp table sql_trigger_test (
  table_name text, column_name text, bad_text text, normal_text text
);

do $$
declare
  t text; c text; n int;
  bad_result text; ok_result text;
  targets text[][] := array[
    ['user', 'username'],
    ['organization', 'org_name'],
    ['general_activity_meeting', 'activity_name'],
    ['general_activity_meeting', 'equipment_name'],
    ['general_activity_traveling', 'activity_name'],
    ['project_target_rule', 'target_name'],
    ['project_cost_type', 'cost_name'],
    ['org_tax_assessment_detail', 'cost_name'],
    ['carbon_scope', 'scope_name'],
    ['carbon_scope', 'scope_detail'],
    ['activity', 'activity_name'],
    ['activity_detail', 'detail_name'],
    ['activity_detail', 'unit'],
    ['activity_detail', 'description'],
    ['ef_type', 'type_name'],
    ['emission_factor', 'ef_name'],
    ['emission_factor', 'real_unit'],
    ['global_warming_potential', 'gas_name'],
    ['tree_list', 'tree_name'],
    ['tver_project_detail', 'detail_name'],
    ['tver_project_detail', 'unit'],
    ['tver_project_detail', 'detail'],
    ['office_info_type', 'info_name'],
    ['office_info_type', 'unit'],
    ['office_info_type', 'info_detail'],
    ['office_info_option', 'label'],
    ['carbon_reduction_recommendation', 'recommendation'],
    ['documents', 'document_name'],
    ['org_office_info', 'amount'],
    ['org_activity_list', 'orgact_name'],
    ['org_tree_project', 'project_name']
  ];
begin
  for i in 1 .. array_length(targets, 1) loop
    t := targets[i][1];
    c := targets[i][2];

    -- 1) ข้อความอันตราย
    begin
      execute format(
        'update public.%I set %I = %L where ctid = (select ctid from public.%I limit 1)',
        t, c, 'x'' OR 1=1 --', t);
      get diagnostics n = row_count;
      if n = 0 then
        raise exception 'EMPTY';
      end if;
      raise exception 'SAVED';              -- บันทึกได้ = ไม่มี trigger (ยกเลิกการแก้ด้วย exception นี้)
    exception when others then
      bad_result := case
        when sqlerrm = 'EMPTY' then 'ข้าม (ตารางยังไม่มีข้อมูล)'
        when sqlerrm = 'SAVED' then '❌ ไม่ผ่าน: บันทึกได้ (ไม่มี trigger)'
        when sqlstate = '22023' then '✅ ผ่าน: ถูกปฏิเสธ'
        else '⚠️ error อื่น: ' || sqlerrm
      end;
    end;

    -- 2) ข้อความปกติ
    begin
      execute format(
        'update public.%I set %I = %L where ctid = (select ctid from public.%I limit 1)',
        t, c, 'ทดสอบ ข้อความปกติ ' || i, t);
      get diagnostics n = row_count;
      if n = 0 then
        raise exception 'EMPTY';
      end if;
      raise exception 'SAVED';              -- ยกเลิกการแก้เสมอ
    exception when others then
      ok_result := case
        when sqlerrm = 'EMPTY' then 'ข้าม (ตารางยังไม่มีข้อมูล)'
        when sqlerrm = 'SAVED' then '✅ ผ่าน: บันทึกได้'
        when sqlstate = '22023' then '❌ ไม่ผ่าน: ข้อความปกติถูกบล็อก'
        else '⚠️ error อื่น: ' || sqlerrm
      end;
    end;

    insert into sql_trigger_test values (t, c, bad_result, ok_result);
  end loop;
end $$;

select * from sql_trigger_test order by table_name, column_name;
