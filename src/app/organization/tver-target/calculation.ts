// สูตรของโหมด "จำลองโครงการ T-VER จากเป้าหมายการกักเก็บคาร์บอน"
//   องค์กรกรอกเป้าหมาย (tCO2e) ปีที่ t พันธุ์ไม้ ระยะปลูก และแปลงที่มี
//   ระบบตอบว่า ต้องปลูกกี่ต้น ที่ดินที่มีพอไหม และถ้าไม่พอต้องเพิ่มพื้นที่อีกกี่ไร่ (แยกทีละพันธุ์)
//
// ใช้สูตรหลัก 2 ตัว คิดไปข้างหน้าและย้อนกลับ
//   ไร่ <-> ต้น : ต้น = ไร่ × 1,600 ÷ พื้นที่ต่อต้น (1 ไร่ = 1,600 ตร.ม.)
//   ต้น <-> ตัน : CTT = T × t × MAI × 10^-3   (T-VER-S-TOOL-01-01, MAI = 9.5 kgCO2/ต้น/ปี)
//
// ลำดับสูตร (ตรงกับที่ใช้อธิบายในเล่ม) เทียบเป็น "จำนวนต้น" ทั้งหมด ไม่ต้องแปลงกลับเป็นตัน
//   1) พื้นที่ต่อต้น          = ระยะห่างระหว่างต้น × ระยะห่างระหว่างแถว
//   2) T ที่ที่ดินรองรับได้    = รวมทุกพันธุ์ของ ⌊พื้นที่ปลูก (ไร่) × 1,600 ÷ พื้นที่ต่อต้น⌋
//   3) T ตามเป้าหมาย         = ⌈เป้าหมาย ÷ (t × MAI × 10^-3)⌉
//   4) ต้นที่ขาด              = T ตามเป้าหมาย − T ที่ที่ดินรองรับได้  (≤ 0 = ที่ดินพอ, > 0 = ไม่พอ)
//   5) พื้นที่ที่ต้องเพิ่ม     = ⌈ต้นที่ขาด × พื้นที่ต่อต้น ÷ 1,600⌉  (คิดทีละพันธุ์)
//   6) เกณฑ์พื้นที่โครงการ    = พื้นที่เดิมรวมทุกพันธุ์ + พื้นที่ที่ต้องเพิ่ม ต้องไม่เกิน 1,000 ไร่
//   กรณียังไม่มีพื้นที่ปลูก (พันธุ์ไม่มีแปลง) ใช้สูตรเดิมทั้งหมด: ต้นที่ปลูกได้ = 0 จึงได้ต้นที่ขาด = ต้นตามเป้าหมาย
//   แล้วข้อ 5 คือพื้นที่ที่ต้องใช้ทั้งหมด
//
// การปัดเศษตามหลักความระมัดระวัง (conservativeness) ของ T-VER: ไม่ประเมินคาร์บอนเกินจริง
//   ปัดลง : ต้นที่ปลูกได้ (ปลูกได้เฉพาะต้นเต็ม)
//   ปัดขึ้น: ต้นตามเป้าหมาย และพื้นที่ที่ต้องเพิ่ม (ให้ถึงเป้าแน่นอน)
//
// คิดด้วยจำนวนเต็ม (BigInt) ทั้งหมด เพราะทศนิยมในคอมพิวเตอร์เก็บไม่ตรงเป๊ะ
//   เช่น 7 ไร่ ระยะ 2 × 3.5 ม. ต้องได้ 1,600 ต้นพอดี แต่คิดแบบทศนิยมได้ 1,599.9999... แล้วปัดลงเหลือ 1,599
//   ค่าที่กรอกจึงแปลงเป็น "หน่วยละ 0.01" ก่อน (ฟอร์มจำกัดทศนิยมไม่เกิน 2 หลัก)

import { MAI_KG_CO2_PER_TREE_PER_YEAR } from '@/lib/tverCredits'; // ใช้ MAI ตัวเดียวกับโหมดเดิม
import { meetsCondition } from '@/lib/validation';
import type { ConditionOperator } from '@/lib/normalization';

