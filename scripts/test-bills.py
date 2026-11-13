
import json
import sys
import time
from pathlib import Path


# แสดงความคืบหน้าใน Terminal ทันที
def progress(message):
    print(message, file=sys.stderr, flush=True)


# ตำแหน่งโฟลเดอร์โปรเจกต์และรูปบิล
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SAMPLES_DIR = PROJECT_ROOT / "samples"


# รูปบิลทั้งหมดที่ต้องการทดสอบ
FILES = [
    "w1.jpg",
    "w2.jpg",
    "e1.jpg",
    "e2.jpg",
    "e3.jpg",
    "o1.jpg",
    "o2.jpeg",
    "o3.jpg",
    "tw1.jpg",
    "tw2.jpg",
    "te1.jpg",
    "te2.jpg",
    "to1.jpg",
    "to2.jpg",
]


def main():
    progress("กำลังนำเข้า PaddleOCR...")

    from paddleocr import PaddleOCR
    from extract_bill_data import (
        make_items,
        extract_bill_data,
    )

    progress("กำลังโหลดโมเดล PaddleOCR...")

    # โหลดโมเดลเพียงครั้งเดียว
    ocr = PaddleOCR(
        lang="th",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )

    results = []

    total = len(FILES)
    success = 0
    failed = 0

    started = time.perf_counter()

    for index, filename in enumerate(FILES, start=1):
        image_path = SAMPLES_DIR / filename

        progress(
            f"\n[{index}/{total}] "
            f"กำลังอ่านรูป {filename}..."
        )

        image_start = time.perf_counter()

        try:
            if not image_path.is_file():
                raise FileNotFoundError(
                    f"ไม่พบไฟล์ {image_path}"
                )

            # ให้ PaddleOCR อ่านรูป
            predictions = ocr.predict(str(image_path))

            page_results = []

            for prediction in predictions:
                data = prediction.json

                if callable(data):
                    data = data()

                if isinstance(data, dict):
                    data = data.get("res", data)

                if not isinstance(data, dict):
                    raise ValueError(
                        "รูปแบบข้อมูล OCR ไม่ถูกต้อง"
                    )

                # แปลงผล OCR เป็นรายการข้อความ
                items = make_items(data)

                # ดึงข้อมูลจากบิล
                extracted = extract_bill_data(items)

                page_results.append(extracted)

            if not page_results:
                raise ValueError(
                    "ไม่พบข้อมูลที่ OCR อ่านได้"
                )

            if len(page_results) == 1:
                results.append({
                    "file": filename,
                    **page_results[0],
                })
            else:
                results.append({
                    "file": filename,
                    "pages": page_results,
                })

            success += 1

            elapsed = (
                time.perf_counter() - image_start
            )

            progress(
                f"[{index}/{total}] "
                f"อ่านเสร็จ {filename} "
                f"({elapsed:.2f} วินาที)"
            )

            progress(
                f"ความคืบหน้า: "
                f"{index}/{total} รูป "
                f"({index / total * 100:.1f}%)"
            )

        except Exception as error:
            failed += 1

            results.append({
                "file": filename,
                "error": (
                    f"{type(error).__name__}: {error}"
                ),
            })

            progress(
                f"[{index}/{total}] "
                f"อ่านไม่สำเร็จ {filename}"
            )

            progress(f"สาเหตุ: {error}")

    total_time = time.perf_counter() - started

    progress("\n========== สรุปผล ==========")
    progress(f"จำนวนรูปทั้งหมด: {total}")
    progress(f"อ่านสำเร็จ: {success}")
    progress(f"อ่านไม่สำเร็จ: {failed}")
    progress(f"เวลาทั้งหมด: {total_time:.2f} วินาที")
    progress("============================\n")

    # แสดงผล JSON หลังอ่านครบทุกไฟล์
    print(
        json.dumps(
            results,
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
