"use client";

import React, { useState, useEffect } from "react";

export type TravelData = {
  travel_name: string; // ชื่อกิจกรรมการเดินทางย่อย
  distanceKm: number;
  trips: number;
  vehicleType: string;
  fuelType: string;
  electricityKwh?: number;
  ef_id?: string | null;
};

type TravelFormProps = {
  initialData?: TravelData | null;
  onSubmit: (data: TravelData) => void;
  adminActivities?: any[];
};

const VEHICLE_OPTIONS = [
  { id: "car", label: "รถยนต์" },
  { id: "motorcycle", label: "รถจักรยานยนต์" },
  { id: "van", label: "รถตู้โดยสาร" },
  { id: "bus", label: "รถโดยสารประจำทาง" },
  { id: "ev", label: "รถไฟฟ้า (EV)" },
];

const FUEL_OPTIONS_MAP: Record<string, { id: string; label: string }[]> = {
  car: [
    { id: "Gasohol_E10", label: "Gasohol E10 (ค่าเริ่มต้น)" },
    { id: "Gasohol_E20", label: "Gasohol E20" },
    { id: "Gasohol_E85", label: "Gasohol E85" },
    { id: "Diesel_B7", label: "Diesel B7" },
    { id: "Diesel_B20", label: "Diesel B20" },
    { id: "CNG", label: "CNG" },
    { id: "LPG", label: "LPG" },
  ],
  motorcycle: [
    { id: "Gasohol_E10", label: "Gasohol E10" },
    { id: "Gasohol_E20", label: "Gasohol E20" },
    { id: "Gasohol_E85", label: "Gasohol E85" },
  ],
  van: [
    { id: "Diesel_B7", label: "Diesel B7" },
    { id: "Diesel_B20", label: "Diesel B20" },
    { id: "CNG", label: "CNG" },
    { id: "LPG", label: "LPG" },
  ],
  bus: [
    { id: "Diesel_B7", label: "Diesel B7" },
    { id: "Diesel_B20", label: "Diesel B20" },
    { id: "CNG", label: "CNG" },
    { id: "LPG", label: "LPG" },
  ],
  ev: [
    { id: "Electricity", label: "กระแสไฟฟ้า(kWh/km)" },
  ],
};

export default function TravelForm({ initialData, onSubmit, adminActivities = [] }: TravelFormProps) {
  const [travelName, setTravelName] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  
  const availableFuels = FUEL_OPTIONS_MAP["car"];
  const [fuelType, setFuelType] = useState(availableFuels[0].id);

  const [distanceKm, setDistanceKm] = useState("10");
  const [electricityKwh, setElectricityKwh] = useState("0.16");
  const [trips, setTrips] = useState("1");

  useEffect(() => {
    if (initialData) {
      setTravelName(initialData.travel_name || "");
      setVehicleType(initialData.vehicleType || "car");
      setFuelType(initialData.fuelType || "Gasohol_E10");
      setDistanceKm(String(initialData.distanceKm || 10));
      setTrips(String(initialData.trips || 1));
      if (initialData.electricityKwh) {
        setElectricityKwh(String(initialData.electricityKwh));
      }
    } else {
      setTravelName("");
      setVehicleType("car");
      setFuelType(FUEL_OPTIONS_MAP["car"][0].id);
      setDistanceKm("10");
      setElectricityKwh("0.16");
      setTrips("1");
    }
  }, [initialData]);

  const handleVehicleChange = (newVehicle: string) => {
    setVehicleType(newVehicle);
    const fuels = FUEL_OPTIONS_MAP[newVehicle] || [];
    if (fuels.length > 0) {
      setFuelType(fuels[0].id);
    }
  };

  const currentFuels = FUEL_OPTIONS_MAP[vehicleType] || [];
  const isEvSelected = vehicleType === "ev";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const distance = Number(distanceKm);
    const kwh = Number(electricityKwh);
    const tripCount = Number(trips);

    if (!travelName.trim()) {
      alert("กรุณากรอกรายละเอียดการเดินทาง");
      return;
    }

    if (tripCount <= 0 || distance <= 0) {
      alert("กรุณาระบุระยะทางและจำนวนเที่ยวให้ถูกต้อง");
      return;
    }

    if (isEvSelected && kwh <= 0) {
      alert("กรุณาระบุอัตราการใช้พลังงานไฟฟ้า(kWh/km) ให้ถูกต้อง");
      return;
    }

    const foundAct = adminActivities.find(a => 
      a.ef_name?.toLowerCase().includes(fuelType.toLowerCase()) ||
      a.sub_category?.toLowerCase().includes(fuelType.toLowerCase()) ||
      a.sub_category?.toLowerCase().includes(vehicleType.toLowerCase()) ||
      a.activity_name?.toLowerCase().includes(vehicleType.toLowerCase())
    );
    const matchedEfId = foundAct ? foundAct.ef_id : (adminActivities[0]?.ef_id || null);

    onSubmit({
      travel_name: travelName.trim(),
      distanceKm: distance,
      electricityKwh: isEvSelected ? kwh : undefined,
      trips: tripCount,
      vehicleType,
      fuelType: isEvSelected ? "Electricity" : fuelType,
      ef_id: matchedEfId,
    });
    alert("บันทึกข้อมูลการเดินทางชั่วคราวแล้ว");
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4">
        <h2 className="text-base font-semibold text-gray-800">ข้อมูลการเดินทาง</h2>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">รายละเอียดการเดินทาง *</label>
            <input
              type="text"
              value={travelName}
              onChange={(e) => setTravelName(e.target.value)}
              placeholder="เช่น เดินทางไปพบลูกค้า"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">ประเภทยานพาหนะ *</label>
              <select
                value={vehicleType}
                onChange={(e) => handleVehicleChange(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#32885F]"
              >
                {VEHICLE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">ประเภทน้ำมัน/เชื้อเพลิง *</label>
              <select
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#32885F]"
              >
                {currentFuels.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isEvSelected && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                อัตราการใช้พลังงานไฟฟ้า(kWh/km) *
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={electricityKwh}
                onChange={(e) => setElectricityKwh(e.target.value)}
                placeholder="เช่น 0.16"
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">ระยะทาง(กิโลเมตร) *</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">จำนวนเที่ยว *</label>
              <input
                type="number"
                min="1"
                value={trips}
                onChange={(e) => setTrips(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-xl bg-[#32885F] px-6 py-2.5 font-semibold text-white text-sm transition hover:bg-[#286e4d]"
          >
            บันทึกข้อมูลการเดินทาง
          </button>
        </form>
      </div>
    </section>
  );
}