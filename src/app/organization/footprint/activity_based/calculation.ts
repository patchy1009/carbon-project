'use client'

export type CategoryName = 'MEETING' | 'TRAVELING' | 'RESOURCE';

export type CalculationResult = {
  totalCalculated: number;
  unit: "kgCO2e";
};

export type RecommendationResult = {
  currentSubCategory: string;
  currentEmission: number;
  bestSubCategory: string;
  bestEmission: number;
  isBest: boolean;
  reductionKg: number;
  percentSaved: number;
  recommendedAction: string;
};

function validateInput(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`ค่า ${fieldName} ไม่ถูกต้อง ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป`);
  }
}

/**
 * ฟังก์ชันคำนวณคาร์บอนทั่วไป
 */
export function calculateEmission(amount: number, emissionFactor: number): CalculationResult {
  validateInput(amount, "จำนวนข้อมูล");
  validateInput(emissionFactor, "Emission Factor");

  const total = amount * emissionFactor;

  return {
    totalCalculated: Number(total.toFixed(4)),
    unit: "kgCO2e",
  };
}

/**
 * Dispatcher สำหรับคำนวณตามค่า EF จริงที่เลือกจากระบบแอดมิน
 */
export type CalculationPayload = {
  emissionFactor: number;
  amount: number; // ปริมาณหรือระยะทางหรือชั่วโมงรวม
};

export function executeCarbonCalculation(payload: CalculationPayload): CalculationResult {
  return calculateEmission(payload.amount, payload.emissionFactor);
}

/**
 * ฟังก์ชันเปรียบเทียบแบบไดนามิก: เทียบตัวเลือกที่ User เลือก กับทุกตัวเลือกที่มีในหมวดหมู่เดียวกันจากแอดมิน
 */
export type GenericComparisonPayload = {
  currentName: string;
  currentEmission: number;
  allOptions: Array<{
    name: string;
    ef_value: number;
  }>;
  calculateFn: (efValue: number) => number;
};

export function compareGenericChoices(payload: GenericComparisonPayload): RecommendationResult {
  const { currentName, currentEmission, allOptions, calculateFn } = payload;

  const evaluatedChoices = allOptions.map(opt => ({
    name: opt.name,
    emission: calculateFn(opt.ef_value),
  }));

  if (evaluatedChoices.length === 0) {
    return {
      currentSubCategory: currentName,
      currentEmission,
      bestSubCategory: currentName,
      bestEmission: currentEmission,
      isBest: true,
      reductionKg: 0,
      percentSaved: 0,
      recommendedAction: `คุณเลือก "${currentName}" ซึ่งเป็นการปล่อยคาร์บอนปัจจุบัน`,
    };
  }

  // หาตัวเลือกที่ปล่อยคาร์บอนน้อยที่สุดในหมวดหมู่
  const bestChoice = evaluatedChoices.reduce((min, curr) => (curr.emission < min.emission ? curr : min));
  const currentChoice = evaluatedChoices.find(c => c.name === currentName) || { name: currentName, emission: currentEmission };

  const isBest = currentChoice.name === bestChoice.name;
  const reductionKg = Number(Math.max(0, currentEmission - bestChoice.emission).toFixed(4));
  const percentSaved = currentEmission > 0 ? Number(((reductionKg / currentEmission) * 100).toFixed(1)) : 0;

  return {
    currentSubCategory: currentName,
    currentEmission,
    bestSubCategory: bestChoice.name,
    bestEmission: bestChoice.emission,
    isBest,
    reductionKg,
    percentSaved,
    recommendedAction: isBest
      ? `คุณเลือก "${currentChoice.name}" ซึ่งปล่อยคาร์บอนต่ำที่สุดในหมวดนี้แล้ว`
      : `แนะนำเปลี่ยนเป็น "${bestChoice.name}" สามารถลดคาร์บอนได้ ${reductionKg} kgCO2e (${percentSaved}%)`,
  };
}