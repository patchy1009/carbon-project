
# import re
# from datetime import date
# from difflib import SequenceMatcher


# # ======================================
# # 1. ฟังก์ชันพื้นฐาน
# # ======================================

# THAI_DIGITS = str.maketrans(
#     "๐๑๒๓๔๕๖๗๘๙",
#     "0123456789"
# )


# def normalize(text):
#     return str(text).translate(THAI_DIGITS).strip()


# def compact(text):
#     return re.sub(r"\s+", "", normalize(text).lower())


# def similarity(a, b):
#     return SequenceMatcher(
#         None, compact(a), compact(b)
#     ).ratio()


# def number(text):
#     text = normalize(text).replace(",", "")

#     if not re.fullmatch(r"\d+(?:\.\d+)?", text):
#         return None

#     return float(text)


# def center(item):
#     return (
#         (item["x1"] + item["x2"]) / 2,
#         (item["y1"] + item["y2"]) / 2
#     )


# def distance(a, b):
#     ax, ay = center(a)
#     bx, by = center(b)

#     return abs(ax - bx) + abs(ay - by)


# def make_items(data):
#     texts = data.get("rec_texts", [])
#     scores = data.get("rec_scores", [])
#     boxes = data.get("rec_boxes", [])

#     # ใช้ rec_polys เป็นตัวสำรอง
#     if boxes is None or len(boxes) == 0:
#         boxes = []

#         for poly in data.get("rec_polys", []):
#             if hasattr(poly, "tolist"):
#                 poly = poly.tolist()

#             xs = [p[0] for p in poly]
#             ys = [p[1] for p in poly]

#             boxes.append([
#                 min(xs), min(ys),
#                 max(xs), max(ys)
#             ])

#     items = []

#     for i, text in enumerate(texts):
#         box = boxes[i] if i < len(boxes) else None

#         if hasattr(box, "tolist"):
#             box = box.tolist()

#         if box is None:
#             continue

#         x1, y1, x2, y2 = map(float, box[:4])

#         items.append({
#             "text": normalize(text),
#             "score": float(scores[i]),
#             "x1": x1,
#             "y1": y1,
#             "x2": x2,
#             "y2": y2,
#             "cx": (x1 + x2) / 2,
#             "cy": (y1 + y2) / 2,
#         })

#     return items


# # ======================================
# # 2. ระบุประเภทบิล
# # ======================================

# def detect_type(items):
#     full = " ".join(compact(i["text"]) for i in items)

#     if any(x in full for x in [
#         "ประปา", "pwa.co.th", "หน่วยน้ำ",
#         "มาตรวัดน้ำ"
#     ]):
#         return "water"

#     if any(x in full for x in [
#         "ไฟฟ้า", "consumption",
#         "billperiod", "peacode"
#     ]):
#         return "electricity"

#     if any(x in full for x in [
#         "แก๊สโซฮอล", "fuelsave",
#         "tranno", "gasohol",
#         "สถานีบริการน้ำมัน"
#     ]):
#         return "fuel"

#     return "unknown"


# # ======================================
# # 3. เดือนและปี
# # ======================================

# def convert_year(year):
#     year = int(year)

#     if year < 100:
#         year += 2500

#     if year >= 2400:
#         year -= 543

#     if not 1900 <= year <= 2100:
#         return None

#     return year


# def full_date(text):
#     text = normalize(text)

#     match = re.search(
#         r"(?<!\d)(\d{1,2})"
#         r"\s*[/.:()-]\s*"
#         r"(\d{1,2})"
#         r"\s*[/.:()-]\s*"
#         r"(\d{2,4})(?!\d)",
#         text
#     )

#     if not match:
#         return None

#     day = int(match.group(1))
#     month = int(match.group(2))
#     year = convert_year(match.group(3))

#     if year is None:
#         return None

#     try:
#         date(year, month, day)
#     except ValueError:
#         return None

#     return month, year


# def month_year(text):
#     match = re.fullmatch(
#         r"\s*(\d{1,2})[/.-](\d{2,4})\s*",
#         normalize(text)
#     )

#     if not match:
#         return None

#     month = int(match.group(1))
#     year = convert_year(match.group(2))

#     if year is None or not 1 <= month <= 12:
#         return None

