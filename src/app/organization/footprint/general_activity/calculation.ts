/*
 * สูตรคำนวณของ "กิจกรรมทั่วไป" (TOR ข้อ 9.2): การประชุม/อบรม/อีเวนต์ และการเดินทาง
 *
 * ไฟล์นี้มี 5 ส่วน (ไล่จากบนลงล่าง)
 *   1) ค่าคงที่ ......... อัตราสิ้นเปลืองเชื้อเพลิง, อัตราไฟฟ้าของรถ EV, ราคาไฟฟ้า
 *   2) ชื่อที่แสดง ....... แปลงรหัส (car, diesel_b7 ...) เป็นชื่อภาษาไทยที่ผู้ใช้อ่านรู้เรื่อง
 *   3) ชนิดข้อมูล ........ ข้อมูลที่ส่งเข้า/ออกจากฟังก์ชันคำนวณ
 *   4) คำนวณปริมาณก๊าซ ... executeCarbonCalculation (ตัวคำนวณหลัก) + สรุปผลประชุม/เดินทาง
 *   5) คำแนะนำลดคาร์บอน .. getMeetingRecommendations / getTravelRecommendations
 *
 * หน่วย: ผลคำนวณจากฟังก์ชันในไฟล์นี้เป็น kgCO2e (totalCalculated) และ tCO2e (totalCalculatedTon)
 */

/* ===================== 1) ค่าคงที่ ===================== */

// ตัวเลือกหนึ่งตัวของคำแนะนำ เช่น { category_type: 'car', fuelType: 'gasohol_e20', name: '...' }
export type OptionType = {
  category_type: string;
  fuelType: string;
  name: string;
};

// อัตราสิ้นเปลืองเชื้อเพลิง (กม./ลิตร ยกเว้น CNG เป็น กม./กก.) แยกตามชนิดรถ แล้วแยกตามเชื้อเพลิง
// ที่มา: อบก. "ข้อกำหนดในการคำนวณและรายงานคาร์บอนฟุตพริ้นท์ขององค์กร" พิมพ์ครั้งที่ 8 (ฉบับปรับปรุงครั้งที่ 6) ก.ค. 2565
//        ภาคผนวก 10 ตาราง 10-1 (หน้า 78) — เบนซิน/จักรยานยนต์อ้างกรมควบคุมมลพิษ 2551, ดีเซล/CNG/LPG อ้าง American Petroleum Institute 2004
export const FUEL_CONSUMPTION_RATES: Record<string, Record<string, number>> = {
  car: {
    gasohol_e10: 14.763,  // รถยนต์เฉลี่ยทุกขนาด (เบนซิน)
    gasohol_e20: 14.763,
    gasohol_e85: 14.763,
    diesel_b7: 11.111,    // รถกระบะส่วนบุคคลขนาด 1 ตัน (ตารางไม่มีแถว "รถยนต์นั่งดีเซล" แถวนี้ใกล้เคียงที่สุด)
    diesel_b20: 11.111,
    cng: 11.905,          // รถ NGV (หน่วย กม./กก.)
    lpg: 8.929,           // รถ LPG
  },
  motorcycle: {
    gasohol_e10: 37.640,  // รถจักรยานยนต์ 4 จังหวะเฉลี่ยทุกขนาด
    gasohol_e20: 37.640,
    gasohol_e85: 37.640,
  },
  // รถตู้/รถโดยสารที่ใช้ CNG หรือ LPG: ตารางไม่มีแถวแยกตามชนิดรถ จึงใช้ค่ารถ NGV / รถ LPG ทั่วไป (ข้อจำกัด)
  van: {
    diesel_b7: 10.204,    // รถตู้โดยสาร (ดีเซล)
    diesel_b20: 10.204,
    cng: 11.905,
    lpg: 8.929,
  },
  bus: {
    diesel_b7: 2.850,     // รถโดยสารประจำทาง (ดีเซล) หน่วยเป็น "ต่อคัน" ไม่ใช่ต่อผู้โดยสาร
    diesel_b20: 2.850,
    cng: 11.905,
    lpg: 8.929,
  },
  // รถไฟฟ้า: ตารางของ อบก. ไม่มีค่ารถไฟฟ้า 6.06 กม./kWh (= 16.5 kWh/100 กม.) เป็นค่าเฉลี่ยโดยประมาณ ต้องอ้างแหล่งอื่นในรายงาน
  ev: {
    electricity: 6.06,
  },
};

// อัตราใช้ไฟฟ้าของ EV มาตรฐาน (kWh ต่อ กม.) = 1 / 6.06 กม./kWh ใช้ค่าเดียวกันทั้งตอนคำนวณจริงและตอนแนะนำให้เปลี่ยนเป็น EV
export const EV_KWH_PER_KM = 1 / FUEL_CONSUMPTION_RATES.ev.electricity;

