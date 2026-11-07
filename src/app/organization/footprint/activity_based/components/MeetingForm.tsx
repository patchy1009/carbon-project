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
  const meetingActivities = adminActivities.filter((item) => {
    const cat = item.category_name?.toLowerCase() || "";
    return cat.includes("ประชุม") || cat.includes("meeting");
  });

  const defaultAct = meetingActivities[0];

  const [meetingName, setMeetingName] = useState("");
  const [participants, setParticipants] = useState("1");
  const [durationHours, setDurationHours] = useState("1");
  const [selectedActivityId, setSelectedActivityId] = useState(defaultAct?.activity_id || "");

  useEffect(() => {
    if (meetingActivities.length > 0 && !selectedActivityId) {
      setSelectedActivityId(meetingActivities[0].activity_id);
    }
  }, [meetingActivities, selectedActivityId]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const people = Number(participants);
    const hours = Number(durationHours);

    if (!meetingName.trim() || people <= 0 || hours <= 0 || !selectedActivityId) {
      alert("กรุณากรอกข้อมูลการประชุมให้ถูกต้อง");
      return;
    }

    onSubmit({
      meetingName: meetingName.trim(),
      participants: people,
      durationHours: hours,
      activity_id: selectedActivityId,
    });
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
              placeholder="เช่น การประชุมประจำเดือน"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">รูปแบบการประชุม *</label>
            <select
              value={selectedActivityId}
              onChange={(e) => setSelectedActivityId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
            >
              {meetingActivities.length === 0 ? (
                <option value="">ไม่พบข้อมูลกิจกรรมการประชุมมาตรฐาน</option>
              ) : (
                meetingActivities.map((opt) => (
                  <option key={opt.activity_id} value={opt.activity_id}>
                    {opt.sub_category} ({opt.unit || "ชั่วโมง"})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">จำนวนผู้เข้าร่วม (คน) *</label>
              <input
                type="number"
                min="1"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
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