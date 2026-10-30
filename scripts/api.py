
import os
from contextlib import asynccontextmanager
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import FastAPI, File, HTTPException, UploadFile
from paddleocr import PaddleOCR

from extract_bill_data import make_items, extract_bill_data


# จำกัดขนาดรูปภาพไม่เกิน 10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024

# ประเภทไฟล์ที่อนุญาต
ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

# ตรวจสอบนามสกุลไฟล์
ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

ocr = None


# โหลด PaddleOCR ครั้งเดียวตอนเปิด API
@asynccontextmanager
async def lifespan(app: FastAPI):
    global ocr

    print("กำลังโหลดโมเดล PaddleOCR...", flush=True)

    ocr = PaddleOCR(
        lang="th",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )

    print("PaddleOCR พร้อมใช้งาน", flush=True)

    yield

    ocr = None


app = FastAPI(
    title="Carbon Project OCR API",
    lifespan=lifespan,
)


# ใช้ตรวจสอบว่า Python API ทำงานหรือไม่
@app.get("/health")
def health():
    return {
        "status": "ok",
        "ocr_ready": ocr is not None,
    }


# รับรูปบิลจาก Next.js
@app.post("/ocr")
def read_bill(file: UploadFile = File(...)):
    if ocr is None:
        raise HTTPException(
            status_code=503,
            detail="OCR ยังไม่พร้อมใช้งาน",
        )

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="รองรับเฉพาะรูป JPG, PNG และ WebP",
        )

    suffix = Path(file.filename or "").suffix.lower()

    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="นามสกุลไฟล์ไม่ถูกต้อง",
        )

    temp_path = None

    try:
        # อ่านไฟล์โดยจำกัดขนาด
        image_bytes = file.file.read(MAX_FILE_SIZE + 1)

        if len(image_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="รูปภาพต้องมีขนาดไม่เกิน 10 MB",
            )

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="ไฟล์รูปภาพว่างเปล่า",
            )

        # ตรวจสอบลายเซ็นไฟล์ภาพเบื้องต้น
        is_jpeg = image_bytes.startswith(b"\xff\xd8\xff")
        is_png = image_bytes.startswith(
            b"\x89PNG\r\n\x1a\n"
        )
        is_webp = (
            len(image_bytes) >= 12
            and image_bytes[:4] == b"RIFF"
            and image_bytes[8:12] == b"WEBP"
        )

        valid_signatures = {
            "image/jpeg": is_jpeg,
            "image/png": is_png,
            "image/webp": is_webp,
        }

        if not valid_signatures.get(file.content_type, False):
            raise HTTPException(
                status_code=400,
                detail="เนื้อหาไฟล์ไม่ตรงกับประเภทภาพ",
            )

        # สร้างไฟล์ชั่วคราวให้ PaddleOCR อ่าน
        with NamedTemporaryFile(
            mode="wb",
            suffix=suffix,
            delete=False,
        ) as temp_file:
            temp_file.write(image_bytes)
            temp_path = temp_file.name

        # อ่านรูปด้วย PaddleOCR
        predictions = ocr.predict(temp_path)

        page_results = []

        for prediction in predictions:
            data = prediction.json

            if callable(data):
                data = data()

            if isinstance(data, dict):
                data = data.get("res", data)

            if not isinstance(data, dict):
                continue

            items = make_items(data)

            extracted = extract_bill_data(items)

            page_results.append(extracted)

        if not page_results:
            raise HTTPException(
                status_code=422,
                detail="ไม่สามารถอ่านข้อความจากรูปภาพได้",
            )

        # รูปบิลทั่วไปมีเพียงหนึ่งหน้า
        return page_results[0]

    except HTTPException:
        raise

    except Exception as error:
        print(
            f"OCR error: {type(error).__name__}: {error}",
            flush=True,
        )

        raise HTTPException(
            status_code=500,
            detail="เกิดข้อผิดพลาดระหว่างอ่านบิล",
        )

    finally:
        # ลบรูปชั่วคราวหลังอ่านเสร็จ
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

        file.file.close()