#     return month, year


# def extract_period(items, bill_type):
#     if bill_type == "electricity":
#         # ใช้รูปแบบ MM/YYYY ของ Bill Period
#         periods = []

#         for item in items:
#             result = month_year(item["text"])

#             if result:
#                 periods.append((item, result))

#         if len(periods) == 1:
#             return periods[0][1]

#         # ถ้ามีหลายค่า เลือกค่าที่ใกล้หัวข้อ Bill Period
#         labels = [
#             i for i in items
#             if any(k in compact(i["text"]) for k in [
#                 "billperiod", "bilperiod",
#                 "ประจำเดือน"
#             ])
#         ]

#         if periods and labels:
#             periods.sort(
#                 key=lambda pair: min(
#                     distance(pair[0], label)
#                     for label in labels
#                 )
#             )
#             return periods[0][1]

#         return None

#     if bill_type == "water":
#         # วันที่อ่านมาตรครั้งนี้
#         labels = [
#             i for i in items
#             if "ครั้งนี้" in compact(i["text"])
#         ]

#         dates = [
#             (i, full_date(i["text"]))
#             for i in items
#         ]

#         dates = [
#             (i, result)
#             for i, result in dates
#             if result is not None
#         ]

#         for label in labels:
#             candidates = [
#                 (i, result)
#                 for i, result in dates
#                 if 0 < i["cy"] - label["cy"] < 180
#                 and abs(i["cx"] - label["cx"]) < 180
#             ]

#             if candidates:
#                 candidates.sort(
#                     key=lambda pair: distance(
#                         pair[0], label
#                     )
#                 )
#                 return candidates[0][1]

#         return None

#     if bill_type == "fuel":
#         # วันที่ทำรายการ / วันที่พิมพ์ใบเสร็จ
#         for item in items:
#             text = compact(item["text"])

#             if "print" in text:
#                 result = full_date(item["text"])

#                 if result:
#                     return result

#         return None

#     return None


# # ======================================
# # 4. เลขที่บิล
# # ======================================

# def extract_bill_number(items, bill_type):
#     if bill_type == "water":
#         candidates = [
#             i for i in items
#             if re.fullmatch(r"\d{13}", i["text"])
#         ]

#         # เลขบิล กปภ. ในตัวอย่างเป็นเลข 13 หลัก
#         if len(candidates) == 1:
#             return candidates[0]["text"]

#         labels = [
#             i for i in items
#             if "แจ้ง" in i["text"]
#             and ("เลข" in i["text"] or "เลที่" in i["text"])
#         ]

#         for label in labels:
#             nearby = [
#                 i for i in candidates
#                 if 0 < i["cy"] - label["cy"] < 150
#             ]

#             if nearby:
#                 nearby.sort(
#                     key=lambda i: distance(i, label)
#                 )
#                 return nearby[0]["text"]

#         return None

#     if bill_type == "electricity":
#         candidates = [
#             i for i in items
#             if re.fullmatch(r"\d{12}", i["text"])
#         ]

#         labels = [
#             i for i in items
#             if any(k in compact(i["text"]) for k in [
#                 "เลขที่เอกสาร",
#                 "เลขทีใบแจ้ง",
#                 "เลขที่ใบแจ้ง",
#                 "invoiceno",
#                 "ref.no.2",
#                 "refno.2",
#                 "docnouref.no.2",
#             ])
#         ]

#         if labels and candidates:
#             candidates.sort(
#                 key=lambda i: min(
#                     distance(i, label)
#                     for label in labels
#                 )
#             )
#             return candidates[0]["text"]

#         if len(candidates) == 1:
#             return candidates[0]["text"]

#         return None

#     if bill_type == "fuel":
#         # รูปแบบ PT
#         for item in items:
#             match = re.search(
#                 r"tran\s*no\s*#?\s*([A-Z0-9-]+)",
#                 item["text"],
#                 re.I
#             )

#             if match:
#                 return match.group(1)

#         # รูปแบบ Shell
#         candidates = [
#             i for i in items
#             if re.fullmatch(
#                 r"\d{2}-\d-\d{9,}",
#                 i["text"]
#             )
#         ]

#         if len(candidates) == 1:
#             return candidates[0]["text"]

