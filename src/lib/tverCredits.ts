// สูตรคาร์บอนเครดิต T-VER ของ cyn2 (= T-VER สูตรที่ 4 คำนวณปริมาณการกักเก็บคาร์บอนของต้นไม้)
//   CTT(t) = T × t × MAI × 10^-3   (tCO2e, ยอดสะสมถึงปีที่ t)
//   T = จำนวนต้นไม้ในพื้นที่โครงการทั้งหมด (ต้น), t = ปีที่ติดตามผล, MAI = 9.5 kgCO2/ต้น/ปี
// [MERGE aom + cyn2] ยกสูตรเดียวกับ yearlyCredits ใน tver_simulation/page.tsx ของ cyn2 มาไว้ที่เดียว
//   ใช้ทั้งหน้าจำลองโครงการของ aom (tver-simulation) และหน้าจัดสรรของ cyn2 (tver_simulation)
export const MAI_KG_CO2_PER_TREE_PER_YEAR = 9.5;

// เครดิตปีที่ 1-3 ปัดทศนิยม 2 ตำแหน่ง (แบบเดียวกับ cyn2)
export function calculateTverCredits(totalTrees: number): [number, number, number] {
  const trees = Math.max(0, Number(totalTrees) || 0);
  const credit = (year: number) => Math.round(trees * year * MAI_KG_CO2_PER_TREE_PER_YEAR * 0.001 * 100) / 100;
  return [credit(1), credit(2), credit(3)];
}
