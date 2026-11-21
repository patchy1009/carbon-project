/*
 * สูตรคำนวณปริมาณที่ลดได้ของแนวทางลดคาร์บอน (แบบเจาะจง) + ค่าอ้างอิงที่เป็นค่าคงที่
 *   แบบเดียวกับ MAI ใน lib/tverCredits.ts: ค่าอ้างอิงเขียนไว้ในโค้ดพร้อมแหล่งที่มา แอดมินไม่ต้องกรอก
 *   แอดมินแค่เลือก "วิธีคำนวณ" ของแนวทาง (carbon_reduction_recommendation.calc_method)
 *   คู่มือแก้ไขสูตร: docs/formula-guide.md   ค้นจุดที่เป็นสูตรทั้งโปรเจกต์: ค้นคำว่า [สูตร]
 *
 * ค่าที่ดึงจากข้อมูลขององค์กร
 *   N   จำนวนอุปกรณ์เดิม  = จำนวนของตัวเลือกในเงื่อนไข "เป็นหนึ่งใน" ของแนวทาง (เช่น Fluorescent 40 ดวง)
 *   H   ชั่วโมงใช้งาน/วัน = หัวข้อข้อมูลสำนักงานชื่อ "ชั่วโมงทำงานต่อวัน" (ค้นจากชื่อ ดู HOURS_INFO_NAME)
 *   D   วันใช้งาน         = หัวข้อ "จำนวนวันทำงาน" (วัน/ปี) ของรายการ: รายปีใช้ตามที่กรอก / รายเดือน ÷ 12
 *   EF  kgCO2e ต่อ kWh    = EF × GWP ของกิจกรรมไฟฟ้าที่แนวทางผูก (ค่าเดียวกับที่ใช้คำนวณฟุตพรินต์)
 *   BTU ขนาดแอร์ต่อเครื่อง = หัวข้อ "ขนาดเครื่องปรับอากาศ" (BTU) ใช้เฉพาะสูตรแอร์ (และใช้เลือกแถว SEER)
 *
 * แหล่งอ้างอิง
 *   [1] พพ. คู่มือชุดความรู้ "อาคารสำนักงาน" บทที่ 3 ระบบไฟฟ้าแสงสว่าง / บทที่ 4 ระบบปรับอากาศ
 *       https://www.dede.go.th/uploads/5_48627556d3.pdf
 *   [2] กฟผ. ข้อกำหนดโครงการฉลากประหยัดไฟฟ้าเบอร์ 5 เครื่องปรับอากาศ (เม.ย. 2567) ตารางที่ 6 และ 7
 *       https://labelno5.egat.co.th/home/wp-content/uploads/2024/04/02_handbook_air_042024.pdf
 *   [3] ม.ทักษิณ รายงานการจัดการพลังงานประจำปี 2567 (ตัวอย่างการคิดผลประหยัด kW ก่อน/หลัง × ชั่วโมงใช้งาน)
 *       https://skenergy.tsu.ac.th/upload/menu/doc_20251009_134757.pdf
 */

/* ===================== [สูตร] ค่าที่ดึงจากข้อมูลสำนักงาน (ค้นจากชื่อหัวข้อ ไม่สนช่องว่าง) ===================== */
//   ถ้าแอดมินเปลี่ยนชื่อหัวข้อเหล่านี้ ต้องแก้ชื่อที่นี่ให้ตรงด้วย ไม่งั้นสูตรหาไม่เจอ
//   (หน้าแอดมินไม่ให้บันทึกแนวทางแบบสูตร และหน้ารายงานแจ้งว่ายังคำนวณไม่ได้)
export const HOURS_INFO_NAME = 'ชั่วโมงทำงานต่อวัน'; // H ชั่วโมงใช้งานต่อวัน (ชม./วัน)
export const DAYS_INFO_NAME = 'จำนวนวันทำงาน';       // D วันทำงานต่อปี (วัน/ปี) รายการรายเดือนใช้ ÷ 12
export const AC_BTU_INFO_NAME = 'ขนาดเครื่องปรับอากาศ'; // ขนาดแอร์ต่อเครื่อง (BTU/ชม.) ใช้เฉพาะสูตรแอร์
const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, '');
export function findInfoIdByName<T extends { info_id: string; info_name: string | null }>(types: T[], name: string): string | null {
  return types.find((t) => squash(t.info_name) === squash(name))?.info_id ?? null;
}

/* ===================== [สูตร] ค่าคงที่: เปลี่ยนหลอด Fluorescent เป็น LED ===================== */
// ที่มา [1] พพ. บทที่ 3: "การคิดกำลังไฟฟ้าต่อหลอดของหลอด FL ให้รวมการสูญเสียที่บัลลาสต์ด้วย
//   บัลลาสต์แกนเหล็กธรรมดา มีกำลังสูญเสียประมาณ 10 วัตต์"   กำลังไฟฟ้ารวม = กำลังไฟฟ้าต่อหลอด (W) × จำนวนหลอด
export const FLUORESCENT_LAMP_W = 36;      // หลอดฟลูออเรสเซนต์ T8 36 W
export const MAGNETIC_BALLAST_LOSS_W = 10; // บัลลาสต์แกนเหล็กธรรมดา [1]
export const LED_TUBE_W = 18;              // หลอด LED T8 ทดแทน 18 W
export const FLUORESCENT_TOTAL_W = FLUORESCENT_LAMP_W + MAGNETIC_BALLAST_LOSS_W; // 46 W