// ราคาไฟฟ้าโดยประมาณ (บาทต่อ kWh) ใช้คำนวณ "ค่าไฟโดยประมาณ" และ "ประหยัดค่าไฟ" ในผลคำนวณ/PDF
export const ELECTRICITY_PRICE_BAHT_PER_KWH = 4;

// เชื้อเพลิงที่เลือกได้ของรถแต่ละชนิด (ใช้สร้างตัวเลือกในฟอร์มและตัวเลือกของคำแนะนำ)
export const VEHICLE_FUEL_MAPPINGS: Record<string, string[]> = {
  car: ["gasohol_e10", "gasohol_e20", "gasohol_e85", "diesel_b7", "diesel_b20", "cng", "lpg"],
  motorcycle: ["gasohol_e10", "gasohol_e20", "gasohol_e85"],
  van: ["diesel_b7", "diesel_b20", "cng", "lpg"],
  bus: ["diesel_b7", "diesel_b20", "cng", "lpg"],
  ev: ["electricity"],
};

// หา "กม./ลิตร" ของรถชนิดและเชื้อเพลิงที่ระบุ ถ้าไม่มีในตารางข้างบนจะใช้ค่ารถยนต์เบนซิน (14.763)
// ในหน้าจอไม่เกิดกรณีนี้ เพราะฟอร์มให้เลือกได้เฉพาะคู่ที่อยู่ใน VEHICLE_FUEL_MAPPINGS
export function getConsumptionRate(category_type?: string, fuelType?: string): number {
  if (!category_type) return 14.763;
  const v = category_type.toLowerCase();
  const f = (fuelType || 'gasohol_e10').toLowerCase();

  if (FUEL_CONSUMPTION_RATES[v] && FUEL_CONSUMPTION_RATES[v][f] !== undefined) {
    return FUEL_CONSUMPTION_RATES[v][f];
  }
  return 14.763;
}

/* ===================== 2) ชื่อที่แสดงให้ผู้ใช้เห็น (ภาษาไทย) ===================== */

// ชื่อรูปแบบการประชุม/ชนิดยานพาหนะ ใช้แสดงแทนรหัสภาษาอังกฤษ (car, bus, onsite ...) ในหน้าผลลัพธ์และ PDF
export const VEHICLE_LABELS: Record<string, string> = {
  online: 'ออนไลน์ (Online)',
  onsite: 'ออนไซต์ (Onsite)',
  car: 'รถยนต์',
  motorcycle: 'รถจักรยานยนต์',
  van: 'รถตู้โดยสาร',
  bus: 'รถโดยสารประจำทาง',
  ev: 'รถไฟฟ้า (EV)',
};
export const vehicleLabel = (key?: string): string => VEHICLE_LABELS[(key || '').toLowerCase()] ?? (key || '-');

// ชื่อเชื้อเพลิง
const FUEL_NAMES: Record<string, string> = {
  gasohol_e10: 'Gasohol E10', gasohol_e20: 'Gasohol E20', gasohol_e85: 'Gasohol E85',
  diesel_b7: 'Diesel B7', diesel_b20: 'Diesel B20', cng: 'CNG', lpg: 'LPG', electricity: 'ไฟฟ้า',
};

// คำอธิบายในวงเล็บหลังชื่อเชื้อเพลิง บอกผู้ใช้ว่าตัวเลือกนั้นใช้กับรถแบบไหน
// ใส่เฉพาะตัวเลือกที่ผู้ใช้อาจสับสน (E10, B7, CNG, LPG) ตัวอื่น (E20, E85, B20, ไฟฟ้า) ไม่ใส่
// ค่าอัตราสิ้นเปลืองที่ใช้คำนวณจริงอยู่ใน FUEL_CONSUMPTION_RATES ด้านบน ไม่เกี่ยวกับข้อความนี้
const FUEL_HINT: Record<string, Record<string, string>> = {
  car: {
    gasohol_e10: 'รถยนต์เบนซินทั่วไป ใช้แก๊สโซฮอล์ 91/95',
    diesel_b7: 'รถกระบะและรถยนต์ดีเซลทั่วไป',
    cng: 'รถยนต์ที่ติดตั้งถังก๊าซ NGV เช่น รถแท็กซี่',
    lpg: 'รถยนต์ที่ติดตั้งถังแก๊ส LPG เช่น รถแท็กซี่',
  },
  motorcycle: {
    gasohol_e10: 'รถจักรยานยนต์ทั่วไป ใช้แก๊สโซฮอล์ 91/95',
  },
  van: {
    diesel_b7: 'รถตู้โดยสารทั่วไป',
    cng: 'รถตู้โดยสารที่ติดตั้งถังก๊าซ NGV เช่น รถตู้สาธารณะ',
    lpg: 'รถตู้โดยสารที่ติดตั้งถังแก๊ส LPG เช่น รถตู้สาธารณะ',
  },
  bus: {
    diesel_b7: 'รถโดยสารประจำทางทั่วไป',
    cng: 'รถโดยสารประจำทางที่ใช้ก๊าซ NGV เช่น รถเมล์ NGV',
    lpg: 'รถโดยสารประจำทางที่ใช้ก๊าซ LPG',
  },
};

