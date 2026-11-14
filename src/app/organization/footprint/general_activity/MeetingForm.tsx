"use client";
/*
 * ฟอร์มกรอกข้อมูล "การประชุม / อบรม / อีเวนต์" ของหน้ากิจกรรมทั่วไป (TOR ข้อ 9.1)
 *   - เลือกรูปแบบ ออนไลน์ หรือ ออนไซต์ (ออนไซต์จะมีส่วนการเดินทางเพิ่ม)
 *   - ใส่อุปกรณ์ไฟฟ้าได้หลายชุด (ชื่อ จำนวนเครื่อง ชั่วโมงใช้งาน กำลังไฟเป็นวัตต์)
 *   - พิมพ์ชื่อกิจกรรมเดิมหรือเลือกจากประวัติ เพื่อดึงข้อมูลเก่ามาแก้ไขหรือลบ (อ่านจากตาราง general_activity_meeting)
 * ฟอร์มนี้ไม่คำนวณเอง ทุกครั้งที่ผู้ใช้แก้ช่องใด จะส่งข้อมูลทั้งชุดขึ้นไปให้หน้า page.tsx ผ่าน onDataChange
 */

import { useState, useEffect, useRef } from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { showConfirm } from "@/lib/dialog"; // กล่องยืนยันของระบบ (แทน confirm ของเบราว์เซอร์)
import { supabase } from "@/lib/supabaseClient";
import { getErrorMessage } from "@/lib/errorMessage";
import { evKwhPerKmToPer100, evPer100ToKwhPerKm, VEHICLE_OPTIONS, FUEL_OPTIONS_MAP } from "./calculation";

// อุปกรณ์ 1 ชุด (electricityKwh = kWh ต่อชั่วโมง ต่อ 1 เครื่อง)
export type EquipmentSetInput = {
  equipmentName: string;
  devices: number;
  durationHours: number;
  electricityKwh: number;
};

// ข้อมูลที่ฟอร์มส่งขึ้นไปให้หน้า page.tsx
//   vehicleType / fuelType / distanceKm / trips มีเฉพาะประชุมออนไซต์
//   electricityKwh = kWh ต่อ กม. ของรถ EV (มีเฉพาะออนไซต์ที่ไปด้วย EV)
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

// อุปกรณ์ 1 ชุดในฟอร์ม (มี id ไว้ใช้เป็น key และอ้างอิงตอนแก้/ลบ)
type EquipmentRow = EquipmentSetInput & { id: string };

// 1 แถวของตาราง general_activity_meeting (ประวัติ) เฉพาะคอลัมน์ที่ฟอร์มนี้อ่าน
// 1 แถว = อุปกรณ์ 1 ชุด กิจกรรมเดียวกันจึงมีหลายแถวที่ activity_name เหมือนกัน
type PastMeetingRow = {
  activity_name: string | null;
  category_type: string | null;
  equipment_name: string | null;
  devices: number | string | null;
  hours: number | string | null;
  electricity_kwh: number | string | null;
  vehicle_type: string | null;
  fuel_type: string | null;
  distance: number | string | null;
  trips: number | string | null;
};

export type MeetingFormProps = {
  orgId: string;
  initialData?: MeetingData | null;
  onDataChange: (data: MeetingData | null) => void;
  fetchElectricityEF: () => { id: string | null; value: number };
  getEFDetail: (fuelKey: string) => { id: string | null; value: number };
  showRequired?: boolean; // true หลังกดคำนวณแล้วข้อมูลไม่ครบ: ช่องบังคับที่ว่างหรือใช้ไม่ได้จะมีกรอบสีแดง
};

const MEETING_TYPES = [
  { id: "online", label: "ประชุมออนไลน์ (Online)" },
  { id: "onsite", label: "ประชุมออนไซต์ อบรม และจัดกิจกรรม (Onsite)" },
];

// ในโค้ดเก็บกำลังไฟเป็น kWh ต่อชั่วโมง (ตรงกับคอลัมน์ electricity_kwh ในฐานข้อมูล) แต่ช่องกรอกแสดงเป็นวัตต์ (W) ตามป้ายบนอุปกรณ์
const toWatt = (kwhPerHour: number) => Math.round(kwhPerHour * 1000 * 1000) / 1000;