#         labels = [
#             i for i in items
#             if any(k in compact(i["text"]) for k in [
#                 "เลขที่", "เลยที่",
#                 "receiptno", "billno"
#             ])
#         ]

#         if candidates and labels:
#             candidates.sort(
#                 key=lambda i: min(
#                     distance(i, label)
#                     for label in labels
#                 )
#             )
#             return candidates[0]["text"]

#     return None


# # ======================================
# # 5. ปริมาณน้ำ
# # ======================================

# def extract_water_quantity(items):
#     labels = [
#         i for i in items
#         if (
#             "หน่วยน้ำ" in compact(i["text"])
#             or "หล่วยน้ำ" in compact(i["text"])
#         )
#     ]

#     candidates = []

#     for item in items:
#         text = item["text"]

#         # บิลตัวอย่างใช้ 41.000 และ 26,000 ลิตร
#         if re.fullmatch(r"\d{1,3}[.,]\d{3}", text):
#             value = int(
#                 text.replace(".", "").replace(",", "")
#             )
#             candidates.append((item, value))

#     for label in labels:
#         nearby = [
#             (item, value)
#             for item, value in candidates
#             if abs(item["cy"] - label["cy"]) < 100
#         ]

#         if nearby:
#             nearby.sort(
#                 key=lambda pair: distance(
#                     pair[0], label
#                 )
#             )
#             return float(nearby[0][1])

#     return None


# # ======================================
# # 6. ปริมาณไฟฟ้า
# # ======================================

# def extract_electricity_quantity(items):
#     # ไม่ใช้เลขมิเตอร์มาลบกัน
#     # อ่านค่าจากคอลัมน์ Consumption โดยตรง

#     labels = [
#         i for i in items
#         if (
#             "consumption" in compact(i["text"])
#             or "จำนวนที่ใช้" in compact(i["text"])
#             or "จำนวนทีใช้" in compact(i["text"])
#         )
#         and "history" not in compact(i["text"])
#     ]

#     # # หาตำแหน่งเริ่มส่วนค่าใช้จ่าย
#     # money_labels = [
#     #     i for i in items
#     #     if any(k in compact(i["text"]) for k in [
#     #         "จำนวนเงิน(บาท)",
#     #         "ค่าพลังงานไฟฟ้า",
#     #         "รวมเงินค่าไฟฟ้า"
#     #     ])
#     # ]

#     # money_y = (
#     #     min(i["cy"] for i in money_labels)
#     #     if money_labels else float("inf")
#     # )

#     candidates = []

#     for item in items:
#         value = number(item["text"])

#         if value is None:
#             continue

#         # ต้องเป็นตัวเลขที่มีทศนิยม 2 ตำแหน่ง
#         # เพื่อไม่เลือก 0.0000 และเลขมิเตอร์ .000
#         if not re.fullmatch(
#             r"\d+(?:,\d{3})*\.\d{2}",
#             item["text"]
#         ):
#             continue

#         # ตัดตัวเลขในส่วนจำนวนเงิน
#         # if item["cy"] >= money_y:
#         #     continue

#         candidates.append((item, value))

#     if not labels or not candidates:
#         return None

#     # เลือกค่าที่อยู่ใต้หัวข้อ Consumption
#     scored = []

#     for item, value in candidates:
#         for label in labels:
#             dx = abs(item["cx"] - label["cx"])
#             dy = item["cy"] - label["cy"]

#             if 0 < dy < 240:
#                 scored.append((
#                     dx * 2 + dy * 0.4,
#                     value
#                 ))

#     if not scored:
#         return None

#     scored.sort(key=lambda x: x[0])

#     return scored[0][1]


# # ======================================
# # 7. ชนิดน้ำมันและปริมาณ
# # ======================================

# def extract_fuel_type(items):
#     for item in items:
#         text = compact(item["text"])

#         # เลือกเฉพาะชื่อสินค้า
#         if any(k in text for k in [
#             "แก๊สโซฮอล", "gasohol",
#             "fuelsave"
#         ]):
#             if "e20" in text:
#                 return "gasohol_e20"

#             if "e85" in text:
#                 return "gasohol_e85"

#             if "91" in text:
#                 return "gasohol_91"

