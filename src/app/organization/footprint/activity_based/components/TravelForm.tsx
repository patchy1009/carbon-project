"use client";

import React, { useState, useEffect } from "react";

export type TravelData = {
  travelName: string;
  distanceKm: number;
  trips: number;
  passengers: number;
  activity_id?: string;
};

type TravelFormProps = {
  onSubmit: (data: TravelData) => void;
  adminActivities?: any[];
};

export default function TravelForm({ onSubmit, adminActivities = [] }: TravelFormProps) {
  // กรองเฉพาะรายการที่เกี่ยวข้องกับการเดินทาง
  const travelActivities = adminActivities.filter((item) => {
    const text = `${item.category_name || ""} ${item.sub_category || ""}`.toLowerCase();
    return (
      text.includes("เดินทาง") ||
      text.includes("รถยนต์") ||
      text.includes("รถตู้") ||
      text.includes("รถจักรยานยนต์") ||
      text.includes("รถประจำทาง") ||
      text.includes("travel") ||
      text.includes("car") ||
      text.includes("van") ||
      text.includes("bus")
    );
  });

  // ถ้าไม่มีการกรองที่ตรง ให้ใช้รายการทั้งหมดกันพลาด
  const availableActivities = travelActivities.length > 0 ? travelActivities : adminActivities;
  const defaultAct = availableActivities[0];

  const [travelName, setTravelName] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState(defaultAct?.activity_id || "");
  const [distanceKm, setDistanceKm] = useState("0");
  const [trips, setTrips] = useState("1");
  const [passengers, setPassengers] = useState("1");

  useEffect(() => {
    if (availableActivities.length > 0 && !selectedActivityId) {
      setSelectedActivityId(availableActivities[0].activity_id);
    }
  }, [availableActivities, selectedActivityId]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const distance = Number(distanceKm);
    const tripCount = Number(trips);
    const passengerCount = Number(passengers);

    if (!travelName.trim() || distance <= 0 || !selectedActivityId) {
      alert("กรุณากรอกข้อมูลการเดินทางให้ถูกต้อง");
      return;
    }

    onSubmit({
      travelName: travelName.trim(),
      distanceKm: distance,
      trips: tripCount,
      passengers: passengerCount,
      activity_id: selectedActivityId,
    });
    alert("บันทึกข้อมูลการเดินทางชั่วคราวแล้ว");
  };

  const activeAct = availableActivities.find((a) => a.activity_id === selectedActivityId);

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4">
        <h2 className="text-base font-semibold text-gray-800">ข้อมูลการเดินทาง (Travel)</h2>
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

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">ประเภทยานพาหนะ *</label>
            <select
              value={selectedActivityId}
              onChange={(e) => setSelectedActivityId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
            >
              {availableActivities.length === 0 ? (
                <option value="">ไม่พบข้อมูลประเภทยานพาหนะ</option>
              ) : (
                availableActivities.map((opt, idx) => (
                  <option key={`${opt.activity_id}-${idx}`} value={opt.activity_id}>
                    {opt.sub_category || opt.category_name} ({opt.unit || "กิโลเมตร"})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              ระยะทาง ({activeAct?.unit || "กิโลเมตร"}) *
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
                value={passengers}
                onChange={(e) => setPassengers(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
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