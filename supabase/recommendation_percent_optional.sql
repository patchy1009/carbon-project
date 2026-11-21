-- % ที่ลดได้ของแนวทางลดคาร์บอน ไม่บังคับกรอก
--   ไม่กรอก = รายงานแสดงแนวทางพร้อมค่าที่พบจากเงื่อนไข (เช่น Fluorescent 40 ดวง) แต่ไม่คำนวณ tCO2e ที่ลดได้
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)

alter table public.carbon_reduction_recommendation alter column percent_min drop not null;
alter table public.carbon_reduction_recommendation alter column carbon_reduction_amount drop not null;
