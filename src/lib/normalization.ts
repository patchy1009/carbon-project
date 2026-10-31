/* =====================================================================
 * Normalization กลาง: แปลงค่าที่ผู้ใช้กรอกให้อยู่ในรูปแบบเดียวกันก่อนตรวจ (validate) และก่อนบันทึก
 * ทุกฟังก์ชันรับ string | null | undefined และไม่ throw error
 * ===================================================================== */

/* Normalization ของทุกช่องข้อความ (บรรทัดเดียว)
 * [แก้ไข] เดิมใช้ .normalize("NFD") ซึ่ง "แยก" ตัวอักษรกับเครื่องหมายออกจากกัน
 *   เช่น é -> e + ́  ทำให้ข้อความที่ดูเหมือนกันเก็บลง DB ต่างกัน และตกการตรวจ englishOnly
 *   เปลี่ยนเป็น NFC = "รวม" ให้เป็นรูปแบบมาตรฐานเดียว (เป็นรูปแบบที่ Postgres/เว็บใช้ทั่วไป) */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return ""; // ไม่มีค่าให้ return เป็น string ว่าง
  return input
    .normalize("NFC") // รวมตัวอักษรและเครื่องหมายให้เป็นรูปแบบมาตรฐานเดียว
    .replace(/[​-‍﻿]/g, "") // ลบอักขระล่องหนที่ติดมาตอน copy paste
    .replace(/ /g, " ") // [เพิ่ม] non-breaking space (ติดมาจาก Word/เว็บ) -> space ปกติ
    .replace(/\s+/g, " ") // ยุบช่องว่างติดกัน (รวม tab/ขึ้นบรรทัด) ให้เหลือ 1 ตัว
    .trim(); // ตัดช่องว่างหัวท้าย
}

/* Normalization ช่องรายละเอียด (textarea: ขึ้นบรรทัดใหม่ได้) */
export function normalizeTextArea(input: string | null | undefined): string {
  if (!input) return ""; // ไม่มีค่าให้ return เป็น string ว่าง
  return input
    .normalize("NFC") // [แก้ไข] NFD -> NFC เหตุผลเดียวกับ normalizeText
    .replace(/[​-‍﻿]/g, "") // ลบอักขระล่องหนที่ติดมาตอน copy paste
    .replace(/\r\n?/g, "\n") // [เพิ่ม] ขึ้นบรรทัดแบบ Windows (\r\n) -> \n ให้เหมือนกันทุกเครื่อง
    .replace(/ /g, " ") // [เพิ่ม] non-breaking space -> space ปกติ
    .replace(/[ \t]+/g, " ") // ยุบ space และ tab ติดกันให้เหลือ 1 ตัว
    .replace(/ *\n */g, "\n") // [เพิ่ม] ตัด space ที่ค้างหน้า/ท้ายแต่ละบรรทัด
    .replace(/\n{3,}/g, "\n\n") // บรรทัดว่างติดกันเกิน 1 บรรทัด ให้เหลือ 1 บรรทัด
    .trim(); // ตัดช่องว่างหัวท้าย
}

/* Normalization ให้เป็นสตริงตัวเลขอารบิก เช่น " ๑,๒๓๔.๕ " -> "1234.5"
 * ยังไม่แปลงเป็น number เพื่อให้ validation นับจำนวนหลักทศนิยมที่ผู้ใช้กรอกได้ */
const thaidigit = "๐๑๒๓๔๕๖๗๘๙";
export function normalizeNumberString(input: string | null | undefined): string {
  const base = normalizeText(input);
  return base
    .replace(/[๐-๙]/g, (d) => String(thaidigit.indexOf(d))) // แปลงเลขไทยเป็นเลขอารบิก
    .replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10)) // [เพิ่ม] เลขเต็มความกว้าง (คีย์บอร์ดญี่ปุ่น/จีน)
    .replace(/[−–—]/g, "-") // [เพิ่ม] เครื่องหมายลบแบบ unicode -> "-" ปกติ (ให้ตรวจค่าติดลบได้)
    .replace(/,/g, "") // ลบ comma คั่นหลักพัน
    .replace(/\s/g, "") // ลบ space
    .replace(/^\+/, ""); // [เพิ่ม] ตัดเครื่องหมาย + นำหน้า เช่น "+5" -> "5"
}