#             if "95" in text:
#                 return "gasohol_95"

#         if "ดีเซล" in text or "diesel" in text:
#             return "diesel"

#     return None


# def extract_fuel_quantity(items):
#     fuel_labels = [
#         i for i in items
#         if any(k in compact(i["text"]) for k in [
#             "แก๊สโซฮอล",
#             "gasohol",
#             "fuelsave",
#             "diesel",
#             "ดีเซล"
#         ])
#     ]

#     candidates = []

#     for item in items:
#         text = item["text"]

#         if any(k in compact(text) for k in [
#             "ส่วนลด", "คงเหลือ",
#             "โปรโมชั่น", "แต้ม"
#         ]):
#             continue

#         match = re.search(
#             r"(?<![\d.])(\d+(?:\.\d+)?)"
#             r"\s*[Ll]\b",
#             text
#         )

#         if match:
#             candidates.append((
#                 item, float(match.group(1))
#             ))

#     if not candidates:
#         return None

#     if fuel_labels:
#         candidates.sort(
#             key=lambda pair: min(
#                 distance(pair[0], label)
#                 for label in fuel_labels
#             )
#         )

#     return candidates[0][1]


# # ======================================
# # 8. รวมผลลัพธ์ JSON
# # ======================================

# def extract_bill_data(items):
#     bill_type = detect_type(items)

#     bill_number = extract_bill_number(
#         items, bill_type
#     )

#     period = extract_period(items, bill_type)

#     fuel_type = None
#     quantity = None
#     unit = None

#     if bill_type == "water":
#         quantity = extract_water_quantity(items)
#         unit = "L" if quantity is not None else None

#     elif bill_type == "electricity":
#         quantity = extract_electricity_quantity(items)
#         unit = "kWh" if quantity is not None else None

#     elif bill_type == "fuel":
#         fuel_type = extract_fuel_type(items)
#         quantity = extract_fuel_quantity(items)
#         unit = "L" if quantity is not None else None

#     warnings = []

#     if bill_type == "unknown":
#         warnings.append("ไม่สามารถระบุประเภทบิลได้")

#     if bill_number is None:
#         warnings.append("ไม่พบเลขที่บิล")

#     if period is None:
#         warnings.append("ไม่พบเดือนและปี")

#     if quantity is None:
#         warnings.append("ไม่พบปริมาณการใช้")

#     if bill_type == "fuel" and fuel_type is None:
#         warnings.append("ไม่พบชนิดน้ำมัน")

#     return {
#         "bill_type": bill_type,
#         "bill_number": bill_number,
#         "month": period[0] if period else None,
#         "year": period[1] if period else None,
#         "fuel_type": fuel_type,
#         "quantity": quantity,
#         "unit": unit,
#         "status": "pending_review",
#         "warnings": warnings,
#     }



import re
import unicodedata
from datetime import date


# ==================================================
# 1. ฟังก์ชันพื้นฐาน
# ==================================================

THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")


def normalize(text):
    return unicodedata.normalize(
        "NFKC", str(text)
    ).translate(THAI_DIGITS).strip()


def compact(text):
    return re.sub(r"\s+", "", normalize(text).lower())


def has_any(text, keywords):
    value = compact(text)
    return any(compact(k) in value for k in keywords)


def make_items(data):
    texts = data.get("rec_texts", [])
    scores = data.get("rec_scores", [])
    boxes = data.get("rec_boxes")

    if boxes is None or len(boxes) == 0:
        boxes = data.get("rec_polys", [])

    items = []

    for index, text in enumerate(texts):
        if index >= len(boxes):
            continue

        box = boxes[index]

        if hasattr(box, "tolist"):
            box = box.tolist()

        if len(box) == 4 and not isinstance(
            box[0], (list, tuple)
        ):
            x1, y1, x2, y2 = map(float, box)
        else:
            xs = [float(p[0]) for p in box]
            ys = [float(p[1]) for p in box]
            x1, x2 = min(xs), max(xs)
            y1, y2 = min(ys), max(ys)

        items.append({
            "text": normalize(text),
            "score": (
                float(scores[index])
                if index < len(scores) else 0.0
            ),
            "x1": x1,
            "y1": y1,
            "x2": x2,
            "y2": y2,
            "cx": (x1 + x2) / 2,
            "cy": (y1 + y2) / 2,
        })

    return items


