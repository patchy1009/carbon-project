"use client";

import React, { useState, useEffect } from "react";

export type TravelData = {
  travelName: string;
  transportType: string;
  distanceKm: number;
  trips: number;
  passengers: number;
  activity_id?: string; // ปรับจาก categoryact_id เป็น activity_id
};

type TravelFormProps = {
  onSubmit: (data: TravelData) => void;
  adminActivities?: any[]; // รับรายการกิจกรรมที่แอดมินสร้างไว้จากฐานข้อมูล
};

export default function TravelForm({ onSubmit, adminActivities = [] }: TravelFormProps) {
  // กรองเฉพาะรายการที่แอดมินตั้งค่าไว้ในหมวดการเดินทาง
  const travelActivities = adminActivities.filter((item) => {
    const catName = item.category_name?.toLowerCase() || "";
    const subCat = item.sub_category?.toLowerCase() || "";
    return (
      catName.includes("travel") ||
      catName.includes("เดินทาง") ||
      subCat.includes("car") ||
      subCat.includes("van") ||
      subCat.includes("bus") ||
      subCat.includes("รถ")
    );
  });

  const optionsToRender = travelActivities.length > 0 ? travelActivities : adminActivities;
  const defaultAct = optionsToRender[0];

  const [travelName, setTravelName] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState(defaultAct?.activity_id || "");
  const [transportType, setTransportType] = useState(defaultAct?.sub_category || "");
  const [distanceKm, setDistanceKm] = useState("0");
  const [trips, setTrips] = useState("1");
  const [passengers, setPassengers] = useState("1");

  useEffect(() => {
    if (optionsToRender.length > 0 && !selectedActivityId) {
      setSelectedActivityId(optionsToRender[0].activity_id);
      setTransportType(optionsToRender[0].sub_category);
    }
  }, [optionsToRender, selectedActivityId]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const distance = Number(distanceKm);
    const tripCount = Number(trips);
    const passengerCount = Number(passengers);

    if (
      !travelName.trim() ||
      !Number.isFinite(distance) ||
      distance <= 0 ||
      !Number.isFinite(tripCount) ||
      tripCount <= 0 ||
      !Number.isFinite(passengerCount) ||
      passengerCount <= 0 ||
      !selectedActivityId
    ) {
      alert("กรุณากรอกข้อมูลการเดินทางและเลือกประเภทให้ถูกต้อง");
      return;
    }

    onSubmit({
      travelName: travelName.trim(),
      transportType,
      distanceKm: distance,
      trips: tripCount,
      passengers: passengerCount,
      activity_id: selectedActivityId,
    });
  };

  const activeActivity = adminActivities.find((a) => a.activity_id === selectedActivityId);

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="h-3 w-3 rounded-full bg-[#32885F]"></div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              ข้อมูลการเดินทาง
            </h2>
            <p className="text-xs text-gray-500">
              เลือกประเภทการเดินทางจากรายการที่แอดมินกำหนดไว้ในระบบ
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              รายละเอียดการเดินทาง <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={travelName}
              onChange={(e) => setTravelName(e.target.value)}
              placeholder="เช่น การเดินทางเข้าร่วมสัมมนา"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              ประเภทการเดินทาง (จากระบบแอดมิน) <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedActivityId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedActivityId(id);
                const found = adminActivities.find((item) => item.activity_id === id);
                if (found) {
                  setTransportType(found.sub_category);
                }
              }}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
            >
              {optionsToRender.length === 0 ? (
                <option value="">ไม่มีข้อมูลประเภทการเดินทางจากแอดมิน</option>
              ) : (
                optionsToRender.map((option) => (
                  <option key={option.activity_id} value={option.activity_id}>
                    {option.category_name} {option.sub_category ? `- ${option.sub_category}` : ""} ({option.unit || "km"})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              ระยะทาง ({activeActivity?.unit || "กิโลเมตร"}) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                จำนวนเที่ยว <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={trips}
                onChange={(e) => setTrips(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                จำนวนผู้เดินทาง (คน) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={passengers}
                onChange={(e) => setPassengers(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-xl bg-[#32885F] px-6 py-3 font-semibold text-white transition hover:bg-[#286e4d]"
          >
            บันทึกข้อมูลการเดินทาง
          </button>
        </form>
      </div>
    </section>
  );
}