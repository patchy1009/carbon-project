"use client";

import React, { useState } from "react";

export type MeetingData = {
  meetingName: string;
  meetingType: string; // 'online' หรือ 'onsite'
  participantsOrDevices: number;
  durationHours: number;
  vehicleType?: string;
  fuelType?: string;
  distanceKm?: number;
  trips?: number;
  electricityKwh?: number;
  ef_id?: string | null; // เพิ่ม ef_id เพื่อส่งกลับไปผูก Foreign Key ใน DB
};

type MeetingFormProps = {
  onSubmit: (data: MeetingData) => void;
  adminActivities?: any[];
};

const MEETING_TYPES = [
  { id: "online", label: "ประชุมออนไลน์ (Online)" },
  { id: "onsite", label: "ประชุมออนไซต์ (Onsite)" },
];

const ONSITE_VEHICLES = [
  { id: "car", label: "รถยนต์" },
  { id: "motorcycle", label: "รถจักรยานยนต์" },
  { id: "van", label: "รถตู้" },
  { id: "bus", label: "รถประจำทาง" },
  { id: "ev", label: "รถไฟฟ้า" },
];

const ONSITE_FUELS_MAP: Record<string, { id: string; label: string; unit: string }[]> = {
  car: [
    { id: "gasohol_e10", label: "Gasohol E10", unit: "กิโลเมตร" },
    { id: "gasohol_e20", label: "Gasohol E20", unit: "กิโลเมตร" },
    { id: "gasohol_e85", label: "Gasohol E85", unit: "กิโลเมตร" },
    { id: "diesel_b7", label: "Diesel B7", unit: "กิโลเมตร" },
    { id: "diesel_b20", label: "Diesel B20", unit: "กิโลเมตร" },
  ],
  motorcycle: [
    { id: "gasohol_e10", label: "Gasohol E10", unit: "กิโลเมตร" },
    { id: "gasohol_e20", label: "Gasohol E20", unit: "กิโลเมตร" },
  ],
  van: [
    { id: "diesel_b7", label: "Diesel B7", unit: "กิโลเมตร" },
    { id: "diesel_b20", label: "Diesel B20", unit: "กิโลเมตร" },
  ],
  bus: [
    { id: "diesel_b7", label: "Diesel B7", unit: "กิโลเมตร" },
  ],
  ev: [
    { id: "ev_kwh", label: "กระแสไฟฟ้า (EV)", unit: "kWh" },
  ],
};

