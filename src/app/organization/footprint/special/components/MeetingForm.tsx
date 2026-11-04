"use client";

import React, { useState } from "react";

export type MeetingData = {
  meetingType: "online" | "onsite";
  meetingName: string;
  participants: number;
  durationHours: number;
  electricityKwh: number;
};

type MeetingFormProps = {
  onSubmit: (data: MeetingData) => void;
};

export default function MeetingForm({ onSubmit }: MeetingFormProps) {
  const [meetingName, setMeetingName] = useState("");
  const [meetingType, setMeetingType] =
    useState<MeetingData["meetingType"]>("onsite");
  const [participants, setParticipants] = useState("1");
  const [durationHours, setDurationHours] = useState("1");
  const [electricityKwh, setElectricityKwh] = useState("0");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const participantCount = Number(participants);
    const duration = Number(durationHours);
    // ถ้าเป็น onsite ไม่ต้องใช้ kWh ให้ตั้งค่าเป็น 0
    const electricity = meetingType === "online" ? Number(electricityKwh) : 0;

    if (
      !meetingName.trim() ||
      !Number.isFinite(participantCount) ||
      participantCount <= 0 ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      (meetingType === "online" && (!Number.isFinite(electricity) || electricity < 0))
    ) {
      alert("กรุณากรอกข้อมูลให้ถูกต้อง");
      return;
    }

    onSubmit({
      meetingName: meetingName.trim(),
      meetingType,
      participants: participantCount,
      durationHours: duration,
      electricityKwh: electricity,
    });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* ส่วนหัวข้อการ์ดที่มีพื้นหลังสีเทาอ่อนและเส้นคั่น */}
      <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="h-3 w-3 rounded-full bg-[#32885F]"></div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              ข้อมูลการประชุม
            </h2>
            <p className="text-xs text-gray-500">
              กรอกข้อมูลการประชุมที่เกิดขึ้นจากกิจกรรมขององค์กร
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ชื่อการประชุม */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              ชื่อการประชุม <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={meetingName}
              onChange={(e) => setMeetingName(e.target.value)}
              placeholder="เช่น การประชุมสัมมนาประจำปี"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
              required
            />
          </div>

          {/* รูปแบบการประชุม (เฉพาะ Onsite และ Online) */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              รูปแบบการประชุม <span className="text-red-500">*</span>
            </label>
            <select
              value={meetingType}
              onChange={(e) =>
                setMeetingType(e.target.value as MeetingData["meetingType"])
              }
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
            >
              <option value="onsite">ประชุมที่สถานที่จริง (Onsite)</option>
              <option value="online">ประชุมออนไลน์ (Online)</option>
            </select>
          </div>

          {/* จำนวนผู้เข้าร่วม */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              จำนวนผู้เข้าร่วม (คน) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
              required
            />
          </div>

          {/* ระยะเวลาประชุม */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              ระยะเวลาประชุม (ชั่วโมง) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
              required
            />
          </div>

          {/* ปริมาณไฟฟ้า (แสดงเฉพาะกรณีที่เป็น Online) */}
          {meetingType === "online" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                ปริมาณไฟฟ้าที่ใช้ประมาณการ (kWh) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={electricityKwh}
                onChange={(e) => setElectricityKwh(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
                required
              />
              <p className="mt-1 text-xs text-gray-400">
                หากไม่มีข้อมูล สามารถกรอก 0 ได้
              </p>
            </div>
          )}

          <button
            type="submit"
            className="rounded-xl bg-[#32885F] px-6 py-3 font-semibold text-white transition hover:bg-[#286e4d]"
          >
            บันทึกข้อมูลการประชุม
          </button>
        </form>
      </div>
    </section>
  );
}