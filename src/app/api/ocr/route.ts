
import { NextRequest, NextResponse } from "next/server";

// URL ของ Python API
// อ่านจาก .env.local ถ้ามี
const OCR_API_URL =
  process.env.OCR_API_URL ?? "http://127.0.0.1:8000";

// จำกัดขนาดรูปไม่เกิน 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ประเภทไฟล์ที่รองรับ
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function POST(request: NextRequest) {
  try {
    // รับข้อมูลที่ส่งมาจากหน้าเว็บ
    const formData = await request.formData();

    const file = formData.get("file");

    // ตรวจสอบว่ามีไฟล์หรือไม่
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "กรุณาเลือกรูปบิล" },
        { status: 400 }
      );
    }

    // ตรวจสอบประเภทไฟล์
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "รองรับเฉพาะ JPG, PNG และ WebP" },
        { status: 400 }
      );
    }

    // ตรวจสอบขนาดไฟล์
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "รูปภาพต้องมีขนาดไม่เกิน 10 MB" },
        { status: 413 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "ไฟล์รูปภาพว่างเปล่า" },
        { status: 400 }
      );
    }

    // สร้าง FormData ใหม่สำหรับส่งให้ Python
    const pythonFormData = new FormData();

    pythonFormData.append("file", file, file.name);

    // ส่งรูปไปให้ Python API
    const response = await fetch(`${OCR_API_URL}/ocr`, {
      method: "POST",
      body: pythonFormData,
      cache: "no-store",
      signal: AbortSignal.timeout(120000),
    });

    // รับ JSON กลับจาก Python
    const result = await response.json();

    // ถ้า Python API แจ้งข้อผิดพลาด
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            result.detail ??
            "ไม่สามารถอ่านข้อมูลจากบิลได้",
        },
        { status: response.status }
      );
    }

    // ส่งผล OCR กลับไปยังหน้าเว็บ
    return NextResponse.json(result);

  } catch (error) {
    console.error("OCR API error:", error);

    if (
      error instanceof Error &&
      error.name === "TimeoutError"
    ) {
      return NextResponse.json(
        { error: "การอ่านบิลใช้เวลานานเกินไป" },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        error:
          "ไม่สามารถเชื่อมต่อระบบ OCR ได้ กรุณาตรวจสอบ Python API",
      },
      { status: 500 }
    );
  }
}