export default function MeetingForm({ onSubmit, adminActivities = [] }: MeetingFormProps) {
  const [meetingName, setMeetingName] = useState("");
  const [meetingType, setMeetingType] = useState("online");
  
  const [devicesCount, setDevicesCount] = useState("1");
  const [participantsCount, setParticipantsCount] = useState("1");
  const [durationHours, setDurationHours] = useState("1");
  const [electricityKwh, setElectricityKwh] = useState("0");

  const [vehicleType, setVehicleType] = useState("car");
  const [fuelType, setFuelType] = useState("gasohol_e10");
  const [distanceKm, setDistanceKm] = useState("0");
  const [trips, setTrips] = useState("1");

  const handleVehicleChange = (newVehicle: string) => {
    setVehicleType(newVehicle);
    const fuels = ONSITE_FUELS_MAP[newVehicle] || [];
    if (fuels.length > 0) {
      setFuelType(fuels[0].id);
    }
  };

  const currentFuels = ONSITE_FUELS_MAP[vehicleType] || [];
  const isEvSelected = vehicleType === "ev";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!meetingName.trim()) {
      alert("กรุณากรอกชื่อการประชุม");
      return;
    }

    // ค้นหา ef_id ที่ตรงกับประเภทการประชุมหรือเชื้อเพลิงจาก adminActivities (Master Data ใน DB)
    let matchedEfId: string | null = null;

    if (meetingType === "online") {
      const devices = Number(devicesCount);
      const hours = Number(durationHours);
      const kwh = Number(electricityKwh);

      if (devices <= 0 || hours <= 0) {
        alert("กรุณากรอกข้อมูลจำนวนอุปกรณ์และระยะเวลาให้ถูกต้อง");
        return;
      }

      // ค้นหาค่า EF ของไฟฟ้าหรือออนไลน์จากฐานข้อมูล
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
        participantsOrDevices: devices,
        durationHours: hours,
        electricityKwh: kwh > 0 ? kwh : undefined,
        ef_id: matchedEfId,
      });
    } else if (meetingType === "onsite") {
      const passengers = Number(participantsCount);
      const distance = Number(distanceKm);
      const tripCount = Number(trips);
      const kwh = Number(electricityKwh);

      if (passengers <= 0 || tripCount <= 0) {
        alert("กรุณากรอกจำนวนผู้เดินทางและจำนวนเที่ยวให้ถูกต้อง");
        return;
      }

      if (!isEvSelected && distance <= 0) {
        alert("กรุณาระบุระยะทางให้ถูกต้อง");
        return;
      }

      // ค้นหา ef_id ตามประเภทเชื้อเพลิงที่เลือกจากฐานข้อมูล
      const foundAct = adminActivities.find(a => 
        a.ef_name?.toLowerCase().includes(fuelType.toLowerCase()) ||
        a.sub_category?.toLowerCase().includes(fuelType.toLowerCase()) ||
        a.sub_category?.toLowerCase().includes(vehicleType.toLowerCase())
      );
      matchedEfId = foundAct ? foundAct.ef_id : (adminActivities[0]?.ef_id || null);

      onSubmit({
        meetingName: meetingName.trim(),
        meetingType: "onsite",
        participantsOrDevices: passengers,
        durationHours: Number(durationHours),
        vehicleType,
        fuelType,
        distanceKm: isEvSelected ? 0 : distance,
        electricityKwh: kwh > 0 ? kwh : undefined,
        trips: tripCount,
        ef_id: matchedEfId,
      });
    }

    alert("บันทึกข้อมูลการประชุมชั่วคราวแล้ว");
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4">
        <h2 className="text-base font-semibold text-gray-800">ข้อมูลการประชุม (Meeting)</h2>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
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

          {meetingType === "online" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">จำนวนอุปกรณ์ที่ใช้ประชุม (เครื่อง) *</label>
                  <input
                    type="number"
                    min="1"
                    value={devicesCount}
                    onChange={(e) => setDevicesCount(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">ระยะเวลา (ชั่วโมง) *</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  ปริมาณกระแสไฟฟ้าที่ใช้สำหรับอุปกรณ์ประชุม (kWh) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={electricityKwh}
                  onChange={(e) => setElectricityKwh(e.target.value)}
                  placeholder="ระบุหน่วย kWh"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                  required
                />
                <p className="text-[11px] text-gray-500 mt-1">*คำนวณร่วมกับ EF ไฟฟ้า (CFO Scope 2)</p>
              </div>
            </>
          )}

          {meetingType === "onsite" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    ปริมาณกระแสไฟฟ้าที่ใช้สำหรับสถานที่/อุปกรณ์ประชุม (kWh) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={electricityKwh}
                    onChange={(e) => setElectricityKwh(e.target.value)}
                    placeholder="ระบุหน่วย kWh"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                    required
                  />
                  <p className="text-[11px] text-gray-500 mt-1">*คำนวณร่วมกับ EF ไฟฟ้า (CFO Scope 2)</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">ระยะเวลา (ชั่วโมง) *</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">ประเภทยานพาหนะ *</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => handleVehicleChange(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#32885F]"
                  >
                    {ONSITE_VEHICLES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">ประเภทน้ำมัน / เชื้อเพลิง *</label>
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

              {!isEvSelected && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    ระยะทาง (กิโลเมตร) *
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">จำนวนเที่ยว *</label>
                  <input
                    type="number"
                    min="1"
                    value={trips}
                    onChange={(e) => setTrips(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">จำนวนผู้เดินทาง (คน) *</label>
                  <input
                    type="number"
                    min="1"
                    value={participantsCount}
                    onChange={(e) => setParticipantsCount(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                    required
                  />
                </div>
              </div>
            </>
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