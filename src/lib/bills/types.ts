// lib/bills/types.ts
export type BillType = 'water' | 'electricity' | 'fuel';
export type FuelType = 'diesel' | 'gasoline';

// กิจกรรมที่กำลังบันทึก: month = 'YYYY-MM-01' (ค.ศ.), year = 'YYYY-01-01'
export type ActivityPeriod = { type: 'month' | 'year'; month: string };

export type Extracted = {
  billType: BillType;
  source: 'pdf_text' | 'tesseract';
  billMonth: string | null;      // 'YYYY-MM-01' ค.ศ.
  periodStart: string | null;    // 'YYYY-MM-DD'
  periodEnd: string | null;
  spansTwoMonths: boolean;
  billDate: string | null;       // ใช้กับบิลน้ำมัน
  quantity: number | null;
  unit: 'kWh' | 'm3' | 'L';
  accountNo: string | null;
  invoiceNo: string | null;
  fuelType: FuelType | null;
  dedupKey: string | null;
  confidence: 'high' | 'low';
};

export type Check = { level: 'fail' | 'warn' | 'ok'; code: string; message: string };