// ชื่อเชื้อเพลิงที่แสดงใน dropdown/ผลลัพธ์ เช่น fuelLabel('car','diesel_b7') = "Diesel B7 (รถกระบะและรถยนต์ดีเซลทั่วไป)"
// fuelLabel('car','gasohol_e20') = "Gasohol E20" (ไม่มีวงเล็บ)
export const fuelLabel = (vehicle: string, fuel: string): string => {
  const name = FUEL_NAMES[fuel] ?? fuel;
  const hint = FUEL_HINT[vehicle]?.[fuel];
  return hint ? `${name} (${hint})` : name;
};

// ตัวเลือกใน dropdown ของฟอร์มประชุมและฟอร์มเดินทาง (ใช้ร่วมกัน)
//   VEHICLE_OPTIONS = ชนิดรถ  /  FUEL_OPTIONS_MAP[ชนิดรถ] = เชื้อเพลิงที่เลือกได้ของรถชนิดนั้น
export const VEHICLE_OPTIONS: { id: string; label: string }[] = Object.keys(VEHICLE_FUEL_MAPPINGS).map((id) => ({
  id,
  label: vehicleLabel(id),
}));
export const FUEL_OPTIONS_MAP: Record<string, { id: string; label: string }[]> = Object.fromEntries(
  Object.entries(VEHICLE_FUEL_MAPPINGS).map(([vehicle, fuels]) => [
    vehicle,
    fuels.map((id) => ({ id, label: fuelLabel(vehicle, id) })),
  ])
);

// ฟอร์มให้องค์กรกรอกอัตราสิ้นเปลืองของ EV เป็น "kWh ต่อ 100 กม." (ตรงกับที่คู่มือรถเขียน)
// แต่ตัวคำนวณและฐานข้อมูล (electricity_kwh) เก็บเป็น "kWh ต่อ กม." จึงหาร/คูณ 100 ตรงนี้ที่เดียว
export const evKwhPerKmToPer100 = (kwhPerKm: number | string): string =>
  String(Math.round(Number(kwhPerKm) * 100 * 1000) / 1000);
export const evPer100ToKwhPerKm = (per100: string): string =>
  per100.trim() === '' ? '' : String(Number((Number(per100) / 100).toFixed(6)));

/* ===================== 3) ชนิดข้อมูล ===================== */

// อุปกรณ์ 1 ชุดในการประชุม (เช่น โน้ตบุ๊ก 10 เครื่อง ใช้ 3 ชั่วโมง)
// electricityKWh และ electricityKwh คือค่าเดียวกัน (kWh ต่อชั่วโมง ต่อ 1 เครื่อง) ที่สะกดต่างกัน
// เพราะข้อมูลมาจากฟอร์ม (Kwh) และจากฐานข้อมูล (KWh) ตัวคำนวณจึงรับได้ทั้งสองแบบ
export type EquipmentSet = {
  equipmentName: string;
  devices: number;
  durationHours: number;
  electricityKWh?: number;
  electricityKwh?: number;
};

// ข้อมูลที่ส่งเข้าตัวคำนวณ
export type CarbonCalcInput = {
  category?: 'meeting' | 'travel' | 'traveling';
  category_type?: string;       // ประชุม: 'online' | 'onsite'   เดินทาง: ชนิดรถ (car/motorcycle/van/bus/ev)
  vehicleType?: string;         // ชนิดยานพาหนะของ "การประชุมออนไซต์" ใช้เลือกอัตราสิ้นเปลือง
  fuelType?: string;
  distance?: number;            // ระยะทางเที่ยวเดียว (กม.)
  trip?: number;                // จำนวนเที่ยว
  devices?: number;             // ใช้เมื่อไม่ได้ส่ง equipmentSets (แบบอุปกรณ์ชุดเดียว)
  durationHours?: number;
  electricityKWh?: number;      // ประชุม: kWh/ชม. ของอุปกรณ์   เดินทางด้วย EV: kWh/กม.
  equipmentSets?: EquipmentSet[];
  emissionFactor: number;       // ค่า EF ของเชื้อเพลิง (หรือของไฟฟ้า ถ้าเป็นประชุมออนไลน์/EV)
  electricityEmissionFactor: number; // ค่า EF ของไฟฟ้า ใช้กับอุปกรณ์ในห้องประชุมออนไซต์
  efId?: string | null;
  isRecommendationSimulation?: boolean; // true = กำลังจำลอง "ถ้าเปลี่ยนเป็น EV" เพื่อใช้ในคำแนะนำ
};