def distance(a, b):
    return (
        abs(a["cx"] - b["cx"])
        + abs(a["cy"] - b["cy"])
    )


def item_height(item):
    return max(item["y2"] - item["y1"], 1)


def numeric_value(text):
    value = normalize(text).replace(",", "")
    if re.fullmatch(r"\d+(?:\.\d+)?", value):
        return float(value)
    return None


def find_labels(items, keywords):
    return [
        item for item in items
        if has_any(item["text"], keywords)
    ]


# ==================================================
# 2. ระบุประเภทบิล
# ==================================================

def detect_type(items):
    full = " ".join(compact(i["text"]) for i in items)

    if has_any(full, [
        "ประปา", "หน่วยน้ำ", "หน่วยน้ํา", "pwa"
    ]):
        return "water"

    if has_any(full, [
        "การไฟฟ้า", "ค่าไฟฟ้า",
        "provincialelectric", "consumption", "peacode"
    ]):
        return "electricity"

    if has_any(full, [
        "gasohol", "fuelsave", "แก๊สโซ",
        "แก๊สโขอ", "tranno", "bangchak",
        "สถานีบริการน้ำมัน", "ptmax", "bcpgreen"
    ]):
        return "fuel"

    return "unknown"


# ==================================================
# 3. อ่านเดือนและปี
# ==================================================

def convert_year(value):
    year = int(value)

    if year >= 2400:
        year -= 543
    elif year < 100:
        if year >= 40:
            year += 1957
        else:
            year += 2000

    if 1990 <= year <= 2100:
        return year

    return None


def parse_full_date(text):
    # รองรับวันที่ที่ OCR อ่านตัวคั่นผิด
    # เช่น 11/07(2022
    pattern = (
        r"(?<!\d)"
        r"(\d{1,2})\s*[/.:()-]\s*"
        r"(\d{1,2})\s*[/.:()-]\s*"
        r"(\d{2,4})(?!\d)"
    )

    for match in re.finditer(pattern, normalize(text)):
        day, month, raw_year = match.groups()
        year = convert_year(raw_year)

        if year is None:
            continue

        try:
            date(year, int(month), int(day))
            return int(month), year
        except ValueError:
            continue

    return None


def parse_bill_period(text):
    pattern = (
        r"(?<!\d)"
        r"(\d{1,2})\s*[/.-]\s*"
        r"(\d{4})(?!\d)"
    )

    for match in re.finditer(pattern, normalize(text)):
        month = int(match.group(1))
        year = convert_year(match.group(2))

        if year and 1 <= month <= 12:
            return month, year

    return None


def extract_period(items, bill_type):
    if bill_type == "electricity":
        candidates = []

        for item in items:
            result = parse_bill_period(item["text"])
            if result:
                candidates.append((item, result))

        labels = find_labels(items, [
            "billperiod", "bilperiod",
            "bmperiod", "bllperiod",
            "ประจำเดือน", "ประจําเดือน",
            "ประจำเตือน", "ประจําเตือน"
        ])

        if candidates:
            if labels:
                candidates.sort(
                    key=lambda pair: min(
                        distance(pair[0], label)
                        for label in labels
                    )
                )
            return candidates[0][1]

    elif bill_type == "water":
        labels = find_labels(items, [
            "ครั้งนี้", "วันที่แจ้ง",
            "วันที่อ่าน", "วันเดือนปีที่อ่าน"
        ])

        candidates = []

        for item in items:
            result = parse_full_date(item["text"])
            if result:
                candidates.append((item, result))

        if candidates:
            if labels:
                candidates.sort(
                    key=lambda pair: min(
                        distance(pair[0], label)
                        for label in labels
                    )
                )
            return candidates[0][1]

    elif bill_type == "fuel":
        # วันที่ขายหรือวันที่พิมพ์มาก่อน
        for item in items:
            if has_any(item["text"], [
                "print", "วันที่ขาย", "วันทีขาย"
            ]):
                result = parse_full_date(item["text"])
                if result:
                    return result

        # หากไม่พบ ให้ค้นวันที่จากข้อความอื่น
        for item in items:
            if has_any(item["text"], [
                "expdate", "หมดอายุ",
                "expiry", "validuntil"
            ]):
                continue

            result = parse_full_date(item["text"])
            if result:
                return result

    return None


