
/*์ Normalization ของทุกช่องข้อความ */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return "";  //ไม่มีค่าให้ return เป็น string ว่าง
  return input
    .normalize("NFD") // แยกตัวอักษรและเครื่องหมายวรรณยุกต์ออกจากกัน
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // ลบอักขระล่องหนที่ติดมาตอน copy paste
    .replace(/\s+/g, " ") // ยุบช่องว่างติดกันให้เหลือ 1 ตัว
    .trim(); // ตัดช่องว่างหัวท้าย
}

/* Normalization ช่องรายละเอียด */
export function normalizeTextArea(input: string | null | undefined): string {
  if (!input) return "";  //ไม่มีค่าให้ return เป็น string ว่าง
  return input
    .normalize("NFD") // แยกตัวอักษรและเครื่องหมายวรรณยุกต์ออกจากกัน
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // ลบอักขระล่องหนที่ติดมาตอน copy paste
    .replace(/[ \t]+/g, " ") // ยุบ space และ tab ติดกันให้เหลือ 1 ตัว
    .replace(/\n{3,}/g, "\n\n") // บรรทัดว่างเกิน 2 ให้เหลือ 1 บรรทัด
    .trim(); // ตัดช่องว่างหัวท้าย
}

/* Normalization ให้เป็น arabic number string */
const thaidigit = '๐๑๒๓๔๕๖๗๘๙';
export function normalizeNumberString(input: string | null | undefined): string {
    const base = normalizeText(input);
    return base
        .replace(/[๐-๙]/g, (d) => String(thaidigit.indexOf(d))) // แปลงเลขไทยเป็นเลขอารบิก
        .replace(/,/g, '') // ลบ comma
        .replace(/\s/g, ''); // ลบ space
}

/* Normalization ให้เป็น string เป็น เลขอารบิก */
export function normalizeToArabicNumber(input: string | null | undefined): number | null {
    const result = normalizeNumberString(input);
    if (result === '') return null; // ถ้าไม่มีค่าให้ return null
    if (!/^\d+(\.\d+)?$/.test(result)) return null; // ถ้าไม่ใช่ตัวเลขให้ return null
    return Number(result);
}

/* Normalization เทียบข้อมูลซ้ำ */
export function normalizeForCompare(input: string | null | undefined): string {
  return normalizeText(input).toLowerCase(); // แปลงเป็นตัวพิมพ์เล็กเพื่อตรวจสอบความเหมือน
}

