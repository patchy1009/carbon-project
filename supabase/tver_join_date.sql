-- เก็บวันที่เข้าร่วมโครงการ T-VER แบบเต็ม เดิมเก็บแค่ปี (join_year)
-- ใช้ดูสถานะโครงการในหน้า Dashboard: ดำเนินการอยู่ / วางแผนการดำเนินการ
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- ต้องรันก่อนใช้หน้าจำลองโครงการเวอร์ชันใหม่ ไม่งั้นบันทึกโครงการจะ error ว่าไม่มีคอลัมน์

alter table public.org_tree_project
  add column if not exists join_date date null;
