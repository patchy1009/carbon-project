// lib/bills/useBillOcr.ts
'use client';
/* [ปรับปรุง] อ่านบิลด้วย Python PaddleOCR ผ่าน POST /api/ocr (เดิมเรียก /api/bills/extract ที่ใช้ Tesseract)
 * - ข้อมูลบิลเก็บใน React state เท่านั้น ไม่บันทึกรูปหรือผล OCR ลง Supabase
 * - เลิกค้นบิลซ้ำจากตาราง org_bill_file (dupes.ts) -> ตรวจซ้ำระหว่างบิลในหน้านี้แทน (checks.ts)
 * - ผู้ใช้ตรวจแก้ทุกช่องได้ แล้วกด "ยืนยัน" ก่อนบิลจะถูกนำไปรวมยอดและเติมลงฟอร์ม */
import { useCallback, useState } from 'react';
import { isFuelType, type BillType, type FuelType, type OcrResult } from './types';

export type PendingBill = {
  uid: string;
  file: File;
  slot: BillType;                // หมวดที่ผู้ใช้แนบ (ช่องบิลไฟ / น้ำ / น้ำมัน)
  status: 'reading' | 'ready' | 'error';
  error?: string;                // ไฟล์ใช้ไม่ได้ (ต้องเอาออก)
  note?: string;                 // อ่านอัตโนมัติไม่สำเร็จ ให้กรอกเอง
  fileHash?: string;             // กันแนบไฟล์เดียวกันซ้ำ
  ocr?: OcrResult;               // ผลดิบจาก OCR (ไว้แสดงคำเตือนของ OCR)

  // ---- ค่าที่ผู้ใช้ตรวจ/แก้ได้ (ค่าเริ่มต้นมาจาก OCR) ----
  billType: BillType | '';       // ประเภทที่อ่านได้จากบิลจริง ('' = อ่านไม่ได้)
  billNumber: string;
  month: number;                 // 1-12, 0 = ยังไม่ระบุ
  year: number;                  // ค.ศ., 0 = ยังไม่ระบุ
  fuelType: FuelType | '';
  quantity: string;              // หน่วยตาม BILL_UNIT (ไฟ kWh, น้ำ/น้ำมัน ลิตร)

  ack: boolean;                  // รับทราบคำเตือนแล้ว
  confirmed: boolean;            // ผู้ใช้กดยืนยันข้อมูลแล้ว (เฉพาะบิลที่ยืนยันจึงถูกนำไปรวมยอด)
};

export type BillEdit = Partial<
  Pick<PendingBill, 'billType' | 'billNumber' | 'month' | 'year' | 'fuelType' | 'quantity' | 'ack' | 'confirmed'>
>;

async function sha256(file: File) {
  const d = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* แปลง JSON จาก Python -> ค่าเริ่มต้นของฟอร์มตรวจบิล (ค่าที่ผิดรูปแบบถือว่าอ่านไม่ได้) */
function fromOcr(ocr: OcrResult): BillEdit {
  const month = Number.isInteger(ocr.month) && ocr.month! >= 1 && ocr.month! <= 12 ? ocr.month! : 0;
  const year = Number.isInteger(ocr.year) && ocr.year! >= 2000 && ocr.year! <= 2100 ? ocr.year! : 0;
  const qty = typeof ocr.quantity === 'number' && Number.isFinite(ocr.quantity) && ocr.quantity >= 0 ? ocr.quantity : null;
  return {
    billType: ocr.bill_type === 'unknown' ? '' : ocr.bill_type,
    billNumber: ocr.bill_number?.trim() ?? '',
    month,
    year,
    fuelType: isFuelType(ocr.fuel_type) ? ocr.fuel_type : '',
    quantity: qty === null ? '' : String(qty),
  };
}

export function useBillOcr() {
  const [items, setItems] = useState<PendingBill[]>([]);

  const patch = useCallback(
    (id: string, p: Partial<PendingBill>) =>
      setItems((prev) => prev.map((i) => (i.uid === id ? { ...i, ...p } : i))),
    [],
  );

  const read = useCallback(
    async (it: PendingBill) => {
      try {
        const fileHash = await sha256(it.file);
        const fd = new FormData();
        fd.append('file', it.file);
        const res = await fetch('/api/ocr', { method: 'POST', body: fd });
        const json = await res.json().catch(() => ({}));

        if (res.ok) {
          const ocr = json as OcrResult;
          patch(it.uid, { status: 'ready', fileHash, ocr, ...fromOcr(ocr) });
          return;
        }
        if (res.status === 401) {
          patch(it.uid, { status: 'error', fileHash, error: 'หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่' });
          return;
        }
        // 400/413/415/422 = ไฟล์ใช้ไม่ได้ (ชนิดไม่รองรับ / ใหญ่เกิน / อ่านข้อความไม่ได้) ให้เอาออก
        if (res.status >= 400 && res.status < 500) {
          patch(it.uid, { status: 'error', fileHash, error: json.error ?? 'ไฟล์ไม่ถูกต้อง' });
          return;
        }
        // 5xx = ระบบ OCR ล่ม/ช้าเกิน -> ไม่ต้องทิ้งไฟล์ ให้ผู้ใช้กรอกข้อมูลบิลเอง
        patch(it.uid, {
          status: 'ready',
          fileHash,
          billType: it.slot,
          note: `อ่านอัตโนมัติไม่สำเร็จ (${json.error ?? 'ระบบ OCR ไม่ตอบสนอง'}) กรุณากรอกข้อมูลบิลเอง`,
        });
      } catch {
        patch(it.uid, {
          status: 'ready',
          billType: it.slot,
          note: 'เชื่อมต่อระบบ OCR ไม่สำเร็จ กรุณากรอกข้อมูลบิลเอง',
        });
      }
    },
    [patch],
  );

  // เรียกจาก handleFiles หลังกรองชนิด/ขนาด/จำนวนไฟล์แล้ว
  const add = useCallback(
    (slot: BillType, files: File[]) => {
      const fresh: PendingBill[] = files.map((file) => ({
        uid: crypto.randomUUID(), file, slot, status: 'reading',
        billType: '', billNumber: '', month: 0, year: 0, fuelType: '', quantity: '',
        ack: false, confirmed: false,
      }));
      setItems((prev) => [...prev, ...fresh]);
      // อ่านทีละไฟล์ (Python โหลดโมเดลตัวเดียว ส่งพร้อมกันจะรอคิวอยู่ดี)
      (async () => { for (const it of fresh) await read(it); })();
    },
    [read],
  );

  const remove = useCallback((id: string) => setItems((p) => p.filter((i) => i.uid !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  // แก้ค่าใดๆ (ยกเว้นกดยืนยัน/รับทราบเอง) -> ยกเลิกการยืนยันและการรับทราบเดิม ให้ตรวจใหม่
  const edit = useCallback(
    (id: string, p: BillEdit) => {
      const isDataEdit = Object.keys(p).some((k) => k !== 'ack' && k !== 'confirmed');
      patch(id, isDataEdit ? { ...p, ack: false, confirmed: false } : p);
    },
    [patch],
  );

  return { items, add, remove, clear, edit };
}

// [ปิดใช้งาน] ของเดิม: กุญแจกันซ้ำ/ค้นซ้ำจาก org_bill_file และการเรียก /api/bills/extract (Tesseract)
// export function keyOf(...) / export const isEdited = (...) / findDuplicate(orgId, ...) ดูประวัติใน git
