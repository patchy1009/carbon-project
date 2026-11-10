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
    diesel_b7: 6.369,
    diesel_b20: 6.369,
    cng: 11.905,
    lpg: 8.929,
  },
  motorcycle: {
    gasohol_e10: 37.640,
    gasohol_e20: 37.640,
    gasohol_e85: 37.640,
  },
  van: {
    diesel_b7: 6.369,
    diesel_b20: 6.369,
    cng: 11.905,
    lpg: 8.929,
  },
  bus: {
    diesel_b7: 6.369,
    diesel_b20: 6.369,
    cng: 11.905,
    lpg: 8.929,
  },
  ev: {
    electricity: 6.06,
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
  efId?: string | null;
  isRecommendationSimulation?: boolean;
};

export type CarbonCalcOutput = {
  totalCalculated: number;
  totalCalculatedTon: number;
  calculationMethod: string;
  rawElectricityKWh?: number; 
  efId?: string | null;
  breakdown?: {
    equipmentTotal?: number;
    travelEmission?: number;
  };
};

export type GroupedVehicleRecommendation = {
  subCategory: string;
  bestEmissionTon: number;
  fuels: {
    option: OptionType;
    emissionTon: number;
    reductionTon: number;
    electricityReductionKWh?: number; 
    electricityCostSaved?: number;    
    isCurrent: boolean;
  }[];
};

