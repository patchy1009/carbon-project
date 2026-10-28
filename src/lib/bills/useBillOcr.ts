// lib/bills/useBillOcr.ts
'use client';
import { useCallback, useState } from 'react';
import { findDuplicate } from './dupes';
import { runChecks } from './checks';
import type { ActivityPeriod, BillType, Check, Extracted, FuelType } from './types';

export type PendingBill = {
  uid: string;
  file: File;
  type: BillType;
  status: 'reading' | 'ready' | 'error';
  error?: string;
  note?: string;                 // เช่น อ่านอัตโนมัติไม่สำเร็จ
  fileHash?: string;
  extracted?: Extracted;
  billMonth: string;             // 'YYYY-MM-01' หรือ '' (ผู้ใช้แก้ได้)
  quantity: string;              // ผู้ใช้แก้ได้
  fuelType: FuelType | '';
  dup: Check | null;             // ผลค้นซ้ำจากฐานข้อมูล
  ack: boolean;                  // ผู้ใช้กดรับทราบคำเตือน
};

const blank = (billType: BillType): Extracted => ({
  billType, source: 'tesseract', billMonth: null, periodStart: null, periodEnd: null,
  spansTwoMonths: false, billDate: null, quantity: null,
  unit: billType === 'electricity' ? 'kWh' : billType === 'water' ? 'm3' : 'L',
  accountNo: null, invoiceNo: null, fuelType: null, dedupKey: null, confidence: 'low',
});

