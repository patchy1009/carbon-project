'use client'
// 1. Types & Enums ตรงตามฐานข้อมูลจริง
export type CategoryName = 'MEETING' | 'TRAVELING' | 'RESOURCE';

export type SubCategory = 
  | 'ONSITE' 
  | 'ONLINE' 
  | 'CAR' 
  | 'VAN' 
  | 'BUS' 
  | 'ELECTRICITY' 
  | 'PAPER' 
  | 'FUEL' 
  | 'WATER';

export type ActivityUnit = 'Kg' | 'km' | 'liter' | 'persons' | 'hours' | 'trips';

export type CalculationResult = {
  totalCalculated: number; // ตรงกับฟิลด์ total_calculated ในตาราง general_category_activity_detail (DECIMAL 12,4)[cite: 2]
  unit: "kgCO2e";
};

// 2. ฟังก์ชันตรวจสอบความถูกต้องของข้อมูลขาเข้า (Data Validation)
function validateInput(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`ค่า ${fieldName} ไม่ถูกต้อง ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป`);
  }
}

// ==========================================
// 3. ฟังก์ชันคำนวณแยกตามหมวดหมู่ย่อย (Sub-Category Logic)
// ==========================================

/**
 * คำนวณคาร์บอนจากการประชุม (MEETING: ONSITE / ONLINE)
 */
export function calculateMeetingEmission(
  hours: number,
  persons: number,
  emissionFactor: number,
  subCategory: 'ONSITE' | 'ONLINE'
): CalculationResult {
  validateInput(hours, 'จำนวนชั่วโมง (hours)');
  validateInput(persons, 'จำนวนคน (persons)');
  validateInput(emissionFactor, 'Emission Factor');

  // เงื่อนไขเฉพาะกิจกรม: หากเป็นการประชุมออนไลน์ (ONLINE) การปล่อยก๊าซจะอิงตามพลังงาน Data Center/อุปกรณ์ 
  // (หรือปรับลดสัดส่วนตามเกณฑ์มาตรฐานที่แอดมินกำหนดในระบบ)
  let factorMultiplier = 1;
  if (subCategory === 'ONLINE') {
    factorMultiplier = 0.1; // ตัวอย่างสัดส่วนพลังงานออนไลน์เทียบกับออนไซต์ หรือปรับตามจริงของ EF
  }

  const total = hours * persons * emissionFactor * factorMultiplier;

  return {
    totalCalculated: Number(total.toFixed(4)),
    unit: "kgCO2e",
  };
}

/**
 * คำนวณคาร์บอนจากการเดินทาง (TRAVELING: CAR, VAN, BUS)
 * สูตร: ระยะทาง (km) × จำนวนเที่ยว (trips) × จำนวนผู้เดินทาง (persons) × EF
 */
export function calculateTravelEmission(
  distanceKm: number,
  trips: number,
  people: number,
  emissionFactor: number
): CalculationResult {
  validateInput(distanceKm, 'ระยะทาง (km)');
  validateInput(trips, 'จำนวนเที่ยว (trips)');
  validateInput(people, 'จำนวนผู้เดินทาง (persons)');
  validateInput(emissionFactor, 'Emission Factor');

  const totalDistance = distanceKm * trips * people;
  const total = totalDistance * emissionFactor;

  return {
    totalCalculated: Number(total.toFixed(4)),
    unit: "kgCO2e",
  };
}

/**
 * คำนวณคาร์บอนจากทรัพยากรและพลังงาน (RESOURCE: ELECTRICITY, PAPER, FUEL, WATER)
 * สูตร: ปริมาณทรัพยากร (ตามหน่วย เช่น kWh, kg, liter) × EF
 */
export function calculateResourceEmission(
  amount: number,
  emissionFactor: number,
  subCategory: 'ELECTRICITY' | 'PAPER' | 'FUEL' | 'WATER'
): CalculationResult {
  validateInput(amount, `ปริมาณสำหรับ ${subCategory}`);
  validateInput(emissionFactor, 'Emission Factor');

  // สามารถเพิ่มเงื่อนไขเฉพาะของแต่ละ Resource ได้ที่นี่ถ้ามีกฎการคำนวณแยกย่อย
  const total = amount * emissionFactor;

  return {
    totalCalculated: Number(total.toFixed(4)),
    unit: "kgCO2e",
  };
}

// ==========================================
// 4. Dispatcher Function (ฟังก์ชันกลางเลือกสูตรคำนวณตามข้อมูลจริงใน DB)
// ==========================================

export type CalculationPayload = {
  subCategory: SubCategory;
  emissionFactor: number;
  amount?: number;       // ใช้สำหรับ Resource (ไฟฟ้า, กระดาษ, น้ำ, เชื้อเพลิง)
  distanceKm?: number;   // ใช้สำหรับ Travel
  trips?: number;        // ใช้สำหรับ Travel
  people?: number;       // ใช้สำหรับ Travel หรือ Meeting
  hours?: number;        // ใช้สำหรับ Meeting
};

export function executeCarbonCalculation(payload: CalculationPayload): CalculationResult {
  switch (payload.subCategory) {
    case 'ONSITE':
    case 'ONLINE':
      return calculateMeetingEmission(
        payload.hours ?? 0,
        payload.people ?? 1,
        payload.emissionFactor,
        payload.subCategory
      );

    case 'CAR':
    case 'VAN':
    case 'BUS':
      return calculateTravelEmission(
        payload.distanceKm ?? 0,
        payload.trips ?? 1,
        payload.people ?? 1,
        payload.emissionFactor
      );

    case 'ELECTRICITY':
    case 'PAPER':
    case 'FUEL':
    case 'WATER':
      return calculateResourceEmission(
        payload.amount ?? 0,
        payload.emissionFactor,
        payload.subCategory
      );

    default:
      throw new Error(`ไม่พบหมวดหมู่ย่อย (Sub-category): ${payload.subCategory} ในระบบคำนวณ`);
  }
}

// ==========================================
// ฟังก์ชันเดิมที่หน้าเว็บ (page.tsx) ยังคงเรียกใช้งานอยู่
// ==========================================

export function calculateEmission(
  amount: number,
  emissionFactor: number
): CalculationResult {
  validateInput(amount, "จำนวนข้อมูล");
  validateInput(emissionFactor, "Emission Factor");

  const total = amount * emissionFactor;

  return {
    totalCalculated: Number(total.toFixed(4)),
    unit: "kgCO2e",
  };
}

export function calculateElectricityEmission(
  electricityKwh: number,
  emissionFactor: number
): CalculationResult {
  return calculateEmission(electricityKwh, emissionFactor);
}