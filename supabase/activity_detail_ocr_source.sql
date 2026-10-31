-- =====================================================================
-- ผูกรายการกิจกรรม (activity_detail) กับบิลที่อ่านด้วย OCR
-- เพื่อให้หน้าบันทึกกิจกรรมรู้ว่า "ปริมาณจากบิลไฟ" ต้องเติมลงช่องไหน โดยจับคู่ด้วย id จริง ไม่เดาจากชื่อ
-- แอดมินเลือกค่าได้ในหน้า Activity Management (ช่อง "รับข้อมูลจากบิล (OCR)")
-- วิธีใช้: Supabase Dashboard > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- =====================================================================

alter table public.activity_detail
  add column if not exists ocr_source character varying null;

-- ค่าที่ยอมรับ ต้องตรงกับ OCR_SOURCES ใน src/lib/bills/types.ts
--   electricity          = บิลค่าไฟฟ้า (kWh)
--   water                = บิลค่าน้ำประปา (OCR อ่านเป็นลิตร ระบบแปลงตามหน่วยของรายการ)
--   fuel:<ชนิดน้ำมัน>     = บิลน้ำมันแยกตามชนิด (ลิตร) ชนิดต้องตรงกับที่ Python คืนใน fuel_type
alter table public.activity_detail
  drop constraint if exists activity_detail_ocr_source_check;
alter table public.activity_detail
  add constraint activity_detail_ocr_source_check
  check (ocr_source is null or ocr_source in (
    'electricity', 'water',
    'fuel:diesel', 'fuel:gasohol_91', 'fuel:gasohol_95', 'fuel:gasohol_e20', 'fuel:gasohol_e85'
  ));

-- บิลแต่ละแบบเติมได้ช่องเดียว (กันยอดเดียวกันถูกเติม 2 ช่อง = นับซ้ำ)
create unique index if not exists activity_detail_ocr_source_key
  on public.activity_detail (ocr_source)
  where ocr_source is not null;
