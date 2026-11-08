// calculation.ts

export type OptionType = {
  subCategory: string;
  fuelType: string;
  name: string;
};

export const FUEL_CONSUMPTION_RATES: Record<string, Record<string, number>> = {
  car: {
    gasohol_e10: 14.763,
    gasohol_e20: 14.763,
    gasohol_e85: 14.763,
    diesel_b7: 14.763,
    diesel_b20: 14.763,
    cng: 11.905,
    lpg: 8.929,
  },
  motorcycle: {
    gasohol_e10: 37.640,
    gasohol_e20: 37.640,
    gasohol_e85: 37.640,
  },
  van: {
    diesel_b7: 10.204,
    diesel_b20: 10.204,
    cng: 11.905,
    lpg: 8.929,
  },
  bus: {
    diesel_b7: 2.850,
    diesel_b20: 2.850,
    cng: 11.905,
    lpg: 8.929,
  },
};

export const VEHICLE_FUEL_MAPPINGS: Record<string, string[]> = {
  car: ["gasohol_e10", "gasohol_e20", "gasohol_e85", "diesel_b7", "diesel_b20", "cng", "lpg"],
  motorcycle: ["gasohol_e10", "gasohol_e20", "gasohol_e85"],
  van: ["diesel_b7", "diesel_b20", "cng", "lpg"],
  bus: ["diesel_b7", "diesel_b20", "cng", "lpg"],
  ev: ["electricity"],
};

export type EquipmentSet = {
  equipmentName: string;
  devices: number;
  durationHours: number;
  electricityKWh?: number;
  electricityKwh?: number;
};

export type CarbonCalcInput = {
  category?: 'meeting' | 'travel';
  subCategory?: string; 
  fuelType?: string;
  distance?: number;
  trip?: number;
  devices?: number;
  durationHours?: number;
  electricityKWh?: number;
  equipmentSets?: EquipmentSet[];
  emissionFactor: number;
  electricityEmissionFactor: number; 
};

export type CarbonCalcOutput = {
  totalCalculated: number;
  calculationMethod: string;
  breakdown?: {
    equipmentTotal?: number;
    travelEmission?: number;
  };
};

export function getConsumptionRate(subCategory?: string, fuelType?: string): number {
  if (!subCategory) return 14.763;
  const v = subCategory.toLowerCase();
  const f = (fuelType || 'gasohol_e10').toLowerCase();

  if (FUEL_CONSUMPTION_RATES[v] && FUEL_CONSUMPTION_RATES[v][f]) {
    return FUEL_CONSUMPTION_RATES[v][f];
  }
  return 14.763;
}

export function executeCarbonCalculation(input: CarbonCalcInput): CarbonCalcOutput {
  const { 
    category, 
    subCategory = 'online', 
    fuelType = 'gasohol_e10', 
    distance = 0, 
    trip = 1, 
    devices = 1, 
    durationHours = 1, 
    electricityKWh = 0, 
    equipmentSets = [],
    emissionFactor,
    electricityEmissionFactor 
  } = input;

  if (category === 'meeting' && subCategory === 'online') {
    const totalKWh = devices * durationHours * electricityKWh;
    const total = totalKWh * emissionFactor;
    return {
      totalCalculated: Number(total.toFixed(4)),
      calculationMethod: 'Devices * Duration * kWh * EF',
    };
  }

  let travelEmission = 0;
  let travelMethod = '';

  const isEvTravel = (fuelType && fuelType.toLowerCase().includes('electricity')) || subCategory === 'ev';
  if (isEvTravel) {
    const totalKWh = distance * trip * electricityKWh;
    travelEmission = totalKWh * emissionFactor;
    travelMethod = 'Distance * Trips * kWh * EF_Electricity';
  } else {
    const targetSubCategory = category === 'meeting' ? 'car' : subCategory;
    const rate = getConsumptionRate(targetSubCategory, fuelType);
    const totalDistance = distance * trip;
    const fuelUsed = totalDistance / rate;
    travelEmission = fuelUsed * emissionFactor;
    travelMethod = '(Distance * Trips / ConsumptionRate) * EF';
  }

  if (category === 'meeting' && subCategory === 'onsite') {
    let equipmentTotalEmission = 0;
    
    if (equipmentSets && equipmentSets.length > 0) {
      equipmentSets.forEach(set => {
        const kwhVal = set.electricityKWh !== undefined ? set.electricityKWh : (set.electricityKwh || 0);
        const setKWh = set.devices * set.durationHours * kwhVal;
        equipmentTotalEmission += setKWh * electricityEmissionFactor;
      });
    }
    
    const totalOnsite = equipmentTotalEmission + travelEmission;
    return {
      totalCalculated: Number(totalOnsite.toFixed(4)),
      calculationMethod: 'Sum(EquipmentSets * kWh * EF) + Travel',
      breakdown: {
        equipmentTotal: Number(equipmentTotalEmission.toFixed(4)),
        travelEmission: Number(travelEmission.toFixed(4))
      }
    };
  }

  return {
    totalCalculated: Number(travelEmission.toFixed(4)),
    calculationMethod: travelMethod,
  };
}

