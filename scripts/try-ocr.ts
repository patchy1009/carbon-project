// =====================================================================
// [ปิดใช้งาน] สคริปต์ทดสอบ Tesseract ไม่ได้ใช้แล้ว (ใช้ scripts/test-bills.py แทน)
// เก็บโค้ดไว้เป็นคอมเมนต์เพื่อใช้เปรียบเทียบผลกับ PaddleOCR เท่านั้น
// ระบบปัจจุบันอ่านบิลผ่าน /api/ocr (Python PaddleOCR) แทน
// =====================================================================

// // scripts/try-ocr.ts
// // วิธีใช้: npx tsx scripts/try-ocr.ts electricity ./samples/a.jpg ./samples/b.pdf
// // ดูข้อความดิบ: SHOW_TEXT=1 npx tsx scripts/try-ocr.ts water ./samples/w.jpg
// import fs from 'fs';
// import path from 'path';
// import { readText } from '../src/lib/bills/ocr';
// import { parseBill } from '../src/lib/bills/parse';
// import type { BillType } from '../src/lib/bills/types';
//
// const [type, ...files] = process.argv.slice(2);
// if (!['water', 'electricity', 'fuel'].includes(type) || !files.length) {
//   console.log('ใช้: npx tsx scripts/try-ocr.ts <water|electricity|fuel> <ไฟล์...>');
//   process.exit(1);
// }
//
// const MIME: Record<string, string> = {
//   '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg',
//   '.jpeg': 'image/jpeg', '.webp': 'image/webp',
// };
//
// (async () => {
//   for (const f of files) {
//     const mime = MIME[path.extname(f).toLowerCase()];
//     if (!mime) { console.log(f, 'ชนิดไฟล์ไม่รองรับ'); continue; }
//     const t0 = Date.now();
//     try {
//       const { text, source } = await readText(fs.readFileSync(f), mime);
//       const ex = parseBill(text, type as BillType, source);
//       console.log('\n=====', f, `(${source}, ${((Date.now() - t0) / 1000).toFixed(1)} วินาที)`);
//       if (process.env.SHOW_TEXT === '1') console.log(text);
//       console.table({
//         billMonth: ex.billMonth,
//         quantity: ex.quantity,
//         unit: ex.unit,
//         spansTwoMonths: ex.spansTwoMonths,
//         account: ex.accountNo ? '***' + ex.accountNo.slice(-3) : null, // อย่าพิมพ์เลขบัญชีเต็ม
//         invoice: ex.invoiceNo,
//         fuelType: ex.fuelType,
//         confidence: ex.confidence,
//       });
//     } catch (e) {
//       console.log(f, 'อ่านไม่ได้:', e instanceof Error ? e.message : e);
//     }
//   }
// })();
export {}; // ให้ TypeScript มองเป็นโมดูล (ไฟล์ที่ทั้งไฟล์เป็นคอมเมนต์)