// ผลจากตัวคำนวณ
export type CarbonCalcOutput = {
  totalCalculated: number;      // kgCO2e
  totalCalculatedTon: number;   // tCO2e
  calculationMethod: string;    // ข้อความอธิบายสูตรที่ใช้
  rawElectricityKWh?: number;   // ไฟฟ้าที่ใช้ทั้งหมด (kWh) ใช้คิดค่าไฟโดยประมาณ
  efId?: string | null;
  breakdown?: {                 // มีเฉพาะประชุมออนไซต์: แยกส่วนอุปกรณ์/การเดินทาง
    equipmentTotal?: number;
    travelEmission?: number;
  };
};

// ผลประเมินของตัวเลือกหนึ่งตัวในคำแนะนำ
export type EvaluatedOption = {
  option: OptionType;
  emissionTon: number;                // ปริมาณก๊าซถ้าเปลี่ยนไปใช้ตัวเลือกนี้ (tCO2e)
  reductionTon: number;               // ลดลงจากปัจจุบันเท่าไร (tCO2e)
  electricityReductionKWh?: number;
  electricityCostSaved?: number;
  isCurrent: boolean;
};

// ตัวเลือกที่แนะนำ จัดเป็นกลุ่มตามชนิดรถ (หรือ online/onsite สำหรับการประชุม)
export type GroupedVehicleRecommendation = {
  category_type: string;
  bestEmissionTon: number;
  fuels: EvaluatedOption[];
};

/* ===================== 4) คำนวณปริมาณก๊าซเรือนกระจก ===================== */

/*
 * ตัวคำนวณหลัก แยกเป็น 3 กรณี
 *   (ก) ประชุมออนไลน์ ........ Σ (จำนวนเครื่อง × ชั่วโมง × kWh/ชม.) × EF ไฟฟ้า
 *   (ข) เดินทางด้วย EV ........ ระยะทาง × จำนวนเที่ยว × kWh/กม. × EF ไฟฟ้า
 *       (ถ้าเป็นการจำลองเพื่อแนะนำ = ระยะทาง × เที่ยว ÷ 6.06 × EF)
 *   (ค) เดินทางด้วยรถเชื้อเพลิง .. ระยะทาง × จำนวนเที่ยว ÷ กม./ลิตร × EF เชื้อเพลิง
 * ประชุมออนไซต์ = ไฟฟ้าของอุปกรณ์ (Σ kWh × EF ไฟฟ้า) + การเดินทาง (ข หรือ ค)
 */
