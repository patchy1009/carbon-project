// lib/bills/dates.ts
// [ลบ] ฟังก์ชันหาวันที่จากข้อความบิล (findDates, majorityMonth, toCE ...) ของระบบ Tesseract เดิม
//   ตอนนี้ Python (scripts/extract_bill_data.py) อ่านวันที่ให้แล้ว ไม่มีที่ไหนเรียกใช้ ดูของเดิมใน git

const SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// สร้างข้อความเดือนและปี พ.ศ. จากวันที่ YYYY-MM-DD เช่น "2026-03-01" -> "มี.ค. 2569"
export function monthLabel(d: string) {
  const month = Number(d.slice(5, 7));
  const year = Number(d.slice(0, 4)) + 543;
  return `${SHORT[month - 1]} ${year}`;
}