# ==================================================
# 4. อ่านเลขที่บิล
# ==================================================

def extract_bill_number(items, bill_type):
    if bill_type == "water":
        candidates = [
            item for item in items
            if re.fullmatch(
                r"\d{13}", compact(item["text"])
            )
        ]

        if len(candidates) == 1:
            return candidates[0]["text"]

        labels = find_labels(items, [
            "เลขที่ใบแจ้ง", "เลขทีใบแจ้ง",
            "เละทีใบแจ้ง", "เลขทีใมแจ้ง",
            "เลขที่แจ้ง"
        ])

        if candidates and labels:
            candidates.sort(
                key=lambda item: min(
                    distance(item, label)
                    for label in labels
                )
            )
            return candidates[0]["text"]

        return None

    if bill_type == "electricity":
        doc_labels = find_labels(items, [
            "docno", "docnouref",
            "docno./ref", "ref.no.2",
            "ref,no.2", "refno.2",
            "rufno.2", "เลขที่เอกสาร",
            "เลรที่เอกสาร", "เอรที่เอกสาร",
            "เลขที่ใบแจ้ง", "เพรทีในแจ้ง"
        ])

        candidates = []

        for item in items:
            text = compact(item["text"])

            if re.fullmatch(r"\d{12}", text):
                candidates.append((item, text, False))

            elif re.fullmatch(r"\d{4}-\d{8}", text):
                candidates.append((
                    item, text.replace("-", ""), True
                ))

        if candidates and doc_labels:
            ranked = []

            for item, value, corrected in candidates:
                scores = []

                for label in doc_labels:
                    dy = item["cy"] - label["cy"]
                    dx = abs(item["cx"] - label["cx"])

                    if -20 <= dy <= 180:
                        scores.append(
                            dx + 0.5 * abs(dy)
                        )

                if scores:
                    ranked.append((
                        min(scores), value, corrected
                    ))

            if ranked:
                ranked.sort(key=lambda x: x[0])
                return ranked[0][1]

        # เลขเอกสารในข้อมูลบาร์โค้ด
        for item in items:
            text = normalize(item["text"])

            match = re.search(
                r"\b\d{8}\s+\d{4}\s+\d{2}"
                r"\s+(\d{12})\s+\d{6}\b",
                text
            )

            if match:
                return match.group(1)

        return None

    if bill_type == "fuel":
        # รูปแบบ PT
        for item in items:
            match = re.search(
                r"tran\s*no\s*[:#]?\s*"
                r"([A-Z0-9-]{12,})",
                normalize(item["text"]),
                re.I
            )

            if match:
                return match.group(1)

        # รูปแบบ Shell
        receipt_candidates = [
            item for item in items
            if re.fullmatch(
                r"\d{2}-\d-\d{9,}",
                compact(item["text"])
            )
        ]

        if len(receipt_candidates) == 1:
            return receipt_candidates[0]["text"]

        labels = find_labels(items, [
            "เลขที่ใบเสร็จ", "receiptno",
            "billno", "เลขที่", "เลยที่"
        ])

        if receipt_candidates and labels:
            receipt_candidates.sort(
                key=lambda item: min(
                    distance(item, label)
                    for label in labels
                )
            )
            return receipt_candidates[0]["text"]

        return None

    return None


# ==================================================
# 5. อ่านปริมาณน้ำ
# ==================================================

def extract_water_quantity(items):
    labels = find_labels(items, [
        "หน่วยน้ำที่ใช้", "หน่วยน้ําที่ใช้",
        "หน่วยน้ำที่ช้", "หน่วยน้ําที่ช้",
        "หน่วยน้าที่ใช้", "หล่วยน้ำ"
    ])

    if not labels:
        return None

    candidates = []

    for item in items:
        text = normalize(item["text"])

        match = re.search(
            r"(?<!\d)(\d{1,3}[,.]\d{3})(?!\d)",
            text
        )

        if not match:
            continue

        value = float(
            re.sub(r"\D", "", match.group(1))
        )

        if value <= 0:
            continue

        for label in labels:
            dy = abs(item["cy"] - label["cy"])

            if dy > 140:
                continue

            score = distance(item, label)

            if has_any(text, [
                "ลิตร", "สิตร", "มดร", "มิตร"
            ]):
                score -= 120

            candidates.append((score, value))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[0])
    return candidates[0][1]


