// lib/bills/types.ts
/* [ปรับปรุง] เปลี่ยนจากชนิดข้อมูลของ Tesseract (Extracted) มาเป็นของ Python PaddleOCR (/api/ocr)
 * OCR ใช้ "ช่วยกรอก" เท่านั้น ข้อมูลบิลอยู่ใน React state ไม่บันทึกลง Supabase */

export type BillType = 'water' | 'electricity' | 'fuel';

export const BILL_TYPE_LABEL: Record<BillType, string> = {
  electricity: 'บิลค่าไฟฟ้า',
  water: 'บิลค่าน้ำประปา',
  fuel: 'บิลน้ำมันเชื้อเพลิง',
};

// หน่วยที่ Python คืนมาในแต่ละประเภทบิล (น้ำ = ลิตร ไม่ใช่ ลบ.ม.)
export type BillUnit = 'kWh' | 'L';
export const BILL_UNIT: Record<BillType, BillUnit> = { electricity: 'kWh', water: 'L', fuel: 'L' };
export const BILL_UNIT_LABEL: Record<BillUnit, string> = { kWh: 'kWh', L: 'ลิตร' };

// [แก้ไข] ชนิดน้ำมันตามที่ extract_fuel_type() ใน Python คืนมา (เดิมมีแค่ diesel | gasoline)
export type FuelType = 'diesel' | 'gasohol_91' | 'gasohol_95' | 'gasohol_e20' | 'gasohol_e85';
export const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: 'diesel', label: 'ดีเซล' },
  { value: 'gasohol_91', label: 'แก๊สโซฮอล์ 91' },
  { value: 'gasohol_95', label: 'แก๊สโซฮอล์ 95' },
  { value: 'gasohol_e20', label: 'แก๊สโซฮอล์ E20' },
  { value: 'gasohol_e85', label: 'แก๊สโซฮอล์ E85' },
];
export const isFuelType = (v: unknown): v is FuelType => FUEL_TYPES.some((f) => f.value === v);

/* [เพิ่ม] ตัวผูกบิลกับช่องกิจกรรม = ค่าในคอลัมน์ activity_detail.ocr_source
 * ต้องตรงกับ check constraint ใน supabase/activity_detail_ocr_source.sql */
export type OcrSource = 'electricity' | 'water' | `fuel:${FuelType}`;
export const OCR_SOURCES: { value: OcrSource; label: string }[] = [
  { value: 'electricity', label: 'บิลค่าไฟฟ้า (kWh)' },
  { value: 'water', label: 'บิลค่าน้ำประปา' },
  ...FUEL_TYPES.map((f) => ({ value: `fuel:${f.value}` as OcrSource, label: `บิลน้ำมัน: ${f.label}` })),
];
// บิล 1 ใบต้องเติมช่องไหน (บิลน้ำมันต้องรู้ชนิดน้ำมันก่อน)
export const ocrSourceOf = (type: BillType, fuel: FuelType | ''): OcrSource | null =>
  type === 'fuel' ? (fuel ? `fuel:${fuel}` : null) : type;

// กิจกรรมที่กำลังบันทึก: month = 'YYYY-MM-01' (ค.ศ.), รายปีใช้ 'YYYY-01-01'
export type ActivityPeriod = { type: 'month' | 'year'; month: string };

/* [เพิ่ม] JSON ที่ POST /api/ocr คืนมา (มาจาก extract_bill_data() ใน Python) */
export type OcrResult = {
  bill_type: BillType | 'unknown';
  bill_number: string | null;
  month: number | null;
  year: number | null;          // ค.ศ.
  fuel_type: string | null;
  quantity: number | null;
  unit: string | null;          // 'kWh' | 'L' | null
  status: string;               // ตอนนี้เป็น 'pending_review' เสมอ
  warnings: string[];
};

export type Check = { level: 'fail' | 'warn' | 'ok'; code: string; message: string };

// [ปิดใช้งาน] ชนิดข้อมูลของระบบ Tesseract เดิม (ดู ocr.ts / parse.ts ที่ถูกคอมเมนต์ไว้)
// export type Extracted = {
//   billType: BillType;
//   source: 'pdf_text' | 'tesseract';
//   billMonth: string | null;      // 'YYYY-MM-01' ค.ศ.
//   periodStart: string | null;    // 'YYYY-MM-DD'
//   periodEnd: string | null;
//   spansTwoMonths: boolean;
//   billDate: string | null;       // ใช้กับบิลน้ำมัน
//   quantity: number | null;
//   unit: 'kWh' | 'm3' | 'L';
//   accountNo: string | null;
//   invoiceNo: string | null;
//   fuelType: 'diesel' | 'gasoline' | null;
//   dedupKey: string | null;
//   confidence: 'high' | 'low';
// };
