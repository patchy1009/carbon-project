"use client";

import React, { useState } from "react";

export type TravelData = {
  travelName: string;
  transportType: string;
  distanceKm: number;
  trips: number;
  passengers: number;
};

type TravelFormProps = {
  onSubmit: (data: TravelData) => void;
};

const transportOptions = [
  { value: "car", label: "รถยนต์ส่วนบุคคล" },
  { value: "van", label: "รถตู้" },
  { value: "bus", label: "รถโดยสารประจำทาง" }
];

export default function TravelForm({ onSubmit }: TravelFormProps) {
  const [travelName, setTravelName] = useState("");
  const [transportType, setTransportType] = useState("car");
  const [distanceKm, setDistanceKm] = useState("0");
  const [trips, setTrips] = useState("1");
  const [passengers, setPassengers] = useState("1");

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
      passengerCount <= 0
    ) {
      alert("กรุณากรอกข้อมูลการเดินทางให้ถูกต้อง");
      return;
    }

    onSubmit({
      travelName: travelName.trim(),
      transportType,
      distanceKm: distance,
      trips: tripCount,
      passengers: passengerCount,
    });
  };

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
              กรอกข้อมูลการเดินทางที่เกิดขึ้นจากการจัดกิจกรรมขององค์กร
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
              ประเภทการเดินทาง <span className="text-red-500">*</span>
            </label>
            <select
              value={transportType}
              onChange={(e) => setTransportType(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
            >
              {transportOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              ระยะทาง (กิโลเมตร) <span className="text-red-500">*</span>
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
            <p className="mt-1 text-xs text-gray-400">
              ระบุระยะทางต่อเที่ยวต่อคน
            </p>
          </div>

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
            <p className="mt-1 text-xs text-gray-400">
              เช่น ไป 1 เที่ยว และกลับ 1 เที่ยว ให้นับเป็น 2 เที่ยว
            </p>
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