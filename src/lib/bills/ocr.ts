// =====================================================================
// [ปิดใช้งาน] อ่านบิลด้วย Tesseract.js (+ sharp/unpdf) ไม่ได้ใช้แล้ว
// เก็บโค้ดไว้เป็นคอมเมนต์เพื่อใช้เปรียบเทียบผลกับ PaddleOCR เท่านั้น
// ระบบปัจจุบันอ่านบิลผ่าน /api/ocr (Python PaddleOCR) แทน
// =====================================================================

// // lib/bills/ocr.ts
// import os from 'os';
// import sharp from 'sharp';
// import { extractText, getDocumentProxy } from 'unpdf';
// import { createWorker } from 'tesseract.js';
//
// // เลขไทย -> อารบิก, ตัดช่องว่างที่ OCR แทรกระหว่างตัวอักษรไทย
// export function normalizeText(s: string) {
//   return s
//     .replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0e50))
//     .replace(/([฀-๿])[ \t]+(?=[฀-๿])/g, '$1')
//     .replace(/[ \t]{2,}/g, ' ');
// }
//
// export async function readText(buf: Buffer, mime: string) {
//   if (mime === 'application/pdf') {
//     const pdf = await getDocumentProxy(new Uint8Array(buf));
//     const { text } = await extractText(pdf, { mergePages: true });
//     const t = normalizeText(text);
//     // PDF ที่สแกนมาเป็นรูปจะไม่มีข้อความ -> ให้ผู้ใช้ส่งเป็นรูปแทน
//     if (t.trim().length < 40) throw new Error('SCANNED_PDF');
//     return { text: t, source: 'pdf_text' as const };
//   }
//
//   const img = await sharp(buf)
//     .rotate()            // แก้ภาพที่ถ่ายกลับด้านตาม EXIF
//     .grayscale()
//     .normalize()
//     .resize({ width: 2200 })
//     .png()
//     .toBuffer();
//
//   const worker = await createWorker(['tha', 'eng'], 1, { cachePath: os.tmpdir() });
//   try {
//     const { data } = await worker.recognize(img);
//     return { text: normalizeText(data.text), source: 'tesseract' as const };
//   } finally {
//     await worker.terminate();
//   }
// }
export {}; // ให้ TypeScript มองเป็นโมดูล (ไฟล์ที่ทั้งไฟล์เป็นคอมเมนต์)