export function executeCarbonCalculation(input: CarbonCalcInput): CarbonCalcOutput {
  const {
    category,
    category_type = 'online',
    fuelType = 'gasohol_e10',
    distance = 0,
    trip = 1,
    devices = 1,
    durationHours = 1,
    electricityKWh = 0,
    equipmentSets = [],
    emissionFactor,
    electricityEmissionFactor,
    efId = null,
    isRecommendationSimulation = false
  } = input;

  // (ก) ประชุมออนไลน์
  if (category === 'meeting' && category_type === 'online') {
    let totalKWh = 0;
    if (equipmentSets && equipmentSets.length > 0) {
      equipmentSets.forEach(set => {
        const kwhVal = set.electricityKWh !== undefined ? set.electricityKWh : (set.electricityKwh || 0);
        totalKWh += set.devices * set.durationHours * kwhVal;
      });
    } else {
      totalKWh = devices * durationHours * electricityKWh;
    }

    const total = totalKWh * emissionFactor;
    return {
      totalCalculated: Number(total.toFixed(4)),
      totalCalculatedTon: Number((total / 1000).toFixed(4)),
      calculationMethod: 'Sum(EquipmentSets) * EF',
      rawElectricityKWh: totalKWh,
      efId: efId,
    };
  }

  // การเดินทาง (ใช้ทั้งกับ "เดินทาง" และส่วนเดินทางของ "ประชุมออนไซต์")
  let travelEmission = 0;
  let travelMethod = '';
  let rawElectricityKWh = 0;

  const isEvTravel = (fuelType && fuelType.toLowerCase().includes('electricity')) || category_type === 'ev';

  if (isEvTravel && isRecommendationSimulation) {
    // (ข-จำลอง) ใช้ในคำแนะนำ: "ถ้าเปลี่ยนไปใช้ EV" ด้วยอัตรามาตรฐาน 6.06 กม./kWh
    const totalDistance = distance * trip;
    const rate = FUEL_CONSUMPTION_RATES.ev.electricity;
    const fuelUsed = totalDistance / rate;
    travelEmission = fuelUsed * emissionFactor;
    travelMethod = '(Distance * Trips / 6.06) * EF(EV Recommendation as Combustion)';
  } else if (isEvTravel) {
    // (ข) EV จริง: ใช้ kWh/กม. ที่องค์กรกรอก (ไม่กรอกใช้ค่ามาตรฐาน)
    const kwhPerKm = electricityKWh > 0 ? electricityKWh : EV_KWH_PER_KM;
    const totalDistance = distance * trip;
    rawElectricityKWh = totalDistance * kwhPerKm;
    travelEmission = rawElectricityKWh * emissionFactor;
    travelMethod = '(Distance * Trips * kWhPerKm) * EF_Electricity';
  } else {
    // (ค) รถเชื้อเพลิง: ประชุมออนไซต์ใช้ชนิดยานพาหนะที่ผู้ใช้เลือก (vehicleType) ไม่ใช่ 'onsite'
    const targetCategoryType = category === 'meeting' ? (input.vehicleType || 'car') : category_type;
    const rate = getConsumptionRate(targetCategoryType, fuelType);
    const totalDistance = distance * trip;
    const fuelUsed = totalDistance / rate;
    travelEmission = fuelUsed * emissionFactor;
    travelMethod = '(Distance * Trips / ConsumptionRate) * EF';
  }

  // ประชุมออนไซต์: เพิ่มส่วนไฟฟ้าของอุปกรณ์เข้ากับส่วนเดินทาง
  if (category === 'meeting' && category_type === 'onsite') {
    let equipmentTotalEmission = 0;
    let equipmentTotalKWh = 0;

    if (equipmentSets && equipmentSets.length > 0) {
      equipmentSets.forEach(set => {
        const kwhVal = set.electricityKWh !== undefined ? set.electricityKWh : (set.electricityKwh || 0);
        const setKWh = set.devices * set.durationHours * kwhVal;
        equipmentTotalKWh += setKWh;
        equipmentTotalEmission += setKWh * electricityEmissionFactor;
      });
    }

    // kWh รวม = อุปกรณ์ + ไฟที่ EV ชาร์จจริง (ไม่นับการจำลองเพื่อแนะนำ)
    rawElectricityKWh = equipmentTotalKWh + ((isEvTravel && !isRecommendationSimulation) ? rawElectricityKWh : 0);
    const totalOnsite = equipmentTotalEmission + travelEmission;
    return {
      totalCalculated: Number(totalOnsite.toFixed(4)),
      totalCalculatedTon: Number((totalOnsite / 1000).toFixed(4)),
      calculationMethod: 'Sum(EquipmentSets * kWh * EF) + Travel',
      rawElectricityKWh: Number(rawElectricityKWh.toFixed(4)),
      efId: efId,
      breakdown: {
        equipmentTotal: Number(equipmentTotalEmission.toFixed(4)),
        travelEmission: Number(travelEmission.toFixed(4))
      }
    };
  }

  // การเดินทางล้วนๆ
  return {
    totalCalculated: Number(travelEmission.toFixed(4)),
    totalCalculatedTon: Number((travelEmission / 1000).toFixed(4)),
    calculationMethod: travelMethod,
    rawElectricityKWh: Number(rawElectricityKWh.toFixed(4)),
    efId: efId,
  };
}

// สรุปผลการประชุม = ผลคำนวณ + ค่าไฟโดยประมาณ (kWh รวม × ราคาไฟ)
// kWh รวมของประชุมออนไซต์ที่ใช้ EV นับรวมไฟที่ชาร์จรถด้วย
export function calculateMeetingSummary(input: CarbonCalcInput) {
  const res = executeCarbonCalculation(input);
  const rawKWh = res.rawElectricityKWh || 0;
  const electricityCost = rawKWh * ELECTRICITY_PRICE_BAHT_PER_KWH;

  return {
    totalCalculated: res.totalCalculated,
    totalCalculatedTon: res.totalCalculatedTon,
    rawElectricityKWh: rawKWh,
    electricityCost: electricityCost,
    efId: res.efId,
    breakdown: res.breakdown,
  };
}