# ==================================================
# 6. อ่านปริมาณไฟฟ้า
# ==================================================

def extract_electricity_quantity(items):
    labels = find_labels(items, [
        "consumption", "coneumption",
        "consunction", "จำนวนที่ใช้",
        "จํานวนที่ใช้", "จำนวนทีใช้",
        "จำนวนที่ใ", "จํานวนที่ใ"
    ])

    labels = [
        label for label in labels
        if not has_any(label["text"], [
            "usagehistory", "ประวัติ"
        ])
    ]

    candidates = []

    for item in items:
        text = normalize(item["text"])

        # เลือกเลขที่มีทศนิยมสองตำแหน่ง
        if not re.fullmatch(
            r"\d+(?:,\d{3})*\.\d{2}",
            text
        ):
            continue

        value = numeric_value(text)

        if value is not None:
            candidates.append((item, value))

    if not labels or not candidates:
        return None

    scored = []

    for item, value in candidates:
        for label in labels:
            dx = abs(item["cx"] - label["cx"])
            dy = item["cy"] - label["cy"]

            if 0 < dy < 240:
                scored.append((
                    dx * 2 + dy * 0.4,
                    value
                ))

    if not scored:
        return None

    scored.sort(key=lambda x: x[0])
    return scored[0][1]


# ==================================================
# 7. อ่านชนิดน้ำมัน
# ==================================================

def extract_fuel_type(items):
    for item in items:
        text = compact(item["text"])

        if "e20" in text:
            return "gasohol_e20"

        if "e85" in text:
            return "gasohol_e85"

        if "diesel" in text or "ดีเซล" in text:
            return "diesel"

        fuel_words = [
            "gasohol", "fuelsave",
            "แก๊สโซ", "แก๊สโขอ",
            "g91", "g95"
        ]

        if any(k in text for k in fuel_words):
            if "91" in text:
                return "gasohol_91"

            if "95" in text:
                return "gasohol_95"

    return None


# ==================================================
# 8. อ่านปริมาณน้ำมัน
# ==================================================

