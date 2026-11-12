"use client";
/* [MERGE aom + cyn2 รอบ 2] ไฟล์นี้ = โค้ด cyn2 ทั้งไฟล์ (เดิมอยู่ที่ activity_based/components/MeetingForm.tsx cyn2 ย้ายมา general_activity)
 * ฟอร์มการประชุม/อบรม/อีเวนต์ (online / onsite + อุปกรณ์หลายเซต) เลือกกิจกรรมเก่ามาแก้หรือลบได้ */

import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export type EquipmentSetInput = {
  equipmentName: string;
  devices: number;
  durationHours: number;
  electricityKwh: number;
};

export type MeetingData = {
  meetingName: string;
  category_type: string;
  durationHours: number;
  equipmentSets?: EquipmentSetInput[];
  vehicleType?: string;
  fuelType?: string;
  distanceKm?: number;
  trips?: number;
  electricityKwh?: number;
  ef_id?: string | null;
};

export type MeetingFormProps = {
  orgId: string;
  initialData?: MeetingData | null;
  onDataChange: (data: MeetingData | null) => void;
  fetchElectricityEF: () => { id: string | null; value: number };
  getEFDetail: (fuelKey: string) => { id: string | null; value: number };
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
    { id: "gasohol_e10", label: "Gasohol E10" },
    { id: "gasohol_e20", label: "Gasohol E20" },
    { id: "gasohol_e85", label: "Gasohol E85" },
    { id: "diesel_b7", label: "Diesel B7" },
    { id: "diesel_b20", label: "Diesel B20" },
    { id: "cng", label: "CNG" },
    { id: "lpg", label: "LPG" },
  ],
  motorcycle: [
    { id: "gasohol_e10", label: "Gasohol E10" },
    { id: "gasohol_e20", label: "Gasohol E20" },
    { id: "gasohol_e85", label: "Gasohol E85" },
  ],
  van: [
    { id: "diesel_b7", label: "Diesel B7" },
    { id: "diesel_b20", label: "Diesel B20" },
    { id: "cng", label: "CNG" },
    { id: "lpg", label: "LPG" },
  ],
  bus: [
    { id: "diesel_b7", label: "Diesel B7" },
    { id: "diesel_b20", label: "Diesel B20" },
    { id: "cng", label: "CNG" },
    { id: "lpg", label: "LPG" },
  ],
  ev: [
    { id: "electricity", label: "กระแสไฟฟ้า (kWh/km)" },
  ],
};

