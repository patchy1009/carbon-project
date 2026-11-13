
import sys
import time
import json
from pathlib import Path

from paddleocr import PaddleOCR
from extract_bill_data import (
    make_items,
    extract_bill_data
)


def main():
    if len(sys.argv) < 2:
        print(
            "Usage: python scripts/try-paddle.py "
            "./samples/e1.jpg"
        )
        return

    image_path = Path(sys.argv[1])

    if not image_path.is_file():
        print(f"ไม่พบไฟล์: {image_path}")
        return

    print("กำลังโหลดโมเดล PaddleOCR...")

    ocr = PaddleOCR(
        lang="th",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )

    print("เริ่มอ่านรูปบิล...")

    start = time.perf_counter()
    results = ocr.predict(str(image_path))
    elapsed = time.perf_counter() - start

    print(f"\n===== {image_path} (PaddleOCR)")
    print(f"OCR time: {elapsed:.2f} seconds")

    for page_index, result in enumerate(results):
        data = result.json

        if callable(data):
            data = data()

        if isinstance(data, dict):
            data = data.get("res", data)

        print(f"\n===== Page {page_index + 1}")

        if not isinstance(data, dict):
            print(result)
            continue

        items = make_items(data)

        print("\n===== Recognized text")

        for item in items:
            print(
                f'{item["text"]} | '
                f'confidence={item["score"]:.4f}'
            )

        extracted = extract_bill_data(items)

        print("\n===== Extracted fields")

        print(
            json.dumps(
                extracted,
                ensure_ascii=False,
                indent=2
            )
        )


if __name__ == "__main__":
    main()
