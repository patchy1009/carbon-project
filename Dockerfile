
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True

RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-ocr.txt .

RUN pip install --no-cache-dir -r requirements-ocr.txt

# ดาวน์โหลดโมเดล PaddleOCR ตอน build ให้ติดไปกับ image
# (ไม่ต้องโหลดใหม่ทุกครั้งที่ container เปิด เปิดเครื่องเร็วขึ้น) ค่าต้องตรงกับใน scripts/api.py
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(lang='th', use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False)"

COPY scripts/ ./scripts/

EXPOSE 8000

# Render ส่ง port มาทาง $PORT ถ้าไม่มี (รันเองบนเครื่อง / docker run) ใช้ 8000
CMD ["sh", "-c", "python -m uvicorn api:app --app-dir scripts --host 0.0.0.0 --port ${PORT:-8000}"]