// สรุปผลการเดินทาง = ผลคำนวณ + ค่าไฟโดยประมาณ (คิดเฉพาะเมื่อเดินทางด้วย EV เพราะรถเชื้อเพลิงไม่ใช้ไฟ)
export function calculateTravelSummary(input: CarbonCalcInput) {
  const res = executeCarbonCalculation(input);
  const rawKWh = res.rawElectricityKWh || 0;
  const isEv = input.category_type?.toLowerCase() === 'ev' || input.fuelType?.toLowerCase().includes('electricity');
  const electricityCost = isEv ? rawKWh * ELECTRICITY_PRICE_BAHT_PER_KWH : 0;

  return {
    totalCalculated: res.totalCalculated,
    totalCalculatedTon: res.totalCalculatedTon,
    rawElectricityKWh: rawKWh,
    electricityCost: electricityCost,
    efId: res.efId,
  };
}

/* ===================== 5) คำแนะนำลดคาร์บอน ===================== */

// ในแต่ละชนิดรถ เลือก "ตัวที่ปล่อยน้อยที่สุด" ของเชื้อเพลิงแต่ละประเภท (แก๊สโซฮอล์ / ดีเซล / CNG-LPG / ไฟฟ้า / อื่นๆ)
// แล้วเรียงจากปล่อยน้อยไปมาก เพื่อไม่ให้แสดงตัวเลือกซ้ำซ้อนหลายตัว (เช่น E10 E20 E85 พร้อมกัน)
function pickBestFuelOfEachKind(items: EvaluatedOption[]): EvaluatedOption[] {
  const byEmission = (a: EvaluatedOption, b: EvaluatedOption) => a.emissionTon - b.emissionTon;
  const fuel = (i: EvaluatedOption) => i.option.fuelType.toLowerCase();
  const isEv = (i: EvaluatedOption) => fuel(i).includes('electricity') || i.option.category_type.toLowerCase() === 'ev';

  const gasohols = items.filter(i => fuel(i).includes('gasohol')).sort(byEmission);
  const diesels = items.filter(i => fuel(i).includes('diesel')).sort(byEmission);
  const gasOptions = items.filter(i => ['cng', 'lpg'].includes(fuel(i))).sort(byEmission);
  const evOptions = items.filter(isEv).sort(byEmission);
  const others = items.filter(i =>
    !fuel(i).includes('gasohol') &&
    !fuel(i).includes('diesel') &&
    !['cng', 'lpg'].includes(fuel(i)) &&
    !fuel(i).includes('electricity')
  ).sort(byEmission);

  const selectedFuels: EvaluatedOption[] = [];
  if (gasohols.length > 0) selectedFuels.push(gasohols[0]);
  if (diesels.length > 0) selectedFuels.push(diesels[0]);
  if (gasOptions.length > 0) selectedFuels.push(gasOptions[0]);
  if (evOptions.length > 0) selectedFuels.push(evOptions[0]);
  if (others.length > 0) selectedFuels.push(others[0]);

  return selectedFuels.sort(byEmission);
}

/*
 * แนะนำวิธีลดคาร์บอนของ "การประชุม": ลองเปลี่ยนเป็นตัวเลือกอื่นทีละตัว (ประชุมออนไลน์ / ไปด้วยรถชนิดอื่น)
 * แล้วเก็บเฉพาะตัวที่ปล่อยน้อยกว่าปัจจุบัน
 *   - ประชุมออนไลน์อยู่แล้ว = ไม่มีคำแนะนำ
 *   - currentEmission เป็นหน่วยตัน (tCO2e)
 *   - ตัวเลือกที่ไม่มีค่า EF ในระบบจะถูกข้าม (ไม่เดาค่า)
 */