export const SQM_PER_RAI = 1600; // 1 ไร่ = 1,600 ตร.ม.
// เกณฑ์ของ T-VER-S-TOOL-01-01 ใช้เมื่อแอดมินยังไม่ได้ตั้งเงื่อนไขในหน้า T-VER Project
export const TVER_DEFAULT_MAX_PLOT_RAI = 30; // แปลงย่อยไม่เกิน 30 ไร่
export const TVER_DEFAULT_MAX_PROJECT_RAI = 1000; // พื้นที่โครงการไม่เกิน 1,000 ไร่
// ปีที่ t: ระยะคิดเครดิตโครงการป่าไม้ 10 ปี ค่าเริ่มต้น 3 ปีให้ตรงกับโหมดเดิม
export const TARGET_YEAR_MIN = 1;
export const TARGET_YEAR_MAX = 10;
export const TARGET_YEAR_DEFAULT = 3;
export const DEFAULT_SPACING_M = 4; // ระยะปลูกเริ่มต้น 4 × 4 ม.
export const MIN_SPACING_M = 1;

export type AreaLimit = { operator: ConditionOperator; value: number };

export type PlotInput = { sizeRai: number; count: number };

export type SpeciesInput = {
  key: string; // ชื่อพันธุ์ (ไม่ซ้ำในแผนเดียวกัน)
  name: string;
  spacingTreeM: number; // ระยะห่างระหว่างต้น (ม.)
  spacingRowM: number; // ระยะห่างระหว่างแถว (ม.)
  plots: PlotInput[];
};

export type PlanInput = {
  targetTco2e: number;
  year: number;
  species: SpeciesInput[];
  maxProjectArea: AreaLimit; // เพดานพื้นที่โครงการ (ข้อ 6)
};

export type SpeciesResult = {
  key: string;
  name: string;
  areaPerTreeSqm: number; // ข้อ 1
  areaRai: number; // พื้นที่ของพันธุ์นี้ = ผลรวม (ขนาดแปลง × จำนวนแปลง)
  treesCapacity: number; // ข้อ 2 (ของพันธุ์นี้)
  // ทางเลือกเพิ่มพื้นที่ มีค่าเฉพาะตอนที่ดินไม่พอ
  addRai: number | null; // ข้อ 5
  totalRaiAfterAdd: number | null; // พื้นที่เดิมรวม + addRai
  withinLimit: boolean | null; // ข้อ 6
};

export type PlanResult = {
  areaRai: number; // พื้นที่เดิมรวมทุกพันธุ์
  treesCapacity: number; // ข้อ 2 T ที่ที่ดินรองรับได้
  treesNeeded: number; // ข้อ 3 T ตามเป้าหมาย
  treeGap: number; // ข้อ 4 ต้นที่ขาด (ติดลบได้ = ปลูกได้เกินเป้า)
  isSufficient: boolean; // ต้นที่ขาด ≤ 0
  treesShort: number; // ต้นที่ขาด (0 ถ้าที่ดินพอ) ใช้คิดข้อ 5
  species: SpeciesResult[];
  hasFeasibleOption: boolean; // มีพันธุ์ที่เพิ่มพื้นที่แล้วไม่เกินเพดานอย่างน้อย 1 พันธุ์ (มีความหมายเมื่อที่ดินไม่พอ)
};

/* ---------- เลขจำนวนเต็ม ---------- */
const B = (n: number) => BigInt(n);
const ZERO = B(0);
const ONE = B(1);
// ค่าทศนิยมไม่เกิน 2 หลัก -> จำนวนเต็มหน่วยละ 0.01 (เช่น 12.5 -> 1250)
const toCenti = (x: number) => B(Math.round(x * 100));
// หารปัดลง / ปัดขึ้น (ตัวตั้งไม่ติดลบ ตัวหารมากกว่า 0)
const floorDiv = (a: bigint, b: bigint) => a / b;
const ceilDiv = (a: bigint, b: bigint) => (a + b - ONE) / b;
// MAI ในหน่วยละ 0.1 (9.5 -> 95) เพื่อคิดเป็นจำนวนเต็ม
const MAI_TENTHS = B(Math.round(MAI_KG_CO2_PER_TREE_PER_YEAR * 10));