async function sha256(file: File) {
  const d = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// กุญแจกันซ้ำ (คำนวณใหม่เมื่อผู้ใช้แก้เดือน)
export function keyOf(it: Pick<PendingBill, 'type' | 'billMonth' | 'extracted'>): string | null {
  const ex = it.extracted;
  if (!ex) return null;
  if (it.type === 'fuel') return ex.dedupKey;
  return ex.accountNo && it.billMonth ? `${it.type}|${ex.accountNo}|${it.billMonth}` : null;
}

export const isEdited = (it: PendingBill) =>
  it.billMonth !== (it.extracted?.billMonth ?? '') ||
  it.quantity !== (it.extracted?.quantity?.toString() ?? '');

export function useBillOcr(orgId: string, period: ActivityPeriod) {
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

        // ไฟล์เดียวกันเคยแนบแล้ว: ไม่ต้องเสียเวลา OCR
        const fileDup = await findDuplicate(orgId, it.type, fileHash, null);
        if (fileDup) {
          patch(it.uid, { status: 'ready', fileHash, dup: fileDup, extracted: blank(it.type) });
          return;
        }

        const fd = new FormData();
        fd.append('file', it.file);
        fd.append('billType', it.type);
        fd.append('activityType', period.type);
        fd.append('activityMonth', period.month);
        const res = await fetch('/api/bills/extract', { method: 'POST', body: fd });
        const json = await res.json().catch(() => ({}));

        // 4xx = ไฟล์ใช้ไม่ได้ (PDF สแกน, ใหญ่เกิน, ชนิดไม่รองรับ) ให้เอาออก
        if (res.status >= 400 && res.status < 500 && res.status !== 413) {
          patch(it.uid, { status: 'error', error: json.error ?? 'ไฟล์ไม่ถูกต้อง' });
          return;
        }
        // 5xx = อ่านอัตโนมัติพัง ให้ผู้ใช้กรอกเองแทน
        const ex: Extracted = res.ok ? json.extracted : blank(it.type);
        const dup = await findDuplicate(orgId, it.type, fileHash, ex.dedupKey);
        patch(it.uid, {
          status: 'ready',
          fileHash,
          extracted: ex,
          dup,
          billMonth: ex.billMonth ?? '',
          quantity: ex.quantity?.toString() ?? '',
          fuelType: ex.fuelType ?? '',
          note: res.ok ? undefined : 'อ่านอัตโนมัติไม่สำเร็จ กรุณากรอกเดือนและปริมาณเอง',
        });
      } catch {
        patch(it.uid, { status: 'error', error: 'เชื่อมต่อไม่สำเร็จ ลองใหม่' });
      }
    },
    [orgId, period.type, period.month, patch],
  );

  // เรียกจาก handleFiles หลังกรองโควตาและไฟล์ซ้ำในรอบเดียวกันแล้ว
  const add = useCallback(
    (type: BillType, files: File[]) => {
      const fresh: PendingBill[] = files.map((file) => ({
        uid: crypto.randomUUID(), file, type, status: 'reading',
        billMonth: '', quantity: '', fuelType: '', dup: null, ack: false,
      }));
      setItems((prev) => [...prev, ...fresh]);
      // อ่านทีละไฟล์ เพราะ Tesseract กิน CPU หนัก
      (async () => { for (const it of fresh) await read(it); })();
    },
    [read],
  );

  const remove = useCallback((id: string) => setItems((p) => p.filter((i) => i.uid !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  // แก้ค่า -> ยกเลิกการรับทราบเก่า และเช็กซ้ำกับฐานข้อมูลใหม่เมื่อเปลี่ยนเดือน
  const edit = useCallback(
    async (it: PendingBill, p: Partial<Pick<PendingBill, 'billMonth' | 'quantity' | 'fuelType' | 'ack'>>) => {
      patch(it.uid, { ...p, ack: p.ack ?? false });
      if (p.billMonth !== undefined && it.fileHash) {
        const dup = await findDuplicate(orgId, it.type, it.fileHash, keyOf({ ...it, ...p }));
        patch(it.uid, { dup });
      }
    },
    [orgId, patch],
  );

  // รวมคำเตือน/ข้อห้ามของแต่ละแถว (คำนวณใหม่ทุกครั้ง จึงตามกิจกรรมที่ผู้ใช้เปลี่ยนได้)
  const checksOf = (it: PendingBill): Check[] => {
    if (it.status !== 'ready' || !it.extracted) return [];
    const out: Check[] = [];
    if (it.dup) out.push(it.dup);

    const q = it.quantity.trim() === '' ? null : Number(it.quantity);
    const ex: Extracted = {
      ...it.extracted,
      billMonth: it.billMonth || null,
      quantity: q !== null && Number.isFinite(q) ? q : null,
      spansTwoMonths: it.extracted.spansTwoMonths && it.billMonth === it.extracted.billMonth,
      confidence: it.billMonth && it.quantity.trim() ? 'high' : 'low',
    };
    out.push(...runChecks(ex, period).filter((c) => c.code !== 'OK'));

    // ซ้ำกับไฟล์ก่อนหน้าในรายการเดียวกัน (ตัวหลังโดนธง)
    const idx = items.findIndex((x) => x.uid === it.uid);
    const key = keyOf(it);
    const twin = items.slice(0, idx).find(
      (x) => x.status === 'ready' && (x.fileHash === it.fileHash || (key && keyOf(x) === key)),
    );
    if (twin) out.push({ level: 'fail', code: 'DUP_PENDING', message: `ซ้ำกับ ${twin.file.name} ที่เลือกไว้แล้ว` });
    return out;
  };

  // เหตุผลที่ยังกดคำนวณไม่ได้ (null = ผ่าน)
  const blockReason = (): string | null => {
    if (items.some((i) => i.status === 'reading')) return 'กำลังอ่านบิล กรุณารอสักครู่';
    if (items.some((i) => i.status === 'error')) return 'มีไฟล์ที่ใช้ไม่ได้ กรุณาเอาออกก่อน';
    const ready = items.filter((i) => i.status === 'ready');
    if (ready.some((i) => !i.billMonth || i.quantity.trim() === '' || !(Number(i.quantity) > 0))) {
      return 'กรุณากรอกเดือนและปริมาณของบิลให้ครบ';
    }
    if (ready.some((i) => checksOf(i).some((c) => c.level === 'fail'))) {
      return 'มีบิลที่เดือนไม่ตรงกับกิจกรรมหรือซ้ำ แก้หรือเอาออกก่อน';
    }
    if (ready.some((i) => checksOf(i).some((c) => c.level === 'warn') && !i.ack)) {
      return 'กรุณาตรวจและติ๊กรับทราบคำเตือนของบิลให้ครบ';
    }
    return null;
  };

  return { items, add, remove, clear, edit, checksOf, blockReason };
}