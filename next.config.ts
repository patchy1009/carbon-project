import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // [ปิดใช้งาน] ตั้งค่าสำหรับ Tesseract (ไม่ได้ใช้แล้ว อ่านบิลด้วย Python PaddleOCR ผ่าน /api/ocr แทน)
  // // ให้ Next ไม่รวม tesseract.js / sharp เข้า bundle แต่โหลดจาก node_modules ตอนรัน
  // serverExternalPackages: ["tesseract.js", "sharp"],
  //
  // // บังคับให้ไฟล์ worker/core ของ tesseract.js ถูกแพ็กไปกับ API นี้บน Vercel
  // outputFileTracingIncludes: {
  //   "/api/bills/extract": [
  //     "./node_modules/tesseract.js/**/*",
  //     "./node_modules/tesseract.js-core/**/*",
  //   ],
  // },
};

export default nextConfig;