export function getMeetingRecommendations(params: {
  currentEmission: number;
  userInput: CarbonCalcInput;
  allAvailableOptions: OptionType[];
  fetchEFFromDB: (fuelKey: string) => number;
  fetchElectricityEFFromDB: () => number;
}): GroupedVehicleRecommendation[] {
  const { currentEmission, userInput, allAvailableOptions, fetchEFFromDB, fetchElectricityEFFromDB } = params;

  const catType = (userInput.category_type || '').toLowerCase();
  if (catType === 'online') {
    return [];
  }

  const electricityEf = fetchElectricityEFFromDB();

  // ผลของการประชุมแบบปัจจุบัน ใช้หา kWh ที่ใช้อยู่ตอนนี้
  const currentSimRes = executeCarbonCalculation({
    ...userInput,
    category: 'meeting',
    electricityEmissionFactor: electricityEf,
  });
  const currentRawKWh = currentSimRes.rawElectricityKWh || 0;

  const currentEmissionTon = currentEmission;
  const currentUserCatType = catType;
  const currentUserFuel = (userInput.fuelType || '').toLowerCase();

  const evaluatedList: EvaluatedOption[] = [];

  allAvailableOptions.forEach((option: OptionType) => {
    const isOnlineOpt = option.category_type === 'online';

    // ข้ามตัวเลือกที่ "เป็นแบบที่ผู้ใช้ใช้อยู่แล้ว"
    // ประชุมออนไซต์เทียบกับชนิดยานพาหนะที่เลือก (EV ไม่ต้องดูเชื้อเพลิงเพราะมีแต่ไฟฟ้า)
    const optType = option.category_type.toLowerCase();
    const isCurrent = isOnlineOpt
      ? currentUserCatType === 'online'
      : currentUserCatType === 'onsite' &&
        optType === (userInput.vehicleType || '').toLowerCase() &&
        (optType === 'ev' || option.fuelType.toLowerCase() === currentUserFuel);

    if (isCurrent) return;

    const ef = isOnlineOpt ? electricityEf : fetchEFFromDB(option.fuelType);
    if (!Number.isFinite(ef)) return; // ไม่มีค่า EF ของตัวเลือกนี้ในระบบ -> ไม่แนะนำ
    const isEvOption = option.category_type.toLowerCase() === 'ev' || option.fuelType.toLowerCase().includes('electricity');

    const simInput: CarbonCalcInput = {
      ...userInput,
      category: 'meeting',
      category_type: isOnlineOpt ? 'online' : 'onsite',
      vehicleType: isOnlineOpt ? undefined : option.category_type,
      fuelType: option.fuelType,
      emissionFactor: ef,
      electricityEmissionFactor: electricityEf,
      isRecommendationSimulation: isEvOption,
    };

    const simRes = executeCarbonCalculation(simInput);
    let simEmissionTon = simRes.totalCalculatedTon;

    // ประชุมออนไลน์ปัดเหลือ 0 ไม่ได้ (ยังใช้ไฟอุปกรณ์อยู่) แสดงขั้นต่ำ 0.0001 ตัน
    if (isOnlineOpt && simEmissionTon <= 0) {
      simEmissionTon = 0.0001;
    }

    const reductionTon = currentEmissionTon - simEmissionTon;
    const simRawKWh = simRes.rawElectricityKWh || 0;

    // ประชุมออนไลน์ช่วยลดไฟที่ใช้เดินทาง/ห้องประชุม จึงคิด "ประหยัดค่าไฟ" ให้เฉพาะตัวเลือกออนไลน์
    let electricityReductionKWh = 0;
    let electricityCostSaved = 0;

    if (isOnlineOpt) {
      electricityReductionKWh = Math.max(0, currentRawKWh - simRawKWh);
      electricityCostSaved = electricityReductionKWh * ELECTRICITY_PRICE_BAHT_PER_KWH;
    }

    if (simEmissionTon >= 0 && reductionTon > 0) {
      evaluatedList.push({
        option,
        emissionTon: simEmissionTon,
        reductionTon,
        electricityReductionKWh: Number(electricityReductionKWh.toFixed(4)),
        electricityCostSaved: Number(electricityCostSaved.toFixed(2)),
        isCurrent: false
      });
    }
  });

  if (evaluatedList.length === 0) return [];

  // แบ่งเป็น 2 กลุ่ม: ออนไลน์ / ออนไซต์
  const groupedMap: Record<string, EvaluatedOption[]> = {
    online: [],
    onsite: []
  };

  evaluatedList.forEach(item => {
    const mainGroup = item.option.category_type.toLowerCase() === 'online' ? 'online' : 'onsite';
    groupedMap[mainGroup].push(item);
  });

  const meetingGroups: GroupedVehicleRecommendation[] = [];

  if (groupedMap.online.length > 0) {
    const validOnlineFuels = groupedMap.online.filter(item => item.reductionTon > 0);
    if (validOnlineFuels.length > 0) {
      validOnlineFuels.sort((a, b) => a.emissionTon - b.emissionTon);
      meetingGroups.push({
        category_type: 'online',
        bestEmissionTon: validOnlineFuels[0].emissionTon,
        fuels: validOnlineFuels,
      });
    }
  }

  if (groupedMap.onsite.length > 0) {
    const selectedFuels = pickBestFuelOfEachKind(groupedMap.onsite);

    if (selectedFuels.some(item => item.reductionTon > 0)) {
      meetingGroups.push({
        category_type: 'onsite',
        bestEmissionTon: selectedFuels[0].emissionTon,
        fuels: selectedFuels,
      });
    }
  }

  meetingGroups.sort((a, b) => a.bestEmissionTon - b.bestEmissionTon);
  return meetingGroups;
}