def extract_fuel_quantity(items):
    fuel_labels = find_labels(items, [
        "gasohol", "fuelsave",
        "แก๊สโซ", "แก๊สโขอ",
        "diesel", "ดีเซล"
    ])

    # วิธีที่ 1: มีหน่วย L ติดกับตัวเลข
    direct_candidates = []

    for item in items:
        text = normalize(item["text"])

        if has_any(text, [
            "ส่วนลด", "คงเหลือ",
            "แต้ม", "โปรโมชั่น"
        ]):
            continue

        match = re.search(
            r"(?<![\d.])"
            r"(\d+(?:\.\d+)?)"
            r"\s*(?:[Ll]\b|ลิตร\b)",
            text
        )

        if match:
            value = float(match.group(1))

            if value > 0:
                direct_candidates.append((item, value))

    if direct_candidates:
        if fuel_labels:
            direct_candidates.sort(
                key=lambda pair: min(
                    distance(pair[0], label)
                    for label in fuel_labels
                )
            )
        return direct_candidates[0][1]

    # วิธีที่ 2: ใช้หัวข้อและตำแหน่งข้อความ
    if not fuel_labels:
        return None

    quantity_labels = find_labels(items, [
        "จำนวนลิตร", "จํานวนลิตร",
        "ปริมาณ", "ลิตร",
        "liters", "litres"
    ])

    quantity_labels = [
        label for label in quantity_labels
        if not has_any(label["text"], [
            "บาทต่อลิตร", "บาทตอลิตร",
            "ราคาต่อลิตร"
        ])
    ]

    price_labels = find_labels(items, [
        "บาทต่อลิตร", "บาทตอลิตร",
        "ราคาต่อลิตร", "price/l"
    ])

    amount_labels = find_labels(items, [
        "จำนวนเงิน", "จํานวนเงิน",
        "จ้านวนเจิน", "ยอดเงิน",
        "amount"
    ])

    numbers = []

    for item in items:
        text = compact(item["text"])

        if re.fullmatch(
            r"\d{1,3}(?:,\d{3})*\.\d{2}"
            r"|\d{1,6}\.\d{2}",
            text
        ):
            value = numeric_value(text)

            if value is not None and value > 0:
                numbers.append((item, value))

    if not numbers:
        return None

    # วิธีที่ 2.1: ตรวจความสัมพันธ์
    # ยอดเงิน ≈ ราคาต่อลิตร × ปริมาณลิตร
    # ใช้ตรวจสอบ ไม่ใช่คำนวณปริมาณขึ้นมาใหม่
    if price_labels and amount_labels:
        ranked = []

        for amount_item, amount in numbers:
            for price_item, price in numbers:
                if price_item is amount_item:
                    continue

                for qty_item, qty in numbers:
                    if (
                        qty_item is amount_item
                        or qty_item is price_item
                    ):
                        continue

                    fuel_distance = min(
                        distance(qty_item, label)
                        for label in fuel_labels
                    )

                    label_distance = min(
                        distance(price_item, label)
                        for label in price_labels
                    )

                    amount_distance = min(
                        distance(amount_item, label)
                        for label in amount_labels
                    )

                    if (
                        fuel_distance > 450
                        or label_distance > 300
                        or amount_distance > 300
                    ):
                        continue

                    difference = abs(
                        amount - price * qty
                    )

                    tolerance = max(
                        0.10, amount * 0.002
                    )

                    if difference > tolerance:
                        continue

                    score = (
                        fuel_distance
                        + label_distance
                        + amount_distance
                        + difference * 10
                    )

                    if quantity_labels:
                        score += min(
                            distance(qty_item, label)
                            for label in quantity_labels
                        )

                    ranked.append((score, qty))

        if ranked:
            ranked.sort(key=lambda x: x[0])
            return ranked[0][1]

    # วิธีที่ 3: เลือกค่าที่ใกล้หัวข้อปริมาณ
    if quantity_labels:
        ranked = []

        for item, value in numbers:
            for label in quantity_labels:
                score = distance(item, label)

                fuel_distance = min(
                    distance(item, fuel)
                    for fuel in fuel_labels
                )

                if fuel_distance > 450:
                    continue

                if price_labels:
                    price_distance = min(
                        distance(item, price)
                        for price in price_labels
                    )

                    if price_distance < score:
                        continue

                ranked.append((
                    score + fuel_distance * 0.2,
                    value
                ))

        if ranked:
            ranked.sort(key=lambda x: x[0])
            return ranked[0][1]

    return None


# ==================================================
# 9. รวมผลลัพธ์เป็น JSON
# ==================================================

def extract_bill_data(items):
    bill_type = detect_type(items)

    bill_number = extract_bill_number(
        items, bill_type
    )

    period = extract_period(
        items, bill_type
    )

    fuel_type = None
    quantity = None
    unit = None

    if bill_type == "water":
        quantity = extract_water_quantity(items)

        if quantity is not None:
            unit = "L"

    elif bill_type == "electricity":
        quantity = extract_electricity_quantity(items)

        if quantity is not None:
            unit = "kWh"

    elif bill_type == "fuel":
        fuel_type = extract_fuel_type(items)
        quantity = extract_fuel_quantity(items)

        if quantity is not None:
            unit = "L"

    warnings = []

    if bill_type == "unknown":
        warnings.append(
            "ไม่สามารถระบุประเภทบิลได้"
        )

    if bill_number is None:
        warnings.append("ไม่พบเลขที่บิล")

    if period is None:
        warnings.append("ไม่พบเดือนและปี")

    if quantity is None:
        warnings.append("ไม่พบปริมาณการใช้")

    if bill_type == "fuel" and fuel_type is None:
        warnings.append("ไม่พบชนิดน้ำมัน")

    return {
        "bill_type": bill_type,
        "bill_number": bill_number,
        "month": period[0] if period else None,
        "year": period[1] if period else None,
        "fuel_type": fuel_type,
        "quantity": quantity,
        "unit": unit,
        "status": "pending_review",
        "warnings": warnings,
    }
