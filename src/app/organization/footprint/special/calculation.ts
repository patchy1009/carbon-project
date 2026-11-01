
/* =========================================
   STEP 3: Special Carbon Footprint
   สูตรคำนวณ Carbon Footprint จากกิจกรรมองค์กร
   ========================================= */

// ข้อมูล Emission Factor
export type EmissionFactor = {
  value: number;
  unit: string;
};

// ผลลัพธ์การคำนวณ
export type CalculationResult = {
  emission: number;
  unit: "kgCO2e";
};

// ตรวจสอบข้อมูลก่อนคำนวณ
function validateInput(amount: number, ef: number) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("จำนวนข้อมูลต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
  }

  if (!Number.isFinite(ef) || ef < 0) {
    throw new Error("ค่า Emission Factor ไม่ถูกต้อง");
  }
}

// สูตรพื้นฐาน: ปริมาณกิจกรรม × Emission Factor
export function calculateEmission(
  amount: number,
  emissionFactor: number
): CalculationResult {
  validateInput(amount, emissionFactor);

  return {
    emission: amount * emissionFactor,
    unit: "kgCO2e",
  };
}

// สูตรการเดินทาง
// ระยะทาง × จำนวนเที่ยว × จำนวนผู้เดินทาง × EF
export function calculateTravelEmission(
  distanceKm: number,
  trips: number,
  people: number,
  emissionFactor: number
): CalculationResult {
  validateInput(distanceKm, emissionFactor);
  validateInput(trips, emissionFactor);
  validateInput(people, emissionFactor);

  const totalDistance = distanceKm * trips * people;

  return calculateEmission(totalDistance, emissionFactor);
}

// สูตรการใช้ไฟฟ้า
// ปริมาณไฟฟ้า (kWh) × EF (kgCO2e/kWh)
export function calculateElectricityEmission(
  electricityKwh: number,
  emissionFactor: number
): CalculationResult {
  return calculateEmission(electricityKwh, emissionFactor);
}

// สูตรรวมการปล่อยก๊าซเรือนกระจกหลายรายการ
export function calculateTotalEmission(
  emissions: number[]
): CalculationResult {
  const total = emissions.reduce((sum, value) => {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("พบค่าการปล่อยก๊าซเรือนกระจกที่ไม่ถูกต้อง");
    }

    return sum + value;
  }, 0);

  return {
    emission: total,
    unit: "kgCO2e",
  };
}