/* Normalization ให้เป็น number (ใช้ตอนบันทึกลง DB)
 * [แก้ไข] เดิม regex ไม่รับเครื่องหมายลบ ทำให้ "-5" กลายเป็น null
 *   -> isDecimal แจ้งว่า "ต้องเป็นตัวเลข" แทนที่จะแจ้ง "ห้ามติดลบ" และตัวเลือก allowNegative ใช้งานไม่ได้
 *   ตอนนี้รับ -5, 5, 5.25, -0.5 และ .5 (ตีความเป็น 0.5) */
export function normalizeToArabicNumber(input: string | null | undefined): number | null {
  const result = normalizeNumberString(input);
  if (result === "") return null; // ถ้าไม่มีค่าให้ return null
  if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(result)) return null; // ถ้าไม่ใช่ตัวเลขให้ return null
  const n = Number(result);
  return Number.isFinite(n) ? n : null; // กันค่าใหญ่เกินจนเป็น Infinity
}

/* Normalization เทียบข้อมูลซ้ำ
 * ใช้ "เทียบ" เท่านั้น ห้ามใช้ค่าที่ได้ไปบันทึก (เพราะตัวพิมพ์เล็กหมด)
 * [เพิ่ม] ลบ space ทั้งหมดก่อนเทียบ เพื่อให้ "kg CO2" กับ "kgCO2" ถือว่าซ้ำกัน */
export function normalizeForCompare(input: string | null | undefined): string {
  return normalizeText(input).toLowerCase().replace(/\s/g, "");
}

/* =====================================================================
 * [เพิ่มใหม่] เงื่อนไขแบบ "ตัวดำเนินการ + ตัวเลข" (ใช้กับเงื่อนไขโครงการ T-VER)
 * [แก้ไข] เดิมให้พิมพ์เป็นข้อความ เช่น "<= 1000" แล้วระบบแกะเอง (ผู้ใช้พิมพ์ได้หลายแบบ เดาผิดได้)
 *   เปลี่ยนเป็นให้เลือกตัวดำเนินการจาก dropdown + พิมพ์ตัวเลขแยกช่อง
 *   แล้วเก็บลง DB เป็น 2 คอลัมน์ condition_operator / condition_number เอาไปเทียบได้ตรงๆ
 * ===================================================================== */
export type ConditionOperator = ">" | ">=" | "<" | "<=" | "=";

// ตัวเลือกใน dropdown (ค่า value ต้องตรงกับ check constraint ในตาราง tver_project_detail)
export const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: ">", label: "มากกว่า" },
  { value: ">=", label: "มากกว่าหรือเท่ากับ" },
  { value: "<", label: "น้อยกว่า" },
  { value: "<=", label: "ไม่เกิน (น้อยกว่าหรือเท่ากับ)" },
  { value: "=", label: "เท่ากับ" },
];

/* ข้อความแสดงเงื่อนไข เช่น ("<=", 1000, "ไร่") -> "<= 1,000 ไร่" คืน "" ถ้าไม่มีเงื่อนไข */
export function formatCondition(
  operator: string | null | undefined,
  value: number | null | undefined,
  unit?: string | null
): string {
  if (!operator || value == null) return "";
  return `${operator} ${Number(value).toLocaleString("th-TH")}${unit ? ` ${unit}` : ""}`;
}

/* =====================================================================
 * [เพิ่มใหม่] ชื่อไฟล์สำหรับเก็บใน Supabase Storage
 * Storage ไม่รับ key ที่มีอักษรไทย/อักขระพิเศษบางตัว (ขึ้น "Invalid key")
 * จึงตั้งชื่อใหม่เป็น เวลา-สุ่ม.นามสกุล แล้วเก็บชื่อเดิมไว้ในคอลัมน์ชื่อเอกสารแทน
 * ===================================================================== */
export function fileExtension(name: string | null | undefined): string {
  const n = normalizeText(name);
  const dot = n.lastIndexOf(".");
  return dot > 0 ? n.slice(dot + 1).toLowerCase() : ""; // ".env" (จุดตัวแรก) ไม่นับเป็นนามสกุล
}

export function safeStorageName(fileName: string): string {
  const ext = fileExtension(fileName);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${rand}${ext ? `.${ext}` : ""}`;
}

/* ชื่อไฟล์ไม่เอานามสกุล ใช้เติมชื่อเอกสารอัตโนมัติ เช่น "รายงาน_2569.pdf" -> "รายงาน_2569" */
export function fileBaseName(fileName: string): string {
  return normalizeText(fileName.replace(/\.[^/.]+$/, ""));
}
