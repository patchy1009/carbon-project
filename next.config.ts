import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // ให้ Next ไม่รวม tesseract.js / sharp เข้า bundle แต่โหลดจาก node_modules ตอนรัน
  serverExternalPackages: ["tesseract.js", "sharp"],

  // บังคับให้ไฟล์ worker/core ของ tesseract.js ถูกแพ็กไปกับ API นี้บน Vercel
  outputFileTracingIncludes: {
    "/api/bills/extract": [
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
    ],
  },
};

export default nextConfig;