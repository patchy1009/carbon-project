"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";

export type EquipmentSetInput = {
  equipmentName: string;
  devices: number;
  durationHours: number;
  electricityKwh: number;
};

export type MeetingData = {
  meetingName: string;
  meetingType: string;
  durationHours: number;
  equipmentSets?: EquipmentSetInput[];
  vehicleType?: string;
  fuelType?: string;
  distanceKm?: number;
  trips?: number;
  electricityKwh?: number;
  ef_id?: string | null;
};

type MeetingFormProps = {
  onSubmit: (data: MeetingData) => void;
  adminActivities?: any[];
};

const MEETING_TYPES = [
  { id: "online", label: "ประชุมออนไลน์ (Online)" },
  { id: "onsite", label: "ประชุมออนไซต์ อบรม และจัดกิจกรรม (Onsite)" },
];

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
    { id: "Electricity", label: "กระแสไฟฟ้า (kWh/km)" },
  ],
};

export default function MeetingForm({ onSubmit, adminActivities = [] }: MeetingFormProps) {
  const [meetingName, setMeetingName] = useState("");
  const [meetingType, setMeetingType] = useState("online");

  // กำหนดค่าเริ่มต้นเป็น Number ทั้งหมดเพื่อป้องกัน Type Mismatch
  const onlineDefaultSets = [
    { id: "1", equipmentName: "คอมพิวเตอร์", devices: 1, durationHours: 2, electricityKwh: 60}
  ];

  const onsiteDefaultSets = [
    { id: "1", equipmentName: "หลอดไฟ", devices: 10, durationHours: 2, electricityKwh: 0.05 },
  ];

  const [equipmentSets, setEquipmentSets] = useState(onlineDefaultSets);

  useEffect(() => {
    if (meetingType === "online") {
      setEquipmentSets(onlineDefaultSets);
    } else {
      setEquipmentSets(onsiteDefaultSets);
    }
  }, [meetingType]);

  const [vehicleType, setVehicleType] = useState("car");
  const [fuelType, setFuelType] = useState(FUEL_OPTIONS_MAP["car"][0].id);
  const [distanceKm, setDistanceKm] = useState("10");
  const [trips, setTrips] = useState("1");
  const [evElectricityKwh, setEvElectricityKwh] = useState("0.16");

  const handleVehicleChange = (newVehicle: string) => {
    setVehicleType(newVehicle);
    const fuels = FUEL_OPTIONS_MAP[newVehicle] || [];
    if (fuels.length > 0) {
      setFuelType(fuels[0].id);
    }
  };

  const currentFuels = FUEL_OPTIONS_MAP[vehicleType] || [];
  const isEvSelected = vehicleType === "ev";

  const handleAddEquipmentSet = () => {
    setEquipmentSets([
      ...equipmentSets,
      { id: Date.now().toString(), equipmentName: "", devices: 1, durationHours: 1, electricityKwh: 0.1 }
    ]);
  };

  const handleRemoveEquipmentSet = (id: string) => {
    if (equipmentSets.length === 1) {
      alert("ต้องมีรายการอุปกรณ์ไฟฟ้าอย่างน้อย 1 เซต");
      return;
    }
    setEquipmentSets(equipmentSets.filter(item => item.id !== id));
  };

  const handleEquipmentChange = (id: string, field: string, value: any) => {
    setEquipmentSets(
      equipmentSets.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!meetingName.trim()) {
      alert("กรุณากรอกชื่อการประชุม");
      return;
    }

    let matchedEfId: null | string = null;

    const formattedSets: EquipmentSetInput[] = equipmentSets.map(item => ({
      equipmentName: item.equipmentName.trim() || "อุปกรณ์ไม่ระบุชื่อ",
      devices: Number(item.devices) || 1,
      durationHours: Number(item.durationHours) || 1,
      electricityKwh: Number(item.electricityKwh) || 0.1,
    }));

    if (meetingType === "online") {
      const foundAct = adminActivities.find(a => 
        a.category_name?.includes("ไฟฟ้า") || 
        a.sub_category?.includes("ไฟฟ้า") || 
        a.ef_name?.includes("electricity") ||
        a.sub_category?.toLowerCase().includes("online")
      );
      matchedEfId = foundAct ? foundAct.ef_id : (adminActivities[0]?.ef_id || null);

      onSubmit({
        meetingName: meetingName.trim(),
        meetingType: "online",
        durationHours: Number(equipmentSets[0]?.durationHours || 1),
        equipmentSets: formattedSets,
        ef_id: matchedEfId,
      });
    } else if (meetingType === "onsite") {
      const distance = Number(distanceKm);
      const tripCount = Number(trips);
      const evKwh = Number(evElectricityKwh);

      if (tripCount <= 0 || distance <= 0) {
        alert("กรุณาระบุระยะทางและจำนวนเที่ยวให้ถูกต้อง");
        return;
      }

      if (isEvSelected && evKwh <= 0) {
        alert("กรุณาระบุอัตราการใช้พลังงานไฟฟ้า(kWh/km) สำหรับรถไฟฟ้าให้ถูกต้อง");
        return;
      }

      const activeFuelKey = isEvSelected ? "Electricity" : fuelType;
      const foundAct = adminActivities.find(a => 
        a.ef_name?.toLowerCase().includes(activeFuelKey.toLowerCase()) ||
        a.sub_category?.toLowerCase().includes(activeFuelKey.toLowerCase()) ||
        a.sub_category?.toLowerCase().includes(vehicleType.toLowerCase())
      );
      matchedEfId = foundAct ? foundAct.ef_id : (adminActivities[0]?.ef_id || null);

      onSubmit({
        meetingName: meetingName.trim(),
        meetingType: "onsite",
        durationHours: Number(equipmentSets[0]?.durationHours || 1),
        equipmentSets: formattedSets,
        vehicleType,
        fuelType: activeFuelKey,
        distanceKm: distance,
        electricityKwh: isEvSelected ? evKwh : undefined,
        trips: tripCount,
        ef_id: matchedEfId,
      });
    }

    alert("บันทึกข้อมูลการประชุมชั่วคราวแล้ว");
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4">
        <h2 className="text-base font-semibold text-gray-800">ข้อมูลการประชุม อบรม และจัดกิจกรรม</h2>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">ชื่อการประชุม *</label>
            <input
              type="text"
              value={meetingName}
              onChange={(e) => setMeetingName(e.target.value)}
              placeholder="เช่น การประชุมสัมมนาประจำปี"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">รูปแบบการประชุม *</label>
            <select
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#32885F]"
            >
              {MEETING_TYPES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 rounded-xl bg-gray-50 p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                {meetingType === "online" ? "อุปกรณ์ที่ใช้ประชุมออนไลน์ (เพิ่มได้หลายเซต)" : "พลังงานไฟฟ้าในห้องประชุม (เพิ่มได้หลายเซตอุปกรณ์)"}
              </h3>
              <button
                type="button"
                onClick={handleAddEquipmentSet}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#32885F] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#286e4d]"
              >
                <Plus className="w-3.5 h-3.5" /> เพิ่มอุปกรณ์
              </button>
            </div>

            {equipmentSets.map((set, index) => (
              <div key={set.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end pt-2 border-t border-gray-200">
                <div className="sm:col-span-4">
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">ชนิดอุปกรณ์ {index + 1}</label>
                  <input
                    type="text"
                    value={set.equipmentName}
                    onChange={(e) => handleEquipmentChange(set.id, "equipmentName", e.target.value)}
                    placeholder={meetingType === "online" ? "เช่น คอมพิวเตอร์, โทรศัพท์" : "เช่น หลอดไฟ, โปรเจกเตอร์"}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-[#32885F]"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">จำนวน</label>
                  <input
                    type="number"
                    min="1"
                    value={set.devices}
                    onChange={(e) => handleEquipmentChange(set.id, "devices", Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-[#32885F]"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">ชม.ใช้งาน</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={set.durationHours}
                    onChange={(e) => handleEquipmentChange(set.id, "durationHours", Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-[#32885F]"
                    required
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">kWh/เครื่อง/ชม.</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={set.electricityKwh}
                    onChange={(e) => handleEquipmentChange(set.id, "electricityKwh", Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-[#32885F]"
                    required
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end pb-0.5">
                  <button
                    type="button"
                    onClick={() => handleRemoveEquipmentSet(set.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="ลบเซตนี้"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {meetingType === "onsite" && (
            <div className="space-y-4 rounded-xl bg-gray-50 p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">การเดินทาง</h3>
              
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
                    value={evElectricityKwh}
                    onChange={(e) => setEvElectricityKwh(e.target.value)}
                    placeholder="เช่น 0.16"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
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
            </div>
          )}

          <button
            type="submit"
            className="rounded-xl bg-[#32885F] px-6 py-2.5 font-semibold text-white text-sm transition hover:bg-[#286e4d]"
          >
            บันทึกข้อมูลการประชุม
          </button>
        </form>
      </div>
    </section>
  );
}