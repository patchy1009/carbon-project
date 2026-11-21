-- แนวทางลดคาร์บอนแบบสูตร (คำนวณจากจำนวนอุปกรณ์ ค่าอ้างอิงอยู่ใน src/lib/measureFormulas.ts)
--   calc_method : percent (แบบเดิม) | lamp_led (เปลี่ยนหลอด Fluorescent เป็น LED) | ac_inverter (เปลี่ยนแอร์ Fixed Speed เป็น Inverter)
--   ชั่วโมงใช้งานต่อวันของสูตร ค้นจากชื่อหัวข้อข้อมูลสำนักงาน "ชั่วโมงทำงานต่อวัน" (ไม่ต้องมีคอลัมน์เพิ่ม)
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
--   ควรรัน recommendation_percent_optional.sql ด้วย (แนวทางแบบสูตรไม่มี %)

-- แถวเก่าที่ว่าง -> percent
update public.carbon_reduction_recommendation set calc_method = 'percent' where calc_method is null;

-- ลบ check เดิมของ calc_method ถ้ามี (ไม่รู้ชื่อแน่ จึงหาจากนิยามที่อ้างถึง calc_method)
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.carbon_reduction_recommendation'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%calc_method%'
  loop
    execute format('alter table public.carbon_reduction_recommendation drop constraint %I', r.conname);
  end loop;
end $$;

-- ค่าเก่าที่ไม่รู้จัก (เช่น ac_replace / refrigerant_leak ที่เคยเตรียมไว้) -> percent ก่อนตั้ง check ใหม่
update public.carbon_reduction_recommendation
set calc_method = 'percent'
where calc_method not in ('percent', 'lamp_led', 'ac_inverter');

alter table public.carbon_reduction_recommendation
  add constraint carbon_reduction_recommendation_calc_method_check
  check (calc_method in ('percent', 'lamp_led', 'ac_inverter'));