/* ===================== [สูตร] ค่าคงที่: เปลี่ยนแอร์ Fixed Speed (Non-inverter) เป็น Inverter ===================== */
// ที่มา [2] กฟผ. ตารางที่ 6 (Fixed Speed) และ 7 (Variable Speed/Inverter): เกณฑ์ขั้นต่ำของเบอร์ 5 แยกตามขนาดแอร์
//   SEER มีหน่วยเป็น บีทียู/ชั่วโมง ต่อ วัตต์ -> กำลังไฟฟ้า (W) = ขนาดทำความเย็น (บีทียู/ชั่วโมง) ÷ SEER
//   ขนาดแอร์ดึงจากหัวข้อ "ขนาดเครื่องปรับอากาศ" แล้วเลือกแถวตามขนาด (ใหญ่กว่า 61,416 ใช้แถวสุดท้าย)
export const SEER_TABLE: { maxBtu: number; fixed: number; inverter: number }[] = [
  { maxBtu: 27296, fixed: 13.17, inverter: 17.06 }, // ไม่เกิน 8,000 วัตต์
  { maxBtu: 40944, fixed: 12.56, inverter: 16.04 }, // มากกว่า 8,000 - 12,000 วัตต์
  { maxBtu: 61416, fixed: 10.0, inverter: 14.0 },   // มากกว่า 12,000 - 18,000 วัตต์
];
export const seerFor = (btu: number) => SEER_TABLE.find((r) => btu <= r.maxBtu) ?? SEER_TABLE[SEER_TABLE.length - 1];

/* ===================== รายการสูตร (ตัวเลือก "วิธีคำนวณ" ในหน้าแอดมิน) ===================== */
// ค่า value ต้องตรงกับ check ของ calc_method ใน supabase/recommendation_formula.sql
export type CalcMethod = 'percent' | 'lamp_led' | 'ac_inverter';
export const CALC_METHODS: { value: CalcMethod; label: string }[] = [
  { value: 'percent', label: '% ของการปล่อยจากกิจกรรมที่ผูก (แบบเดิม)' },
  { value: 'lamp_led', label: 'สูตร: เปลี่ยนหลอด Fluorescent เป็น LED' },
  { value: 'ac_inverter', label: 'สูตร: เปลี่ยนแอร์ Fixed Speed เป็น Inverter' },
];
export const isFormulaMethod = (m: string | null | undefined): m is Exclude<CalcMethod, 'percent'> =>
  m === 'lamp_led' || m === 'ac_inverter';

const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

// ผลของสูตร: kWh ที่ลดได้ในช่วงเวลาของรายการ + ข้อความสั้นที่แสดงในรายงาน (เช่น "เปลี่ยน 50 หลอด")
export type FormulaResult = { kwh: number; note: string };

/* ===================== [สูตร] สูตรคำนวณ kWh ที่ลดได้ ===================== */
//   n = จำนวนอุปกรณ์เดิม (N), hours = ชั่วโมงใช้งาน/วัน (H), days = วันใช้งานในช่วงเวลาของรายการ (D)
//   acBtu = ขนาดแอร์ต่อเครื่อง (BTU/ชม.) ใช้เฉพาะสูตรแอร์ (applyFormula ตรวจว่ามีค่าก่อนเรียก)
//   ผลเป็น kWh -> lib/recommendation.ts (applyFormula) คูณ EF ÷ 1000 เป็น tCO2e
export function formulaSaving(
  method: Exclude<CalcMethod, 'percent'>, n: number, hours: number, days: number, acBtu = 0
): FormulaResult {
  if (method === 'lamp_led') {
    // [สูตร] หลอดไฟ [1]: E (kWh) = N × (P_เดิม − P_ใหม่) × H × D ÷ 1000
    //   P_เดิม = 36 + 10 (บัลลาสต์) = 46 W, P_ใหม่ = 18 W
    const kwh = (n * (FLUORESCENT_TOTAL_W - LED_TUBE_W) * hours * days) / 1000;
    return { kwh, note: `เปลี่ยน ${fmt(n)} หลอด` };
  }
  // [สูตร] แอร์ [2]: P (W) = BTU/ชม. ÷ SEER  ->  E (kWh) = N × (P_เดิม − P_ใหม่) × H × D ÷ 1000
  //   SEER เลือกแถวตามขนาดแอร์ เช่น 12,000 BTU: P_เดิม = 12,000 ÷ 13.17 ≈ 911 W, P_ใหม่ = 12,000 ÷ 17.06 ≈ 703 W
  const seer = seerFor(acBtu);
  const pOld = acBtu / seer.fixed;
  const pNew = acBtu / seer.inverter;
  const kwh = (n * (pOld - pNew) * hours * days) / 1000;
  return { kwh, note: `เปลี่ยน ${fmt(n)} เครื่อง` };
}
