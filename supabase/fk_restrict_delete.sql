-- เปลี่ยนกฎ "เมื่อลบแถวแม่" ของ foreign key 3 ตัว จาก SET NULL -> RESTRICT
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
--
-- ทำไม: SET NULL ทำให้ข้อมูลเสียแบบเงียบๆ
--   1) emission_factor.eftype_id -> ef_type
--        ลบประเภท EF แล้วค่า EF กลายเป็น "ไม่มีประเภท" (หรือ error ถ้าคอลัมน์เป็น NOT NULL)
--   2) general_activity_meeting.ef_id   -> emission_factor
--   3) general_activity_traveling.ef_id -> emission_factor
--        แอดมินลบค่า EF แล้ว "กิจกรรมพิเศษ" ที่องค์กรบันทึกไว้จะเสียค่า EF ไป
--        หน้าเว็บของแอดมินตรวจก่อนลบไม่ได้ เพราะ RLS ให้แต่ละองค์กรเห็นเฉพาะแถวของตัวเอง
--        จึงต้องให้ฐานข้อมูลเป็นคนกัน
-- หลังรัน: ลบแถวแม่ที่ยังถูกอ้างถึงจะ error 23503 -> หน้าเว็บแจ้ง
--   "ข้อมูลนี้ถูกใช้งานอยู่ในส่วนอื่น ต้องลบข้อมูลที่อ้างถึงก่อน" (supabaseCrud.ts deleteRecord)

do $$
declare
  r record;
  fk_name text;
begin
  for r in
    select * from (values
      ('emission_factor',            'eftype_id', 'ef_type',         'eftype_id'),
      ('general_activity_meeting',   'ef_id',     'emission_factor', 'ef_id'),
      ('general_activity_traveling', 'ef_id',     'emission_factor', 'ef_id')
    ) as t(child, col, parent, parent_col)
  loop
    -- หาชื่อ constraint เดิม (ชื่ออาจไม่ตรงรูปแบบ <ตาราง>_<คอลัมน์>_fkey)
    select tc.constraint_name into fk_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = r.child
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = r.col
    limit 1;

    if fk_name is not null then
      execute format('alter table public.%I drop constraint %I', r.child, fk_name);
    end if;

    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.%I (%I) on update cascade on delete restrict',
      r.child, r.child || '_' || r.col || '_fkey', r.col, r.parent, r.parent_col
    );
  end loop;
end $$;

-- ตรวจผล: ทั้ง 3 แถวต้องเป็น RESTRICT
select tc.table_name, kcu.column_name, rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
join information_schema.referential_constraints rc
  on tc.constraint_name = rc.constraint_name and tc.table_schema = rc.constraint_schema
where tc.table_schema = 'public'
  and (tc.table_name, kcu.column_name) in
      (('emission_factor', 'eftype_id'), ('general_activity_meeting', 'ef_id'), ('general_activity_traveling', 'ef_id'));
