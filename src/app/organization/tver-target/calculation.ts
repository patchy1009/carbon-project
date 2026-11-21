// สูตรของโหมด "จำลองโครงการ T-VER จากการกักเก็บก๊าซเรือนกระจก"
//   องค์กรกรอกแค่ เป้าหมาย (tCO2e) และปีสะสม t
//   ระบบตอบว่า ต้องปลูกกี่ต้น ต้องใช้พื้นที่กี่ไร่ และพื้นที่ผ่านเงื่อนไขพื้นที่โครงการไหม
//
// สูตรหลัก: CTT = T × t × MAI × 10^-3   (T-VER-S-TOOL-01-01, MAI = 9.5 kgCO2/ต้น/ปี)
//
// ลำดับสูตร (ตรงกับที่ใช้อธิบายในเล่ม)
//   1) จำนวนต้นที่ต้องปลูก = ⌈เป้าหมาย ÷ (t × MAI × 10^-3)⌉
//   2) พื้นที่ต่อต้น        = ระยะปลูกมาตรฐาน 4 × 4 ม. = 16 ตร.ม. (1 ไร่ปลูกได้ 100 ต้น)
//   3) พื้นที่ที่ต้องใช้    = ⌈จำนวนต้น × พื้นที่ต่อต้น ÷ 1,600⌉ ไร่   (1 ไร่ = 1,600 ตร.ม.)
//   4) เกณฑ์พื้นที่โครงการ  = พื้นที่ที่ต้องใช้ ต้องไม่เกิน 1,000 ไร่ (ตามเงื่อนไขของแอดมิน)
//
// การปัดเศษตามหลักความระมัดระวัง (conservativeness): ปัดขึ้นทั้งจำนวนต้นและพื้นที่ ให้ถึงเป้าแน่นอน
//
// คิดด้วยจำนวนเต็ม (BigInt) เพราะทศนิยมในคอมพิวเตอร์เก็บไม่ตรงเป๊ะ
//   ค่าที่กรอกจึงแปลงเป็น "หน่วยละ 0.01" ก่อน (ฟอร์มจำกัดทศนิยมไม่เกิน 2 หลัก)

import { MAI_KG_CO2_PER_TREE_PER_YEAR } from '@/lib/tverCredits'; // ใช้ MAI ตัวเดียวกับโหมดเดิม
import { meetsCondition } from '@/lib/validation';
import type { ConditionOperator } from '@/lib/normalization';

export const SQM_PER_RAI = 1600; // 1 ไร่ = 1,600 ตร.ม.
// เกณฑ์ของ T-VER-S-TOOL-01-01 ใช้เมื่อแอดมินยังไม่ได้ตั้งเงื่อนไขในหน้า T-VER Project
export const TVER_DEFAULT_MAX_PLOT_RAI = 30; // แปลงย่อยไม่เกิน 30 ไร่
export const TVER_DEFAULT_MAX_PROJECT_RAI = 1000; // พื้นที่โครงการไม่เกิน 1,000 ไร่
// ปีสะสม t: อายุโครงการภาคป่าไม้ 10 ปี (Guideline for Standard T-VER V.7.0 ข้อ 10) ค่าเริ่มต้น 3 ปีให้ตรงกับโหมดเดิม
export const TARGET_YEAR_MIN = 1;
export const TARGET_YEAR_MAX = 10;
export const TARGET_YEAR_DEFAULT = 3;
// ระยะปลูกมาตรฐานที่ใช้คิดพื้นที่ (ระยะห่างระหว่างต้น × ระยะห่างระหว่างแถว)
export const STANDARD_SPACING_M = 4;

export type AreaLimit = { operator: ConditionOperator; value: number };

export type PlanInput = {
  targetTco2e: number;
  year: number;
  maxProjectArea: AreaLimit; // เพดานพื้นที่โครงการ (ข้อ 4)
};

export type PlanResult = {
  treesNeeded: number; // ข้อ 1
  areaPerTreeSqm: number; // ข้อ 2
  treesPerRai: number; // 1,600 ÷ พื้นที่ต่อต้น
  areaRai: number; // ข้อ 3
  withinLimit: boolean; // ข้อ 4
};

/* ---------- เลขจำนวนเต็ม ---------- */
const B = (n: number) => BigInt(n);
const ONE = B(1);
// ค่าทศนิยมไม่เกิน 2 หลัก -> จำนวนเต็มหน่วยละ 0.01 (เช่น 12.5 -> 1250)
const toCenti = (x: number) => B(Math.round(x * 100));
const ceilDiv = (a: bigint, b: bigint) => (a + b - ONE) / b;
// MAI ในหน่วยละ 0.1 (9.5 -> 95) เพื่อคิดเป็นจำนวนเต็ม
const MAI_TENTHS = B(Math.round(MAI_KG_CO2_PER_TREE_PER_YEAR * 10));
// ข้อ 2: พื้นที่ต่อต้นในหน่วยละ 0.0001 ตร.ม. (ซม. × ซม.)
const PER_TREE_UNITS = toCenti(STANDARD_SPACING_M) * toCenti(STANDARD_SPACING_M);

/* ใช้เงื่อนไขที่แอดมินตั้งไว้เป็นเพดาน ถ้าไม่มี หรือไม่ใช่เงื่อนไขแบบ "ไม่เกิน/น้อยกว่า" ใช้ค่าตามเกณฑ์ T-VER */
export function upperLimitFrom(
  criteria: ReadonlyArray<{ detail_name: string | null; condition_operator: string | null; condition_number: number | null }>,
  name: string,
  fallback: number
): AreaLimit {
  const c = criteria.find((x) => x.detail_name === name);
  if (c && (c.condition_operator === '<=' || c.condition_operator === '<') && c.condition_number != null) {
    return { operator: c.condition_operator, value: Number(c.condition_number) };
  }
  return { operator: '<=', value: fallback };
}

/* คำนวณทั้งแผน (ค่าที่ส่งเข้ามาต้องผ่านการตรวจในฟอร์มแล้ว) */
export function calculateTargetPlan(input: PlanInput): PlanResult {
  const year = Math.round(input.year);
  // ข้อ 1: ⌈เป้าหมาย ÷ (t × MAI × 10^-3)⌉ = ⌈targetCenti × 100 ÷ (t × MAI_TENTHS)⌉
  const trees = ceilDiv(toCenti(input.targetTco2e) * B(100), B(year) * MAI_TENTHS);
  // ข้อ 3: ⌈ต้น × พื้นที่ต่อต้น ÷ 1,600⌉ = ⌈ต้น × units ÷ (10,000 × 1,600)⌉
  const area = ceilDiv(trees * PER_TREE_UNITS, B(10000 * SQM_PER_RAI));
  const areaRai = Number(area);
  return {
    treesNeeded: Number(trees),
    areaPerTreeSqm: Number(PER_TREE_UNITS) / 10000,
    treesPerRai: Number(B(SQM_PER_RAI * 10000) / PER_TREE_UNITS),
    areaRai,
    withinLimit: meetsCondition(areaRai, input.maxProjectArea.operator, input.maxProjectArea.value), // ข้อ 4
  };
}
