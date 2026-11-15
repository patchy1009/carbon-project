"use client";
/*
 * ฟอร์มกรอกข้อมูล "การเดินทาง" ของหน้ากิจกรรมทั่วไป (TOR ข้อ 9.1)
 *   - เลือกชนิดรถและเชื้อเพลิง กรอกระยะทางและจำนวนเที่ยว (รถ EV กรอกอัตราสิ้นเปลืองไฟฟ้า kWh ต่อ 100 กม. เพิ่ม)
 *   - พิมพ์ชื่อการเดินทางเดิมหรือเลือกจากประวัติ เพื่อดึงข้อมูลเก่ามาแก้ไขหรือลบ (อ่านจากตาราง general_activity_traveling)
 * ฟอร์มนี้ไม่คำนวณเอง ทุกครั้งที่ผู้ใช้แก้ช่องใด จะส่งข้อมูลทั้งชุดขึ้นไปให้หน้า page.tsx ผ่าน onDataChange
 */

import React, { useState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getErrorMessage } from "@/lib/errorMessage";
import { evKwhPerKmToPer100, evPer100ToKwhPerKm, VEHICLE_OPTIONS, FUEL_OPTIONS_MAP } from "./calculation";

// ข้อมูลที่ฟอร์มส่งขึ้นไปให้หน้า page.tsx
//   electricityKwh = kWh ต่อ กม. มีเฉพาะรถ EV
export type TravelData = {
  travel_name: string;
  vehicleType: string;
  fuelType?: string;
  distanceKm: number;
  trips: number;
  electricityKwh?: number;
  ef_id?: string | null;
};

export type TravelFormProps = {
  orgId: string;
  initialData?: TravelData | null;
  onDataChange: (data: TravelData | null) => void;
  getEFDetail: (fuelKey: string) => { id: string | null; value: number };
};

// 1 แถวของตาราง general_activity_traveling (ประวัติ) เฉพาะคอลัมน์ที่ฟอร์มนี้อ่าน
type PastTravelRow = {
  activity_name: string | null;
  vehicle_type: string | null;
  fuel_type: string | null;
  distance: number | string | null;
  trips: number | string | null;
  electricity_kwh: number | string | null;
};

