"use client";

import React, { useState, useEffect } from "react";

export type MeetingData = {
  meetingName: string;
  participants: number;
  durationHours: number;
  activity_id?: string;
};

type MeetingFormProps = {
  onSubmit: (data: MeetingData) => void;
  adminActivities?: any[];
};

export default function MeetingForm({ onSubmit, adminActivities = [] }: MeetingFormProps) {
  // กรองเฉพาะรายการที่เกี่ยวข้องกับการประชุม (รองรับทั้งภาษาไทยและอังกฤษ)
  const meetingActivities = adminActivities.filter((item) => {
    const catName = item.category_name?.toLowerCase() || "";
    const subCat = item.sub_category?.toLowerCase() || "";
    return (
      catName.includes("meeting") ||
      catName.includes("ประชุม") ||
      subCat.includes("onsite") ||
      subCat.includes("online")
    );
  });

  // ถ้ากรองแล้วไม่เจอ แต่มีข้อมูลส่งมาจากแอดมิน ให้แสดงทั้งหมดเพื่อกันเคสชื่อหมวดหมู่ไม่ตรงกับคีย์เวิร์ด
  const optionsToRender = meetingActivities.length > 0 ? meetingActivities : adminActivities;
  
  // ใช้ activity_id ตามตารางใหม่ activity_based
  const defaultAct = optionsToRender[0];

  const [meetingName, setMeetingName] = useState("");
  const [participants, setParticipants] = useState("1");
  const [durationHours, setDurationHours] = useState("1");
  const [selectedActivityId, setSelectedActivityId] = useState(defaultAct?.activity_id || "");

  useEffect(() => {
    if (optionsToRender.length > 0 && !selectedActivityId) {
      setSelectedActivityId(optionsToRender[0].activity_id);
    }
  }, [optionsToRender, selectedActivityId]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const people = Number(participants);
    const hours = Number(durationHours);

    if (!meetingName.trim() || people <= 0 || hours <= 0) {
      alert("กรุณากรอกข้อมูลการประชุมให้ถูกต้อง");
      return;
    }

    onSubmit({
      meetingName: meetingName.trim(),
      participants: people,
      durationHours: hours,
      activity_id: selectedActivityId,
    });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="h-3 w-3 rounded-full bg-[#32885F]"></div>
          <h2 className="text-base font-semibold text-gray-800">ข้อมูลการประชุม</h2>
        </div>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">ชื่อการประชุม *</label>
            <input
              type="text"
              value={meetingName}
              onChange={(e) => setMeetingName(e.target.value)}
              placeholder="เช่น การประชุมประจำเดือน"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">ประเภทการประชุม (จากระบบแอดมิน) *</label>
            <select
              value={selectedActivityId}
              onChange={(e) => setSelectedActivityId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
            >
              {optionsToRender.length === 0 ? (
                <option value="">ไม่มีข้อมูลประเภทการประชุมจากแอดมิน</option>
              ) : (
                optionsToRender.map((option) => (
                  <option key={option.activity_id} value={option.activity_id}>
                    {option.category_name} {option.sub_category ? `- ${option.sub_category}` : ""} ({option.unit || "hours"})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">จำนวนผู้เข้าร่วม (คน) *</label>
              <input
                type="number"
                min="1"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">ระยะเวลา (ชั่วโมง) *</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
                required
              />
            </div>
          </div>

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