/* ข้อ 1: พื้นที่ต่อต้น (ตร.ม.) ในหน่วยละ 0.0001 ตร.ม. (ซม. × ซม.) */
const areaPerTreeUnits = (s: SpeciesInput) => toCenti(s.spacingTreeM) * toCenti(s.spacingRowM);

/* พื้นที่ของพันธุ์ในหน่วยละ 0.01 ไร่ */
const speciesAreaCenti = (s: SpeciesInput) =>
  s.plots.reduce((sum, p) => sum + toCenti(p.sizeRai) * B(Math.round(p.count)), ZERO);

/* ข้อ 2 (ทีละพันธุ์): ⌊ไร่ × 1,600 ÷ พื้นที่ต่อต้น⌋
 * = ⌊(areaCenti/100) × 1,600 ÷ (units/10,000)⌋ = ⌊areaCenti × 160,000 ÷ units⌋ */
function treesOnArea(areaCenti: bigint, perTreeUnits: bigint): bigint {
  if (perTreeUnits <= ZERO) return ZERO;
  return floorDiv(areaCenti * B(SQM_PER_RAI * 100), perTreeUnits);
}

/* ข้อ 3: ⌈เป้าหมาย ÷ (t × MAI × 10^-3)⌉ = ⌈targetCenti × 100 ÷ (t × MAI_TENTHS)⌉ */
function treesForTarget(targetCenti: bigint, year: number): bigint {
  return ceilDiv(targetCenti * B(100), B(year) * MAI_TENTHS);
}

/* ข้อ 5: ⌈ต้นที่ขาด × พื้นที่ต่อต้น ÷ 1,600⌉ = ⌈ΔT × units ÷ (10,000 × 1,600)⌉ (ได้เป็นไร่เต็ม) */
function raiForTrees(trees: bigint, perTreeUnits: bigint): bigint {
  return ceilDiv(trees * perTreeUnits, B(10000 * SQM_PER_RAI));
}

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
  const targetCenti = toCenti(input.targetTco2e);

  const perSpecies = input.species.map((s) => {
    const units = areaPerTreeUnits(s);
    const areaCenti = speciesAreaCenti(s);
    return { s, units, areaCenti, trees: treesOnArea(areaCenti, units) };
  });

  const areaCenti = perSpecies.reduce((sum, x) => sum + x.areaCenti, ZERO);
  const treesCapacity = perSpecies.reduce((sum, x) => sum + x.trees, ZERO); // ข้อ 2
  const treesNeeded = treesForTarget(targetCenti, year); // ข้อ 3
  const treeGap = treesNeeded - treesCapacity; // ข้อ 4
  const isSufficient = treeGap <= ZERO;
  const treesShort = isSufficient ? ZERO : treeGap;

  const species: SpeciesResult[] = perSpecies.map(({ s, units, areaCenti: spAreaCenti, trees }) => {
    let addRai: number | null = null;
    let totalRaiAfterAdd: number | null = null;
    let withinLimit: boolean | null = null;
    if (!isSufficient) {
      const add = raiForTrees(treesShort, units); // ข้อ 5
      addRai = Number(add);
      totalRaiAfterAdd = Number(areaCenti + add * B(100)) / 100;
      withinLimit = meetsCondition(totalRaiAfterAdd, input.maxProjectArea.operator, input.maxProjectArea.value); // ข้อ 6
    }
    return {
      key: s.key,
      name: s.name,
      areaPerTreeSqm: Number(units) / 10000,
      areaRai: Number(spAreaCenti) / 100,
      treesCapacity: Number(trees),
      addRai,
      totalRaiAfterAdd,
      withinLimit,
    };
  });

  return {
    areaRai: Number(areaCenti) / 100,
    treesCapacity: Number(treesCapacity),
    treesNeeded: Number(treesNeeded),
    treeGap: Number(treeGap),
    isSufficient,
    treesShort: Number(treesShort),
    species,
    hasFeasibleOption: species.some((x) => x.withinLimit === true),
  };
}
