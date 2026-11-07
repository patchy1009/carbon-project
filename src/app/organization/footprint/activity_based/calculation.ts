export type CalculationResult = {
  emissionFactor: number;
  amount: number;
  totalCalculated: number;
};

export function executeCarbonCalculation({
  emissionFactor,
  amount,
}: {
  emissionFactor: number;
  amount: number;
}): CalculationResult {
  const safeEF = Number.isFinite(emissionFactor) ? emissionFactor : 0;
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const totalCalculated = safeEF * safeAmount;

  return {
    emissionFactor: safeEF,
    amount: safeAmount,
    totalCalculated: Math.max(0, totalCalculated),
  };
}

export type RecommendationResult = {
  bestChoiceName: string;
  bestEmission: number;
  reductionKg: number;
  recommendedAction: string;
};

export function compareGenericChoices({
  currentName,
  currentEmission,
  allOptions,
  calculateFn,
}: {
  currentName: string;
  currentEmission: number;
  allOptions: { name: string; ef_value: number }[];
  calculateFn: (ef: number) => number;
}): RecommendationResult {
  if (!allOptions || allOptions.length === 0) {
    return {
      bestChoiceName: currentName,
      bestEmission: currentEmission,
      reductionKg: 0,
      recommendedAction: "รักษาระดับการดำเนินงานปัจจุบันเพื่อคงประสิทธิภาพการใช้พลังงาน",
    };
  }

  let best = allOptions[0];
  let minEmission = calculateFn(best.ef_value);

  allOptions.forEach((opt) => {
    const em = calculateFn(opt.ef_value);
    if (em < minEmission) {
      minEmission = em;
      best = opt;
    }
  });

  const reduction = Math.max(0, currentEmission - minEmission);

  return {
    bestChoiceName: best.name,
    bestEmission: minEmission,
    reductionKg: reduction,
    recommendedAction: `แนะนำให้เปลี่ยนมาใช้รูปแบบ "${best.name}" เพื่อช่วยลดการปล่อยก๊าซเรือนกระจก`,
  };
}