export default function TravelForm({ orgId, initialData, onDataChange, getEFDetail }: TravelFormProps) {
  const [travelName, setTravelName] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [fuelType, setFuelType] = useState(FUEL_OPTIONS_MAP["car"][0].id);
  const [distanceKm, setDistanceKm] = useState("20");
  const [trips, setTrips] = useState("1");
  const [evElectricityKwh, setEvElectricityKwh] = useState("0.165"); // เก็บเป็น kWh ต่อ กม. (หน่วยที่ใช้คำนวณ/บันทึก)
  const [evPer100Text, setEvPer100Text] = useState("16.5"); // ข้อความในช่องกรอก = kWh ต่อ 100 กม.
  const [pastTravelsData, setPastTravelsData] = useState<PastTravelRow[]>([]);
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // โหลดประวัติการเดินทางของ "องค์กรนี้" จากตาราง general_activity_traveling (ใหม่สุดก่อน) ไว้แสดงใน dropdown
  useEffect(() => {
    async function fetchPastData() {
      if (!orgId) return;
      const { data, error } = await supabase
        .from("general_activity_traveling")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      
      if (data && !error) {
        setPastTravelsData(data);
      }
    }
    fetchPastData();
  }, [orgId]);

  // คลิกนอกกล่อง dropdown ประวัติ -> ปิดกล่อง
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpenDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // รวมค่าที่กรอกทั้งหมดเป็น TravelData ส่งขึ้นไปให้หน้า page.tsx (ยังไม่ตั้งชื่อการเดินทาง = ส่ง null)
  // รถ EV ใช้เชื้อเพลิง 'electricity' (ค่า EF ของไฟฟ้า)
  const emitChange = (name: string, vType: string, fType: string, dist: string, tripCount: string, evKwh: string) => {
    if (!name.trim()) {
      onDataChange(null);
      return;
    }

    const isEv = vType === "ev";
    const rawFuel = isEv ? "electricity" : fType;
    const efObj = getEFDetail(rawFuel);

    const payload: TravelData = {
      travel_name: name.trim(),
      vehicleType: vType,
      fuelType: rawFuel,
      distanceKm: Number(dist) || 0,
      trips: Number(tripCount) || 1,
      ef_id: efObj.id,
    };

    if (isEv) {
      payload.electricityKwh = Number(evKwh) || 0.165;
    }

    onDataChange(payload);
  };

  // ถ้าหน้าแม่ส่ง initialData มา ให้เติมค่าลงฟอร์ม
  useEffect(() => {
    if (initialData) {
      setTravelName(initialData.travel_name || "");
      setVehicleType(initialData.vehicleType || "car");
      setFuelType(initialData.fuelType || "gasohol_e10");
      setDistanceKm(String(initialData.distanceKm || 20));
      setTrips(String(initialData.trips || 1));
      if (initialData.electricityKwh) {
        setEvElectricityKwh(String(initialData.electricityKwh));
        setEvPer100Text(evKwhPerKmToPer100(initialData.electricityKwh));
      }
    }
  }, [initialData]);

  // พิมพ์ชื่อ หรือเลือกชื่อจากประวัติ: ถ้าชื่อตรงกับการเดินทางเก่า ให้ดึงข้อมูลเก่ามาใส่ฟอร์ม
  const handleNameChange = (val: string) => {
    setTravelName(val);

    const foundRecord = pastTravelsData.find(item => item.activity_name === val);
    if (foundRecord) {
      const vType = foundRecord.vehicle_type || "car";
      const fType = foundRecord.fuel_type || "gasohol_e10";
      const dist = String(foundRecord.distance || 20);
      const tripCount = String(foundRecord.trips || 1);
      const evKwhVal = String(foundRecord.electricity_kwh || "0.165");

      setVehicleType(vType);
      setFuelType(fType);
      setDistanceKm(dist);
      setTrips(tripCount);
      if (vType === "ev") {
        setEvElectricityKwh(evKwhVal);
        setEvPer100Text(evKwhPerKmToPer100(evKwhVal));
      }

      emitChange(val, vType, fType, dist, tripCount, evKwhVal);
    } else {
      emitChange(val, vehicleType, fuelType, distanceKm, trips, evElectricityKwh);
    }
  };

  // ลบการเดินทางนี้ออกจากฐานข้อมูลทันที หลังผู้ใช้กดยืนยัน
  const handleDeleteTravel = async () => {
    if (!travelName.trim()) return;
    if (!confirm(`คุณต้องการลบการเดินทาง "${travelName}" ออกจากระบบใช่หรือไม่?`)) return;

    try {
      const { error } = await supabase
        .from("general_activity_traveling")
        .delete()
        .eq("org_id", orgId)
        .eq("activity_name", travelName.trim());

      if (error) throw error;

      alert("ลบการเดินทางออกจากระบบเรียบร้อยแล้ว");
      setPastTravelsData(prev => prev.filter(item => item.activity_name !== travelName.trim()));
      setTravelName("");
      onDataChange(null);
    } catch (err) {
      console.error("Delete error:", err);
      alert(`เกิดข้อผิดพลาดในการลบ: ${getErrorMessage(err)}`);
    }
  };

  // เปลี่ยนชนิดรถ: เปลี่ยนเชื้อเพลิงเป็นตัวแรกของรถชนิดนั้นด้วย (เชื้อเพลิงเดิมอาจใช้กับรถชนิดใหม่ไม่ได้)
  const handleVehicleChange = (newVehicle: string) => {
    setVehicleType(newVehicle);
    const fuels = FUEL_OPTIONS_MAP[newVehicle] || [];
    const newFuel = fuels.length > 0 ? fuels[0].id : "gasohol_e10";
    setFuelType(newFuel);
    emitChange(travelName, newVehicle, newFuel, distanceKm, trips, evElectricityKwh);
  };

  const currentFuels = FUEL_OPTIONS_MAP[vehicleType] || [];
  const isEvSelected = vehicleType === "ev";
  const uniqueTravelNames = Array.from(new Set(pastTravelsData.map(item => item.activity_name).filter((n): n is string => Boolean(n))));
  const isExistingTravel = uniqueTravelNames.includes(travelName.trim());

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">ข้อมูลการเดินทาง (Traveling)</h2>
        <div className="flex items-center gap-3">
          {isExistingTravel && (
            <button
              type="button"
              onClick={handleDeleteTravel}
              className="text-xs text-red-600 hover:underline font-semibold flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> ลบการเดินทางนี้
            </button>
          )}
          {travelName && (
            <button
              type="button"
              onClick={() => { setTravelName(""); onDataChange(null); }}
              className="text-xs text-gray-500 hover:underline font-medium"
            >
              ล้างฟอร์ม
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="relative" ref={dropdownRef}>
          <label className="mb-1 block text-xs font-medium text-gray-700">ชื่อการเดินทาง / ภารกิจ *</label>
          <div className="relative flex items-center">
            <input
              type="text"
              value={travelName}
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

          {isOpenDropdown && uniqueTravelNames.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
              <div className="sticky top-0 bg-gray-50 px-3 py-2 text-[11px] font-semibold text-gray-500 border-b border-gray-100">
                ประวัติการเดินทางเก่า (คลิกเพื่อดึงข้อมูลมาแสดงครบถ้วน)
              </div>
              {uniqueTravelNames.map((name, idx) => (
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
                emitChange(travelName, vehicleType, e.target.value, distanceKm, trips, evElectricityKwh);
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
            <label className="mb-1 block text-xs font-medium text-gray-700">อัตราสิ้นเปลืองไฟฟ้า (kWh ต่อ 100 กม.) *</label>
            <p className="mb-1 text-[11px] text-gray-500">ไม่ทราบใช้ค่าเริ่มต้นได้ ถ้าทราบดูจากคู่มือหรือสเปกรถ ซึ่งเขียนเป็น kWh/100 กม. (รถ EV ทั่วไปประมาณ 15 – 22)</p>
            <input
              type="number"
              min="1"
              step="0.1"
              value={evPer100Text}
              onChange={(e) => {
                setEvPer100Text(e.target.value);
                const perKm = evPer100ToKwhPerKm(e.target.value);
                setEvElectricityKwh(perKm);
                emitChange(travelName, vehicleType, fuelType, distanceKm, trips, perKm);
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
                emitChange(travelName, vehicleType, fuelType, e.target.value, trips, evElectricityKwh);
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
                emitChange(travelName, vehicleType, fuelType, distanceKm, e.target.value, evElectricityKwh);
              }}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}