/*
 * แนะนำวิธีลดคาร์บอนของ "การเดินทาง": ลองเปลี่ยนชนิดรถ/เชื้อเพลิงทีละตัว เก็บเฉพาะตัวที่ปล่อยน้อยกว่าปัจจุบัน
 * แล้วจัดกลุ่มตามชนิดรถ (รถยนต์ / จักรยานยนต์ / รถตู้ / รถโดยสาร / EV)
 *   - currentEmission เป็นหน่วยตัน (tCO2e)
 *   - ตัวเลือกที่ไม่มีค่า EF ในระบบจะถูกข้าม (ไม่เดาค่า)
 */
export function getTravelRecommendations(params: {
  currentEmission: number;
  userInput: CarbonCalcInput;
  allAvailableOptions: OptionType[];
  fetchEFFromDB: (fuelKey: string) => number;
}): GroupedVehicleRecommendation[] {
  const { currentEmission, userInput, allAvailableOptions, fetchEFFromDB } = params;

  // ผลของการเดินทางแบบปัจจุบัน ใช้หา kWh ที่ใช้อยู่ตอนนี้
  const currentSimRes = executeCarbonCalculation({
    ...userInput,
    category: 'travel',
    electricityEmissionFactor: userInput.electricityEmissionFactor || 0,
  });
  const currentRawKWh = currentSimRes.rawElectricityKWh || 0;

  const currentEmissionTon = currentEmission;
  const currentUserCatType = (userInput.category_type || '').toLowerCase();
  const currentUserFuel = (userInput.fuelType || '').toLowerCase();

  const evaluatedList: EvaluatedOption[] = [];

  allAvailableOptions.forEach((option: OptionType) => {
    // ข้ามตัวเลือกที่ตรงกับรถ+เชื้อเพลิงที่ผู้ใช้ใช้อยู่แล้ว
    const isCurrent =
      option.category_type.toLowerCase() === currentUserCatType &&
      option.fuelType.toLowerCase() === currentUserFuel;

    if (isCurrent) return;

    const ef = fetchEFFromDB(option.fuelType);
    if (!Number.isFinite(ef)) return; // ไม่มีค่า EF ของตัวเลือกนี้ในระบบ -> ไม่แนะนำ
    const isEvOption = option.category_type.toLowerCase() === 'ev' || option.fuelType.toLowerCase().includes('electricity');

    const simInput: CarbonCalcInput = {
      ...userInput,
      category: 'travel',
      category_type: option.category_type,
      fuelType: option.fuelType,
      emissionFactor: ef,
      electricityEmissionFactor: userInput.electricityEmissionFactor || 0,
      isRecommendationSimulation: isEvOption,
    };

    const simRes = executeCarbonCalculation(simInput);
    const simEmissionTon = simRes.totalCalculatedTon;
    const reductionTon = currentEmissionTon - simEmissionTon;

    // ถ้าตัวเลือกเป็น EV จะไม่นับว่า "ประหยัดค่าไฟ" (EV ใช้ไฟมากขึ้น ไม่ใช่น้อยลง)
    const simRawKWh = simRes.rawElectricityKWh || 0;
    const electricityReductionKWh = currentRawKWh - simRawKWh;
    const electricityCostSaved = isEvOption ? 0 : electricityReductionKWh * ELECTRICITY_PRICE_BAHT_PER_KWH;

    if (simEmissionTon >= 0 && reductionTon > 0) {
      evaluatedList.push({
        option,
        emissionTon: simEmissionTon,
        reductionTon,
        electricityReductionKWh: Number(electricityReductionKWh.toFixed(4)),
        electricityCostSaved: Number(electricityCostSaved.toFixed(2)),
        isCurrent: false
      });
    }
  });

  if (evaluatedList.length === 0) return [];

  // จัดกลุ่มตามชนิดรถ
  const groupedMap: Record<string, EvaluatedOption[]> = {};
  evaluatedList.forEach(item => {
    const catType = item.option.category_type.toLowerCase();
    if (!groupedMap[catType]) groupedMap[catType] = [];
    groupedMap[catType].push(item);
  });

  const vehicleGroups: GroupedVehicleRecommendation[] = Object.keys(groupedMap).map(category_type => {
    const selectedFuels = pickBestFuelOfEachKind(groupedMap[category_type]);

    return {
      category_type,
      bestEmissionTon: selectedFuels[0].emissionTon,
      fuels: selectedFuels,
    };
  }).filter(group => group.fuels.some(f => f.reductionTon > 0));

  vehicleGroups.sort((a, b) => a.bestEmissionTon - b.bestEmissionTon);
  return vehicleGroups;
}