export default function MeetingForm({ orgId, initialData, onDataChange, fetchElectricityEF, getEFDetail, showRequired = false }: MeetingFormProps) {
  const [meetingName, setMeetingName] = useState("");
  const [actionError, setActionError] = useState(""); // ข้อความผิดพลาดตอนลบ แสดงในฟอร์ม (แทน popup)
  const [category_type, setCategoryType] = useState("online");
  const [pastMeetingsData, setPastMeetingsData] = useState<PastMeetingRow[]>([]);
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ค่าเริ่มต้น: คอมพิวเตอร์ 1 เครื่อง 2 ชั่วโมง 60 วัตต์ (0.06 kWh ต่อชั่วโมง)
  const defaultEquipmentSets: EquipmentRow[] = [
    { id: "1", equipmentName: "คอมพิวเตอร์ / อุปกรณ์สำนักงาน", devices: 1, durationHours: 2, electricityKwh: 0.06 }
  ];

  const [equipmentSets, setEquipmentSets] = useState<EquipmentRow[]>(defaultEquipmentSets);
  const [vehicleType, setVehicleType] = useState("car");
  const [fuelType, setFuelType] = useState(FUEL_OPTIONS_MAP["car"][0].id);
  const [distanceKm, setDistanceKm] = useState("10");
  const [trips, setTrips] = useState("1");
  const [evElectricityKwh, setEvElectricityKwh] = useState("0.165"); // เก็บเป็น kWh ต่อ กม. (หน่วยที่ใช้คำนวณ/บันทึก)
  const [evPer100Text, setEvPer100Text] = useState("16.5"); // ข้อความในช่องกรอก = kWh ต่อ 100 กม.

  // โหลดประวัติกิจกรรมของ "องค์กรนี้" จากตาราง general_activity_meeting (ใหม่สุดก่อน) ไว้แสดงใน dropdown
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

  // กรอบช่องกรอก: แดงเมื่อกดคำนวณแล้วข้อมูลไม่ครบ และช่องนี้ว่าง/ใช้ไม่ได้ (นับเฉพาะเมื่อตั้งชื่อกิจกรรมแล้ว เพราะไม่มีชื่อ = ไม่ใช้หมวดนี้)
  const fieldCls = (bad: boolean) =>
    showRequired && meetingName.trim() !== "" && bad ? "border-red-500 bg-red-50" : "border-gray-300 bg-white";

  // รวมค่าที่กรอกทั้งหมดเป็น MeetingData ส่งขึ้นไปให้หน้า page.tsx (ยังไม่ตั้งชื่อกิจกรรม = ส่ง null)
  // ประชุมออนไลน์และประชุมออนไซต์ที่ไปด้วย EV ใช้เชื้อเพลิง 'electricity' (ค่า EF ของไฟฟ้า)
  const emitChange = (
    name: string,
    catType: string,
    sets: EquipmentRow[],
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

    // ส่งค่าตามที่กรอกจริง ไม่เติมค่าแทนให้เอง ช่องที่ว่าง/เป็น 0 จะถูกตรวจและบอกผู้ใช้ตอนกดคำนวณ (inputRules.ts)
    const formattedSets: EquipmentSetInput[] = sets.map(item => ({
      equipmentName: item.equipmentName.trim(),
      devices: Number(item.devices),
      durationHours: Number(item.durationHours),
      electricityKwh: Number(item.electricityKwh),
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
      payload.trips = Number(tripCount);
      if (vType === "ev") {
        payload.electricityKwh = Number(evKwh);
      }
    }

    onDataChange(payload);
  };

  // ถ้าหน้าแม่ส่ง initialData มา ให้เติมค่าลงฟอร์ม
  useEffect(() => {
    if (initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- เติมค่าเริ่มต้นลงฟอร์มเมื่อหน้าแม่ส่งข้อมูลเดิมมา
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
          setEvPer100Text(evKwhPerKmToPer100(initialData.electricityKwh));
        }
      }
    }
  }, [initialData]);

  // พิมพ์ชื่อ หรือเลือกชื่อจากประวัติ: ถ้าชื่อตรงกับกิจกรรมเก่า ให้ดึงข้อมูลเก่ามาใส่ฟอร์ม (1 แถวในประวัติ = อุปกรณ์ 1 ชุด)
  const handleNameChange = (val: string) => {
    setMeetingName(val);

    const matchedRecords = pastMeetingsData.filter(item => item.activity_name === val);
    
    if (matchedRecords.length > 0) {
      const firstRecord = matchedRecords[0];
      const cType = firstRecord.category_type || "online";
      setCategoryType(cType);

      const loadedEquipmentSets: EquipmentRow[] = matchedRecords.map((record, index) => ({
        id: String(index + 1),
        equipmentName: record.equipment_name || "อุปกรณ์",
        devices: Number(record.devices || 1),
        durationHours: Number(record.hours || 2),
        electricityKwh: Number(record.electricity_kwh || 0.06),
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

  // ลบกิจกรรมนี้ (ทุกแถวที่ชื่อเดียวกัน) ออกจากฐานข้อมูลทันที หลังผู้ใช้กดยืนยัน
  const handleDeleteActivity = async () => {
    if (!meetingName.trim()) return;
    setActionError("");
    if (!(await showConfirm(`คุณต้องการลบกิจกรรม "${meetingName}" ออกจากระบบใช่หรือไม่?`, { danger: true }))) return;

    try {
      const { error } = await supabase
        .from("general_activity_meeting")
        .delete()
        .eq("org_id", orgId)
        .eq("activity_name", meetingName.trim());

      if (error) throw error;

      setPastMeetingsData(prev => prev.filter(item => item.activity_name !== meetingName.trim()));
      setMeetingName("");
      onDataChange(null);
    } catch (err) {
      console.error("Delete error:", err);
      setActionError(`ลบกิจกรรมไม่สำเร็จ: ${getErrorMessage(err)}`);
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

  // แก้ช่องใดช่องหนึ่งของอุปกรณ์ชุดที่ระบุ
  const handleEquipmentChange = (id: string, field: keyof EquipmentSetInput, value: string | number) => {
    const updated = equipmentSets.map(item => (item.id === id ? { ...item, [field]: value } : item));
    setEquipmentSets(updated);
    emitChange(meetingName, category_type, updated, vehicleType, fuelType, distanceKm, trips, evElectricityKwh);
  };

  // เพิ่มอุปกรณ์ชุดใหม่ (ค่าเริ่มต้น: 1 เครื่อง 1 ชั่วโมง 60 วัตต์)
  const handleAddEquipmentSet = () => {
    const updated = [
      ...equipmentSets,
      { id: Date.now().toString(), equipmentName: "", devices: 1, durationHours: 1, electricityKwh: 0.06 }
    ];
    setEquipmentSets(updated);
    emitChange(meetingName, category_type, updated, vehicleType, fuelType, distanceKm, trips, evElectricityKwh);
  };

  // ลบอุปกรณ์ชุดที่ระบุ (ต้องเหลืออย่างน้อย 1 ชุด)
  const handleRemoveEquipmentSet = (id: string) => {
    if (equipmentSets.length === 1) return; // ปุ่มลบของแถวสุดท้ายกดไม่ได้อยู่แล้ว (ต้องเหลืออย่างน้อย 1 ชุด)
    const updated = equipmentSets.filter(item => item.id !== id);
    setEquipmentSets(updated);
    emitChange(meetingName, category_type, updated, vehicleType, fuelType, distanceKm, trips, evElectricityKwh);
  };

  const currentFuels = FUEL_OPTIONS_MAP[vehicleType] || [];
  const isEvSelected = vehicleType === "ev";
  const uniqueMeetingNames = Array.from(new Set(pastMeetingsData.map(item => item.activity_name).filter((n): n is string => Boolean(n))));
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

      {actionError && (
        <div role="alert" className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

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
                <label className="mb-1 block text-[11px] font-medium text-gray-600">ชนิดอุปกรณ์ {index + 1} *</label>
                <input
                  type="text"
                  value={set.equipmentName}
                  onChange={(e) => handleEquipmentChange(set.id, "equipmentName", e.target.value)}
                  placeholder="เช่น คอมพิวเตอร์"
                  className={`w-full rounded-lg border ${fieldCls(!set.equipmentName.trim())} px-3 py-2 text-xs outline-none focus:border-[#32885F]`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-gray-600">จำนวน *</label>
                <input
                  type="number"
                  min="1"
                  value={set.devices}
                  onChange={(e) => handleEquipmentChange(set.id, "devices", Number(e.target.value))}
                  className={`w-full rounded-lg border ${fieldCls(!(Number.isInteger(set.devices) && set.devices >= 1))} px-3 py-2 text-xs outline-none focus:border-[#32885F]`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-gray-600">ชม.ใช้งาน *</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={set.durationHours}
                  onChange={(e) => handleEquipmentChange(set.id, "durationHours", Number(e.target.value))}
                  className={`w-full rounded-lg border ${fieldCls(!(set.durationHours > 0))} px-3 py-2 text-xs outline-none focus:border-[#32885F]`}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1 block text-[11px] font-medium text-gray-600" title="ดูได้จากป้ายที่อะแดปเตอร์หรือตัวเครื่อง เช่น โน้ตบุ๊กทั่วไปประมาณ 60 วัตต์">กำลังไฟ (วัตต์) *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={toWatt(set.electricityKwh)}
                  onChange={(e) => handleEquipmentChange(set.id, "electricityKwh", Number(e.target.value) / 1000)}
                  className={`w-full rounded-lg border ${fieldCls(!(set.electricityKwh > 0))} px-3 py-2 text-xs outline-none focus:border-[#32885F]`}
                />
              </div>
              <div className="sm:col-span-1 flex justify-end pb-0.5">
                <button
                  type="button"
                  onClick={() => handleRemoveEquipmentSet(set.id)}
                  disabled={equipmentSets.length <= 1}
                  title={equipmentSets.length <= 1 ? "ต้องมีอุปกรณ์อย่างน้อย 1 รายการ" : "ลบอุปกรณ์รายการนี้"}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
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
                    emitChange(meetingName, category_type, equipmentSets, vehicleType, fuelType, distanceKm, trips, perKm);
                  }}
                  className={`w-full rounded-xl border ${fieldCls(!(Number(evElectricityKwh) > 0))} px-3 py-2.5 text-sm outline-none focus:border-[#32885F]`}
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
                  className={`w-full rounded-xl border ${fieldCls(!(Number(distanceKm) > 0))} px-3 py-2.5 text-sm outline-none focus:border-[#32885F]`}
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
                  className={`w-full rounded-xl border ${fieldCls(!(Number.isInteger(Number(trips)) && Number(trips) >= 1))} px-3 py-2.5 text-sm outline-none focus:border-[#32885F]`}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}