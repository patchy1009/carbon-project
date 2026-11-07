"use client";

import React, { useState } from "react";

export type ResourceData = {
  resourceName: string;
  amount: number;
  activity_id?: string;
};

type ResourceFormProps = {
  onSubmit: (data: ResourceData[]) => void;
  adminActivities?: any[];
};

export default function ResourceForm({ onSubmit, adminActivities = [] }: ResourceFormProps) {
  // กรองเฉพาะรายการที่เป็น กระดาษ, น้ำประปา, ไฟฟ้า, เชื้อเพลิง หรือพลังงานและทรัพยากร
  const resourceActivities = adminActivities.filter((item) => {
    const text = `${item.category_name || ""} ${item.sub_category || ""}`.toLowerCase();
    return (
      text.includes("กระดาษ") ||
      text.includes("น้ำ") ||
      text.includes("ไฟฟ้า") ||
      text.includes("เชื้อเพลิง") ||
      text.includes("ทรัพยากร") ||
      text.includes("พลังงาน") ||
      text.includes("paper") ||
      text.includes("water") ||
      text.includes("electricity") ||
      text.includes("fuel")
    );
  });

  const availableActivities = resourceActivities.length > 0 ? resourceActivities : adminActivities;
  const defaultOpt = availableActivities[0];

  const [resources, setResources] = useState<ResourceData[]>([
    {
      resourceName: defaultOpt ? defaultOpt.sub_category : "ไฟฟ้า",
      amount: 0,
      activity_id: defaultOpt ? defaultOpt.activity_id : undefined,
    },
  ]);

  const addResource = () => {
    setResources([
      ...resources,
      {
        resourceName: defaultOpt ? defaultOpt.sub_category : "ทรัพยากร",
        amount: 0,
        activity_id: defaultOpt ? defaultOpt.activity_id : undefined,
      },
    ]);
  };

  const updateResource = (index: number, field: keyof ResourceData, value: any) => {
    setResources(
      resources.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const removeResource = (index: number) => {
    setResources(resources.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (resources.length === 0 || resources.some(r => !r.activity_id)) {
      alert("กรุณากรอกข้อมูลและเลือกกิจกรรมทรัพยากรให้ถูกต้อง");
      return;
    }
    onSubmit(resources);
    alert("บันทึกข้อมูลทรัพยากรชั่วคราวแล้ว");
  };

  const currentAct = adminActivities.find(a => a.activity_id === resources[0]?.activity_id);
  const unit = currentAct?.unit || "-";

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4">
        <h2 className="text-base font-semibold text-gray-800">ข้อมูลพลังงานและทรัพยากร (Resources)</h2>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {resources.map((res, index) => (
            <div key={index} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">รายการที่ {index + 1}</span>
                {resources.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeResource(index)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    ลบรายการ
                  </button>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">ประเภททรัพยากร/พลังงาน *</label>
                <select
                  value={res.activity_id || ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    const matched = adminActivities.find(a => a.activity_id === id);
                    updateResource(index, "activity_id", id);
                    if (matched) updateResource(index, "resourceName", matched.sub_category || matched.category_name);
                  }}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                >
                  {availableActivities.length === 0 ? (
                    <option value="">ไม่พบข้อมูลทรัพยากรมาตรฐาน</option>
                  ) : (
                    availableActivities.map((opt, idx) => (
                      <option key={`${opt.activity_id}-${idx}`} value={opt.activity_id}>
                        {opt.sub_category || opt.category_name} ({opt.unit || "-"})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">ปริมาณที่ใช้ ({unit}) *</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={res.amount}
                  onChange={(e) => updateResource(index, "amount", Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#32885F]"
                  required
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addResource}
            className="w-full rounded-xl border-2 border-dashed border-[#32885F] py-2.5 text-xs font-semibold text-[#32885F] hover:bg-emerald-50"
          >
            + เพิ่มรายการทรัพยากร
          </button>

          <button
            type="submit"
            className="rounded-xl bg-[#32885F] px-6 py-2.5 font-semibold text-white text-sm transition hover:bg-[#286e4d]"
          >
            บันทึกข้อมูลทรัพยากร
          </button>
        </form>
      </div>
    </section>
  );
}