export function getConsumptionRate(subCategory?: string, fuelType?: string): number {
  if (!subCategory) return 14.763;
  const v = subCategory.toLowerCase();
  const f = (fuelType || 'gasohol_e10').toLowerCase();

  if (FUEL_CONSUMPTION_RATES[v] && FUEL_CONSUMPTION_RATES[v][f] !== undefined) {
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
    electricityEmissionFactor,
    efId = null,
    isRecommendationSimulation = false 
  } = input;

  if (category === 'meeting' && subCategory === 'online') {
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

  let travelEmission = 0;
  let travelMethod = '';
  let rawElectricityKWh = 0;

  const isEvTravel = (fuelType && fuelType.toLowerCase().includes('electricity')) || subCategory === 'ev';
  
  if (isEvTravel && isRecommendationSimulation) {
    const totalDistance = distance * trip;
    const rate = 6.06;
    const fuelUsed = totalDistance / rate;
    travelEmission = fuelUsed * emissionFactor;
    travelMethod = '(Distance * Trips / 6.06) * EF(EV Recommendation as Combustion)';
  } else if (isEvTravel) {
    const kwhPerKm = electricityKWh > 0 ? electricityKWh : 0.16;
    const totalDistance = distance * trip;
    rawElectricityKWh = totalDistance * kwhPerKm;
    travelEmission = rawElectricityKWh * emissionFactor;
    travelMethod = '(Distance * Trips * kWhPerKm) * EF_Electricity';
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
    let equipmentTotalKWh = 0;
    
    if (equipmentSets && equipmentSets.length > 0) {
      equipmentSets.forEach(set => {
        const kwhVal = set.electricityKWh !== undefined ? set.electricityKWh : (set.electricityKwh || 0);
        const setKWh = set.devices * set.durationHours * kwhVal;
        equipmentTotalKWh += setKWh;
        equipmentTotalEmission += setKWh * electricityEmissionFactor;
      });
    }
    
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

  return {
    totalCalculated: Number(travelEmission.toFixed(4)),
    totalCalculatedTon: Number((travelEmission / 1000).toFixed(4)),
    calculationMethod: travelMethod,
    rawElectricityKWh: Number(rawElectricityKWh.toFixed(4)),
    efId: efId,
  };
}

export function calculateMeetingSummary(input: CarbonCalcInput) {
  const res = executeCarbonCalculation(input);
  const rawKWh = res.rawElectricityKWh || 0;
  const isEv = input.subCategory === 'onsite' && input.fuelType?.toLowerCase() === 'ev';
  const electricityCost = isEv ? 0 : rawKWh * 4;

  return {
    totalCalculated: res.totalCalculated,
    totalCalculatedTon: res.totalCalculatedTon,
    rawElectricityKWh: rawKWh,
    electricityCost: electricityCost,
    efId: res.efId,
    breakdown: res.breakdown,
  };
}

export function calculateTravelSummary(input: CarbonCalcInput) {
  const res = executeCarbonCalculation(input);
  const rawKWh = res.rawElectricityKWh || 0;
  const isEv = input.subCategory?.toLowerCase() === 'ev' || input.fuelType?.toLowerCase().includes('electricity');
  const electricityCost = isEv ? rawKWh * 4 : 0;

  return {
    totalCalculated: res.totalCalculated,
    totalCalculatedTon: res.totalCalculatedTon,
    rawElectricityKWh: rawKWh,
    electricityCost: electricityCost,
    efId: res.efId,
  };
}

export function getMeetingRecommendations(params: {
  currentEmission: number; 
  userInput: CarbonCalcInput;
  allAvailableOptions: OptionType[];
  fetchEFFromDB: (fuelKey: string) => number;
  fetchElectricityEFFromDB: () => number;
}): GroupedVehicleRecommendation[] {
  const { currentEmission, userInput, allAvailableOptions, fetchEFFromDB, fetchElectricityEFFromDB } = params;
  
  const subCat = (userInput.subCategory || '').toLowerCase();
  if (subCat === 'online' || subCat === 'ไฟฟ้าแบบ grid mix ปี 2022–2024') {
    return [];
  }

  const currentSimRes = executeCarbonCalculation({
    ...userInput,
    category: 'meeting',
    emissionFactor: userInput.emissionFactor,
    electricityEmissionFactor: fetchElectricityEFFromDB(),
  });
  const currentRawKWh = currentSimRes.rawElectricityKWh || 0;

  const currentEmissionTon = currentEmission > 10 ? currentEmission / 1000 : currentEmission;
  const electricityEf = fetchElectricityEFFromDB();
  const currentUserSubCategory = subCat;
  const currentUserFuel = (userInput.fuelType || '').toLowerCase();

  const evaluatedList: { 
    option: OptionType; 
    emissionTon: number; 
    reductionTon: number; 
    electricityReductionKWh?: number; 
    electricityCostSaved?: number; 
    isCurrent: boolean 
  }[] = [];

  allAvailableOptions.forEach((option: OptionType) => {
    const isOnlineOpt = option.subCategory === 'online';
    const isCurrent = 
      option.subCategory.toLowerCase() === currentUserSubCategory && 
      (isOnlineOpt || option.fuelType.toLowerCase() === currentUserFuel);

    if (isCurrent) return;

    const ef = isOnlineOpt ? electricityEf : fetchEFFromDB(option.fuelType);
    const isEvOption = option.subCategory.toLowerCase() === 'ev' || option.fuelType.toLowerCase().includes('electricity');

    const simInput: CarbonCalcInput = {
      ...userInput,
      category: 'meeting',
      subCategory: isOnlineOpt ? 'online' : 'onsite',
      fuelType: option.fuelType,
      distance: userInput.distance,
      trip: userInput.trip,
      emissionFactor: ef,
      electricityEmissionFactor: electricityEf,
      isRecommendationSimulation: isEvOption,
    };

    const simRes = executeCarbonCalculation(simInput);
    let simEmissionTon = simRes.totalCalculatedTon; 

    if (isOnlineOpt && simEmissionTon <= 0.0000) {
      simEmissionTon = 0.0001; 
    }

    const reductionTon = currentEmissionTon - simEmissionTon;
    const simRawKWh = simRes.rawElectricityKWh || 0;
    
    let electricityReductionKWh = 0;
    let electricityCostSaved = 0;

    if (isOnlineOpt) {
      electricityReductionKWh = Math.max(0, currentRawKWh - simRawKWh);
      electricityCostSaved = electricityReductionKWh * 4;
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

  const groupedMap: Record<string, typeof evaluatedList> = {
    online: [],
    onsite: []
  };

  evaluatedList.forEach(item => {
    const mainGroup = item.option.subCategory.toLowerCase() === 'online' ? 'online' : 'onsite';
    groupedMap[mainGroup].push(item);
  });

  const meetingGroups: GroupedVehicleRecommendation[] = [];

  if (groupedMap.online.length > 0) {
    const validOnlineFuels = groupedMap.online.filter(item => item.reductionTon > 0);
    if (validOnlineFuels.length > 0) {
      validOnlineFuels.sort((a, b) => a.emissionTon - b.emissionTon);
      meetingGroups.push({
        subCategory: 'online',
        bestEmissionTon: validOnlineFuels[0].emissionTon,
        fuels: validOnlineFuels,
      });
    }
  }

  if (groupedMap.onsite.length > 0) {
    const items = groupedMap.onsite;
    const gasohols = items.filter(i => i.option.fuelType.toLowerCase().includes('gasohol')).sort((a, b) => a.emissionTon - b.emissionTon);
    const diesels = items.filter(i => i.option.fuelType.toLowerCase().includes('diesel')).sort((a, b) => a.emissionTon - b.emissionTon);
    const gasOptions = items.filter(i => ['cng', 'lpg'].includes(i.option.fuelType.toLowerCase())).sort((a, b) => a.emissionTon - b.emissionTon);
    const evOptions = items.filter(i => i.option.fuelType.toLowerCase().includes('electricity') || i.option.subCategory.toLowerCase() === 'ev').sort((a, b) => a.emissionTon - b.emissionTon);
    const others = items.filter(i => 
      !i.option.fuelType.toLowerCase().includes('gasohol') &&
      !i.option.fuelType.toLowerCase().includes('diesel') &&
      !['cng', 'lpg'].includes(i.option.fuelType.toLowerCase()) &&
      !i.option.fuelType.toLowerCase().includes('electricity')
    ).sort((a, b) => a.emissionTon - b.emissionTon);

    const selectedFuels: typeof items = [];
    if (gasohols.length > 0) selectedFuels.push(gasohols[0]);
    if (diesels.length > 0) selectedFuels.push(diesels[0]);
    if (gasOptions.length > 0) selectedFuels.push(gasOptions[0]);
    if (evOptions.length > 0) selectedFuels.push(evOptions[0]);
    if (others.length > 0) selectedFuels.push(others[0]);

    selectedFuels.sort((a, b) => a.emissionTon - b.emissionTon);

    if (selectedFuels.some(item => item.reductionTon > 0)) {
      meetingGroups.push({
        subCategory: 'onsite',
        bestEmissionTon: selectedFuels[0].emissionTon,
        fuels: selectedFuels,
      });
    }
  }

  meetingGroups.sort((a, b) => a.bestEmissionTon - b.bestEmissionTon);
  return meetingGroups;
}

export function getTravelRecommendations(params: {
  currentEmission: number; 
  userInput: CarbonCalcInput;
  allAvailableOptions: OptionType[];
  fetchEFFromDB: (fuelKey: string) => number;
}): GroupedVehicleRecommendation[] {
  const { currentEmission, userInput, allAvailableOptions, fetchEFFromDB } = params;
  
  const currentSimRes = executeCarbonCalculation({
    ...userInput,
    category: 'travel',
    emissionFactor: userInput.emissionFactor,
    electricityEmissionFactor: userInput.electricityEmissionFactor || 0,
  });
  const currentRawKWh = currentSimRes.rawElectricityKWh || 0;

  const currentEmissionTon = currentEmission > 10 ? currentEmission / 1000 : currentEmission;
  const currentUserSubCategory = (userInput.subCategory || '').toLowerCase();
  const currentUserFuel = (userInput.fuelType || '').toLowerCase();

  const evaluatedList: { 
    option: OptionType; 
    emissionTon: number; 
    reductionTon: number; 
    electricityReductionKWh?: number; 
    electricityCostSaved?: number; 
    isCurrent: boolean 
  }[] = [];

  allAvailableOptions.forEach((option: OptionType) => {
    const isCurrent = 
      option.subCategory.toLowerCase() === currentUserSubCategory && 
      option.fuelType.toLowerCase() === currentUserFuel;

    if (isCurrent) return;

    const ef = fetchEFFromDB(option.fuelType);
    const isEvOption = option.subCategory.toLowerCase() === 'ev' || option.fuelType.toLowerCase().includes('electricity');

    const simInput: CarbonCalcInput = {
      ...userInput,
      category: 'travel',
      subCategory: option.subCategory, 
      fuelType: option.fuelType,
      emissionFactor: ef,
      electricityEmissionFactor: userInput.electricityEmissionFactor || 0,
      isRecommendationSimulation: isEvOption,
    };

    const simRes = executeCarbonCalculation(simInput);
    const simEmissionTon = simRes.totalCalculatedTon;
    const reductionTon = currentEmissionTon - simEmissionTon;

    const simRawKWh = simRes.rawElectricityKWh || 0;
    const electricityReductionKWh = currentRawKWh - simRawKWh;
    const electricityCostSaved = isEvOption ? 0 : electricityReductionKWh * 4;

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

  const groupedMap: Record<string, typeof evaluatedList> = {};
  evaluatedList.forEach(item => {
    const subCat = item.option.subCategory.toLowerCase();
    if (!groupedMap[subCat]) groupedMap[subCat] = [];
    groupedMap[subCat].push(item);
  });

  const vehicleGroups: GroupedVehicleRecommendation[] = Object.keys(groupedMap).map(subCategory => {
    const items = groupedMap[subCategory];

    const gasohols = items.filter(i => i.option.fuelType.toLowerCase().includes('gasohol')).sort((a, b) => a.emissionTon - b.emissionTon);
    const diesels = items.filter(i => i.option.fuelType.toLowerCase().includes('diesel')).sort((a, b) => a.emissionTon - b.emissionTon);
    const gasOptions = items.filter(i => ['cng', 'lpg'].includes(i.option.fuelType.toLowerCase())).sort((a, b) => a.emissionTon - b.emissionTon);
    const evOptions = items.filter(i => i.option.fuelType.toLowerCase().includes('electricity') || i.option.subCategory.toLowerCase() === 'ev').sort((a, b) => a.emissionTon - b.emissionTon);
    const others = items.filter(i => 
      !i.option.fuelType.toLowerCase().includes('gasohol') &&
      !i.option.fuelType.toLowerCase().includes('diesel') &&
      !['cng', 'lpg'].includes(i.option.fuelType.toLowerCase()) &&
      !i.option.fuelType.toLowerCase().includes('electricity')
    ).sort((a, b) => a.emissionTon - b.emissionTon);

    const selectedFuels: typeof items = [];
    if (gasohols.length > 0) selectedFuels.push(gasohols[0]);
    if (diesels.length > 0) selectedFuels.push(diesels[0]);
    if (gasOptions.length > 0) selectedFuels.push(gasOptions[0]);
    if (evOptions.length > 0) selectedFuels.push(evOptions[0]);
    if (others.length > 0) selectedFuels.push(others[0]);

    selectedFuels.sort((a, b) => a.emissionTon - b.emissionTon);

    return {
      subCategory,
      bestEmissionTon: selectedFuels[0].emissionTon,
      fuels: selectedFuels,
    };
  }).filter(group => group.fuels.some(f => f.reductionTon > 0));

  vehicleGroups.sort((a, b) => a.bestEmissionTon - b.bestEmissionTon);
  return vehicleGroups;
}