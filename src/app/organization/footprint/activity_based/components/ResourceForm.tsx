"use client";

import React, { useState } from "react";

export type ResourceData = {
  resourceName: string;
  amount: number;
  unit: string;
  activity_id?: string; // ปรับจาก categoryact_id เป็น activity_id
};

type ResourceFormProps = {
  onSubmit: (data: ResourceData[]) => void;
  adminActivities?: any[]; // รับข้อมูล Master Data จากแอดมิน
};

export default function ResourceForm({ onSubmit, adminActivities = [] }: ResourceFormProps) {
  // หากมีข้อมูลจากแอดมิน ให้ใช้รายการแรกเป็นค่าเริ่มต้น
  const defaultOption = adminActivities.length > 0 ? adminActivities[0] : null;

  const [resources, setResources] = useState<ResourceData[]>([
    { 
      resourceName: defaultOption ? defaultOption.sub_category : "ไฟฟ้า", 
      amount: 0, 
      unit: defaultOption ? defaultOption.unit || "-" : "kWh",
      activity_id: defaultOption ? defaultOption.activity_id : undefined
    },
  ]);

  const addResource = () => {
    const nextOption = adminActivities.length > 0 ? adminActivities[0] : null;
    setResources([
      ...resources,
      { 
        resourceName: nextOption ? nextOption.sub_category : "กระดาษ", 
        amount: 0, 
        unit: nextOption ? nextOption.unit || "-" : "kg",
        activity_id: nextOption ? nextOption.activity_id : undefined
      },
    ]);
  };

  const updateResource = (
    index: number,
    field: keyof ResourceData,
    value: string | number
  ) => {
    setResources((previous) =>
      previous.map((resource, i) =>
        i === index ? { ...resource, [field]: value } : resource
      )
    );
  };

  const removeResource = (index: number) => {
    setResources((previous) =>
      previous.filter((_, i) => i !== index)
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const hasInvalidData = resources.some(
      (resource) =>
        !Number.isFinite(resource.amount) ||
        resource.amount < 0 ||
        !resource.unit.trim() ||
        !resource.activity_id
    );

    if (resources.length === 0 || hasInvalidData) {
      alert("กรุณากรอกข้อมูลทรัพยากรและเลือกประเภทให้ถูกต้องครบถ้วน");
      return;
    }

    onSubmit(resources);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50/70 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="h-3 w-3 rounded-full bg-[#32885F]"></div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              ข้อมูลการใช้ทรัพยากร
            </h2>
            <p className="text-xs text-gray-500">
              ระบุทรัพยากรที่ใช้ในการจัดกิจกรรม (เชื่อมโยงกับฐานข้อมูลกลางของแอดมิน)
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {resources.map((resource, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-200 bg-gray-50/50 p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-medium text-gray-700">
                  ทรัพยากรรายการที่ {index + 1}
                </h3>

                {resources.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeResource(index)}
                    className="text-sm font-medium text-red-600 hover:text-red-800"
                  >
                    ลบรายการ
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    ประเภททรัพยากร <span className="text-red-500">*</span>
                  </label>

                  <select
                    value={resource.activity_id || ""}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const matchedOpt = adminActivities.find(
                        (opt) => opt.activity_id === selectedId
                      );

                      if (matchedOpt) {
                        setResources((previous) =>
                          previous.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  resourceName: matchedOpt.sub_category,
                                  unit: matchedOpt.unit || "-",
                                  activity_id: matchedOpt.activity_id,
                                }
                              : item
                          )
                        );
                      }
                    }}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
                  >
                    {adminActivities.length === 0 ? (
                      <option value="">กำลังโหลดรายการจากแอดมิน...</option>
                    ) : (
                      adminActivities.map((option) => (
                        <option key={option.activity_id} value={option.activity_id}>
                          {option.category_name} {option.sub_category ? `- ${option.sub_category}` : ""} ({option.unit || "-"})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    ปริมาณที่ใช้ <span className="text-red-500">*</span>
                  </label>

                  <div className="flex gap-3">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={resource.amount}
                      onChange={(e) =>
                        updateResource(
                          index,
                          "amount",
                          Number(e.target.value)
                        )
                      }
                      className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
                      required
                    />

                    <div className="flex min-w-20 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-600">
                      {resource.unit}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addResource}
            className="w-full rounded-xl border border-[#32885F] px-5 py-3 font-semibold text-[#32885F] transition hover:bg-green-50"
          >
            + เพิ่มทรัพยากร
          </button>

          <button
            type="submit"
            className="rounded-xl bg-[#32885F] px-6 py-3 font-semibold text-white transition hover:bg-[#286e4d]"
          >
            บันทึกข้อมูลทรัพยากร
          </button>
        </form>
      </div>
    </section>
  );
}