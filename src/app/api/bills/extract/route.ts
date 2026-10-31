// =====================================================================
// [ปิดใช้งาน] API อ่านบิลด้วย Tesseract ไม่ได้ใช้แล้ว (ใช้ /api/ocr แทน)
// เก็บโค้ดไว้เป็นคอมเมนต์เพื่อใช้เปรียบเทียบผลกับ PaddleOCR เท่านั้น
// ระบบปัจจุบันอ่านบิลผ่าน /api/ocr (Python PaddleOCR) แทน
// =====================================================================

// // app/api/bills/extract/route.ts
// import { NextResponse } from 'next/server';
// import { createHash } from 'crypto';
// import { readText } from '@/lib/bills/ocr';
// import { parseBill } from '@/lib/bills/parse';
// import { runChecks } from '@/lib/bills/checks';
// import type { BillType } from '@/lib/bills/types';
//
// export const runtime = 'nodejs';
// export const maxDuration = 60; // TODO: ปรับตามแผน Vercel ที่ใช้อยู่
//
// const MAX_BYTES = 4 * 1024 * 1024; // Vercel รับ body ได้ไม่เกิน 4.5 MB ต่อคำขอ
// const OK_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
// const TYPES = ['water', 'electricity', 'fuel'];
//
// const fail = (status: number, error: string) => NextResponse.json({ error }, { status });
//
// export async function POST(req: Request) {
//   const form = await req.formData();
//   const file = form.get('file');
//   const billType = String(form.get('billType') ?? '');
//   const actType = form.get('activityType') === 'year' ? 'year' : 'month';
//   const actMonth = String(form.get('activityMonth') ?? '');
//
//   if (!(file instanceof File)) return fail(400, 'ไม่พบไฟล์');
//   if (!TYPES.includes(billType)) return fail(400, 'ประเภทบิลไม่ถูกต้อง');
//   if (!/^\d{4}-\d{2}-01$/.test(actMonth)) return fail(400, 'เดือนของกิจกรรมไม่ถูกต้อง');
//   if (file.size > MAX_BYTES) return fail(413, 'ไฟล์ใหญ่เกิน 4 MB สำหรับอ่านอัตโนมัติ');
//   if (!OK_MIME.includes(file.type)) return fail(415, 'รองรับเฉพาะ PDF, PNG, JPG, WEBP');
//
//   const buf = Buffer.from(await file.arrayBuffer());
//   const fileHash = createHash('sha256').update(buf).digest('hex');
//
//   try {
//     const { text, source } = await readText(buf, file.type);
//     // ข้อความดิบมีข้อมูลส่วนบุคคล เปิดดูเฉพาะตอนพัฒนาเท่านั้น
//     if (process.env.BILL_OCR_DEBUG === '1') console.log('[ocr]', text);
//
//     const extracted = parseBill(text, billType as BillType, source);
//     const checks = runChecks(extracted, { type: actType, month: actMonth });
//     return NextResponse.json({ fileHash, extracted, checks });
//   } catch (e) {
//     if (e instanceof Error && e.message === 'SCANNED_PDF') {
//       return fail(422, 'PDF ฉบับนี้เป็นภาพสแกน กรุณาส่งเป็นไฟล์รูป (JPG/PNG)');
//     }
//     console.error('[bills/extract]', e instanceof Error ? e.message : e);
//     return fail(500, 'อ่านบิลไม่สำเร็จ ลองใหม่หรือกรอกเองได้');
//   }
// }
export {}; // ให้ TypeScript มองเป็นโมดูล (ไฟล์ที่ทั้งไฟล์เป็นคอมเมนต์)