export default function MeetingForm({ orgId, initialData, onDataChange, fetchElectricityEF, getEFDetail }: MeetingFormProps) {
  const [meetingName, setMeetingName] = useState("");
  const [category_type, setCategoryType] = useState("online");
  const [pastMeetingsData, setPastMeetingsData] = useState<any[]>([]);
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const defaultEquipmentSets = [
    { id: "1", equipmentName: "คอมพิวเตอร์ / อุปกรณ์สำนักงาน", devices: 1, durationHours: 2, electricityKwh: 0.1 }
  ];

  const [equipmentSets, setEquipmentSets] = useState(defaultEquipmentSets);
  const [vehicleType, setVehicleType] = useState("car");
  const [fuelType, setFuelType] = useState(FUEL_OPTIONS_MAP["car"][0].id);
  const [distanceKm, setDistanceKm] = useState("10");
  const [trips, setTrips] = useState("1");
  const [evElectricityKwh, setEvElectricityKwh] = useState("0.16");

  // ดึงประวัติจากตาราง general_activity_meeting
  useEffect(() => {
    async function fetchPastData() {
      if (!orgId) return;
      const { data, error } = await supabase
        .from("general_activity_meeting")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      
      if (data && !error) {
        setPastMeetingsData(data);
      }
    }
    fetchPastData();
  }, [orgId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpenDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const emitChange = (
    name: string,
    catType: string,
    sets: typeof equipmentSets,
    vType: string,
    fType: string,
    dist: string,
    tripCount: string,
    evKwh: string
  ) => {
    if (!name.trim()) {
      onDataChange(null);
      return;
    }

    const formattedSets: EquipmentSetInput[] = sets.map(item => ({
      equipmentName: item.equipmentName.trim() || "อุปกรณ์",
      devices: Number(item.devices) || 1,
      durationHours: Number(item.durationHours) || 1,
      electricityKwh: Number(item.electricityKwh) || 0.1,
    }));

    const rawFuel = catType === 'online' ? 'electricity' : (vType === 'ev' ? 'electricity' : fType);
    const efObj = catType === 'online' ? fetchElectricityEF() : getEFDetail(rawFuel);

    const payload: MeetingData = {
      meetingName: name.trim(),
      category_type: catType,
      durationHours: Number(sets[0]?.durationHours || 1),
      equipmentSets: formattedSets,
      ef_id: efObj.id,
    };

    if (catType === "onsite") {
      payload.vehicleType = vType;
      payload.fuelType = rawFuel;
      payload.distanceKm = Number(dist) || 0;
      payload.trips = Number(tripCount) || 1;
      if (vType === "ev") {
        payload.electricityKwh = Number(evKwh) || 0.16;
      }
    }

    onDataChange(payload);
  };

  useEffect(() => {
    if (initialData) {
      setMeetingName(initialData.meetingName || "");
      setCategoryType(initialData.category_type || "online");
      if (initialData.equipmentSets && initialData.equipmentSets.length > 0) {
        setEquipmentSets(
          initialData.equipmentSets.map((set, idx) => ({
            id: String(idx + 1),
            equipmentName: set.equipmentName,
            devices: set.devices,
            durationHours: set.durationHours,
            electricityKwh: set.electricityKwh,
          }))
        );
      }
      if (initialData.category_type === "onsite") {
        setVehicleType(initialData.vehicleType || "car");
        setFuelType(initialData.fuelType || "gasohol_e10");
        setDistanceKm(String(initialData.distanceKm || 10));
        setTrips(String(initialData.trips || 1));
        if (initialData.electricityKwh) {
          setEvElectricityKwh(String(initialData.electricityKwh));
        }
      }
    }
  }, [initialData]);

  const handleNameChange = (val: string) => {
    setMeetingName(val);

    const matchedRecords = pastMeetingsData.filter(item => item.activity_name === val);
    
    if (matchedRecords.length > 0) {
      const firstRecord = matchedRecords[0];
      const cType = firstRecord.category_type || "online";
      setCategoryType(cType);

      const loadedEquipmentSets = matchedRecords.map((record, index) => ({
        id: String(index + 1),
        equipmentName: record.equipment_name || "อุปกรณ์",
        devices: Number(record.devices || 1),
        durationHours: Number(record.hours || 2),
        electricityKwh: Number(record.electricity_kwh || 0.1),
      }));

      setEquipmentSets(loadedEquipmentSets);

      if (cType === "onsite") {
        const v = firstRecord.vehicle_type || "car";
        const f = firstRecord.fuel_type || "gasohol_e10";
        const d = String(firstRecord.distance || 10);
        const t = String(firstRecord.trips || 1);

        setVehicleType(v);
        setFuelType(f);
        setDistanceKm(d);
        setTrips(t);

        emitChange(val, cType, loadedEquipmentSets, v, f, d, t, evElectricityKwh);
        return;
      }

      emitChange(val, cType, loadedEquipmentSets, vehicleType, fuelType, distanceKm, trips, evElectricityKwh);
    } else {
      emitChange(val, category_type, equipmentSets, vehicleType, fuelType, distanceKm, trips, evElectricityKwh);
    }
  };

  // ฟังก์ชันลบกิจกรรมออกจากฐานข้อมูล Supabase ทันที
  const handleDeleteActivity = async () => {
    if (!meetingName.trim()) return;
    if (!confirm(`คุณต้องการลบกิจกรรม "${meetingName}" ออกจากระบบใช่หรือไม่?`)) return;

    try {
      const { error } = await supabase
        .from("general_activity_meeting")
        .delete()
        .eq("org_id", orgId)
        .eq("activity_name", meetingName.trim());

      if (error) throw error;

      alert("ลบกิจกรรมออกจากระบบเรียบร้อยแล้ว");
      setPastMeetingsData(prev => prev.filter(item => item.activity_name !== meetingName.trim()));
      setMeetingName("");
      onDataChange(null);
    } catch (err: any) {
      console.error("Delete error:", err);
      alert(`เกิดข้อผิดพลาดในการลบ: ${err.message || err}`);
    }
  };

  const handleCategoryTypeChange = (val: string) => {
    setCategoryType(val);
    emitChange(meetingName, val, equipmentSets, vehicleType, fuelType, distanceKm, trips, evElectricityKwh);
  };

  const handleVehicleChange = (newVehicle: string) => {
    setVehicleType(newVehicle);
    const fuels = FUEL_OPTIONS_MAP[newVehicle] || [];
    const newFuel = fuels.length > 0 ? fuels[0].id : "gasohol_e10";
    setFuelType(newFuel);
    emitChange(meetingName, category_type, equipmentSets, newVehicle, newFuel, distanceKm, trips, evElectricityKwh);
  };

  const handleEquipmentChange = (id: string, field: string, value: any) => {
    const updated = equipmentSets.map(item => (item.id === id ? { ...item, [field]: value } : item));
    setEquipmentSets(updated);
    emitChange(meetingName, category_type, updated, vehicleType, fuelType, distanceKm, trips, evElectricityKwh);
  };

  const handleAddEquipmentSet = () => {
    const updated = [
      ...equipmentSets,
      { id: Date.now().toString(), equipmentName: "", devices: 1, durationHours: 1, electricityKwh: 0.1 }
    ];
    setEquipmentSets(updated);
    emitChange(meetingName, category_type, updated, vehicleType, fuelType, distanceKm, trips, evElectricityKwh);
  };

  const handleRemoveEquipmentSet = (id: string) => {
    if (equipmentSets.length === 1) {
      alert("ต้องมีรายการอุปกรณ์ไฟฟ้าอย่างน้อย 1 เซต");
      return;
    }
    const updated = equipmentSets.filter(item => item.id !== id);
    setEquipmentSets(updated);
    emitChange(meetingName, category_type, updated, vehicleType, fuelType, distanceKm, trips, evElectricityKwh);
  };

  const currentFuels = FUEL_OPTIONS_MAP[vehicleType] || [];
  const isEvSelected = vehicleType === "ev";
  const uniqueMeetingNames = Array.from(new Set(pastMeetingsData.map(item => item.activity_name).filter(Boolean)));
  const isExistingActivity = uniqueMeetingNames.includes(meetingName.trim());

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">ข้อมูลการประชุม อบรม และจัดกิจกรรม</h2>
        <div className="flex items-center gap-3">
          {isExistingActivity && (
            <button
              type="button"
              onClick={handleDeleteActivity}
              className="text-xs text-red-600 hover:underline font-semibold flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> ลบกิจกรรมนี้
            </button>
          )}
          {meetingName && (
            <button
              type="button"
              onClick={() => { setMeetingName(""); onDataChange(null); }}
              className="text-xs text-gray-500 hover:underline font-medium"
            >
              ล้างฟอร์ม
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="relative" ref={dropdownRef}>
          <label className="mb-1 block text-xs font-medium text-gray-700">ชื่อการประชุม / กิจกรรม *</label>
          <div className="relative flex items-center">
            <input
              type="text"
              value={meetingName}
              onChange={(e) => {
                handleNameChange(e.target.value);
                setIsOpenDropdown(true);
              }}
              onFocus={() => setIsOpenDropdown(true)}
              placeholder="พิมพ์ชื่อใหม่ หรือคลิกเลือกลิสต์ประวัติเก่า..."
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-800 outline-none focus:border-[#32885F]"
            />
            <button
              type="button"
              onClick={() => setIsOpenDropdown(!isOpenDropdown)}
              className="absolute right-0 inset-y-0 px-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <svg className={`w-4 h-4 transition-transform ${isOpenDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {isOpenDropdown && uniqueMeetingNames.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
              <div className="sticky top-0 bg-gray-50 px-3 py-2 text-[11px] font-semibold text-gray-500 border-b border-gray-100">
                ประวัติกิจกรรมเก่า (คลิกเพื่อดึงข้อมูลอุปกรณ์ทั้งหมดมาแสดงครบถ้วน)
              </div>
              {uniqueMeetingNames.map((name, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    handleNameChange(name);
                    setIsOpenDropdown(false);
                  }}
                  className="cursor-pointer px-3 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-[#32885F] transition border-b border-gray-50 last:border-none"
                >
                  {name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">รูปแบบการประชุม *</label>
          <select
            value={category_type}
            onChange={(e) => handleCategoryTypeChange(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#32885F]"
          >
            {MEETING_TYPES.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-3 rounded-xl bg-gray-50 p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              {category_type === "online" ? "อุปกรณ์ที่ใช้ประชุมออนไลน์" : "พลังงานไฟฟ้าในห้องประชุม"}
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
                  placeholder="เช่น คอมพิวเตอร์"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-[#32885F]"
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
                />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1 block text-[11px] font-medium text-gray-600">kWh/ชม.</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={set.electricityKwh}
                  onChange={(e) => handleEquipmentChange(set.id, "electricityKwh", Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-[#32885F]"
                />
              </div>
              <div className="sm:col-span-1 flex justify-end pb-0.5">
                <button
                  type="button"
                  onClick={() => handleRemoveEquipmentSet(set.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {category_type === "onsite" && (
          <div className="space-y-4 rounded-xl bg-gray-50 p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800">การเดินทาง (ออนไซต์)</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">ประเภทยานพาหนะ *</label>
                <select
                  value={vehicleType}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#32885F]"
                >
                  {VEHICLE_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">ประเภทเชื้อเพลิง *</label>
                <select
                  value={fuelType}
                  onChange={(e) => {
                    setFuelType(e.target.value);
                    emitChange(meetingName, category_type, equipmentSets, vehicleType, e.target.value, distanceKm, trips, evElectricityKwh);
                  }}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#32885F]"
                >
                  {currentFuels.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {isEvSelected && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">ปริมาณกระแสไฟฟ้า (kWh) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={evElectricityKwh}
                  onChange={(e) => {
                    setEvElectricityKwh(e.target.value);
                    emitChange(meetingName, category_type, equipmentSets, vehicleType, fuelType, distanceKm, trips, e.target.value);
                  }}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">ระยะทาง (กิโลเมตร) *</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={distanceKm}
                  onChange={(e) => {
                    setDistanceKm(e.target.value);
                    emitChange(meetingName, category_type, equipmentSets, vehicleType, fuelType, e.target.value, trips, evElectricityKwh);
                  }}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">จำนวนเที่ยว *</label>
                <input
                  type="number"
                  min="1"
                  value={trips}
                  onChange={(e) => {
                    setTrips(e.target.value);
                    emitChange(meetingName, category_type, equipmentSets, vehicleType, fuelType, distanceKm, e.target.value, evElectricityKwh);
                  }}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}