export function getMeetingRecommendations(params: {
  currentEmission: number; 
  userInput: CarbonCalcInput;
  allAvailableOptions: OptionType[];
  fetchEFFromDB: (fuelKey: string) => number;
  fetchElectricityEFFromDB: () => number;
}) {
  const { currentEmission, userInput, allAvailableOptions, fetchEFFromDB, fetchElectricityEFFromDB } = params;
  const currentEmissionTon = currentEmission > 10 ? currentEmission / 1000 : currentEmission;

  const calculatedList: { option: OptionType; emissionTon: number; reductionTon: number }[] = [];
  const electricityEf = fetchElectricityEFFromDB();
  const currentUserSubCategory = (userInput.subCategory || 'online').toLowerCase();

  allAvailableOptions.forEach((option: OptionType) => {
    const isOnlineOpt = option.subCategory === 'online';
    
    // ถ้าปัจจุบันเลือก online อยู่แล้ว ไม่ต้องแนะนำ online ซ้ำ
    if (isOnlineOpt && currentUserSubCategory === 'online') {
      return;
    }

    const ef = isOnlineOpt ? electricityEf : fetchEFFromDB(option.fuelType);

    const simInput: CarbonCalcInput = {
      ...userInput,
      category: 'meeting',
      subCategory: isOnlineOpt ? 'online' : 'onsite',
      fuelType: option.fuelType,
      emissionFactor: ef,
      electricityEmissionFactor: electricityEf,
    };

    const simRes = executeCarbonCalculation(simInput);
    let simEmissionTon = simRes.totalCalculated / 1000; 

    if (isOnlineOpt && simEmissionTon <= 0.0000) {
      simEmissionTon = 0.0001; 
    }

    const reductionTon = currentEmissionTon - simEmissionTon;

    if (reductionTon > 0.0001 && simEmissionTon >= 0 && reductionTon < currentEmissionTon) {
      calculatedList.push({ option, emissionTon: simEmissionTon, reductionTon });
    }
  });

  if (calculatedList.length === 0) {
    return { best: null, runnerUp: null };
  }

  // จัดเรียงลำดับ โดยบังคับให้ Online มาเป็นอันดับ 1 เสมอถ้าอยู่ในรายการ
  calculatedList.sort((a, b) => {
    if (a.option.subCategory === 'online') return -1;
    if (b.option.subCategory === 'online') return 1;
    return a.emissionTon - b.emissionTon;
  });

  const bestItem = calculatedList[0];
  const remainingList = calculatedList.filter(
    item => item.option.name !== bestItem.option.name &&
    (currentEmissionTon - item.emissionTon) > 0.0001
  );
  const runnerUpItem = remainingList.length > 0 ? remainingList[0] : null;

  return {
    best: { 
      name: bestItem.option.name, 
      reductionTon: Number(bestItem.reductionTon.toFixed(4)),
      newEmissionTon: Number(bestItem.emissionTon.toFixed(4)) 
    },
    runnerUp: runnerUpItem ? { 
      name: runnerUpItem.option.name, 
      reductionTon: Number(runnerUpItem.reductionTon.toFixed(4)),
      newEmissionTon: Number(runnerUpItem.emissionTon.toFixed(4)) 
    } : null,
  };
}

export function getTravelRecommendations(params: {
  currentEmission: number; 
  userInput: CarbonCalcInput;
  allAvailableOptions: OptionType[];
  fetchEFFromDB: (fuelKey: string) => number;
}) {
  const { currentEmission, userInput, allAvailableOptions, fetchEFFromDB } = params;
  const currentEmissionTon = currentEmission > 10 ? currentEmission / 1000 : currentEmission;

  const calculatedList: { option: OptionType; emissionTon: number; reductionTon: number }[] = [];
  const currentUserSubCategory = (userInput.subCategory || '').toLowerCase();
  const currentUserFuel = (userInput.fuelType || '').toLowerCase();

  allAvailableOptions.forEach((option: OptionType) => {
    if (
      option.subCategory.toLowerCase() === currentUserSubCategory && 
      option.fuelType.toLowerCase() === currentUserFuel
    ) {
      return;
    }

    const ef = fetchEFFromDB(option.fuelType);
    const simInput: CarbonCalcInput = {
      ...userInput,
      category: 'travel',
      subCategory: option.subCategory, 
      fuelType: option.fuelType,
      emissionFactor: ef,
      electricityEmissionFactor: userInput.electricityEmissionFactor || 0,
    };

    const simRes = executeCarbonCalculation(simInput);
    const simEmissionTon = simRes.totalCalculated / 1000;
    const reductionTon = currentEmissionTon - simEmissionTon;

    if (reductionTon > 0.0001 && simEmissionTon >= 0 && reductionTon < currentEmissionTon) {
      calculatedList.push({ option, emissionTon: simEmissionTon, reductionTon });
    }
  });

  if (calculatedList.length === 0) {
    return { best: null, runnerUp: null };
  }

  calculatedList.sort((a, b) => a.emissionTon - b.emissionTon);

  const bestItem = calculatedList[0];
  const remainingList = calculatedList.filter(
    item => item.option.subCategory.toLowerCase() !== bestItem.option.subCategory.toLowerCase() &&
    (currentEmissionTon - item.emissionTon) > 0.0001
  );
  const runnerUpItem = remainingList.length > 0 ? remainingList[0] : null;

  return {
    best: { 
      name: bestItem.option.name, 
      reductionTon: Number(bestItem.reductionTon.toFixed(4)),
      newEmissionTon: Number(bestItem.emissionTon.toFixed(4)) 
    },
    runnerUp: runnerUpItem ? { 
      name: runnerUpItem.option.name, 
      reductionTon: Number(runnerUpItem.reductionTon.toFixed(4)),
      newEmissionTon: Number(runnerUpItem.emissionTon.toFixed(4)) 
    } : null,
  };
}