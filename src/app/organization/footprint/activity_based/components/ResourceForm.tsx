"use client";

import React, { useState } from "react";

export type ResourceData = {
  resourceName: string;
  amount: number;
  unit: string;
};

type ResourceFormProps = {
  onSubmit: (data: ResourceData[]) => void;
};

const resourceOptions = [
  { value: "electricity", label: "ไฟฟ้า", unit: "kWh" },
  { value: "paper", label: "กระดาษ", unit: "kg" },
  { value: "water", label: "น้ำประปา", unit: "m³" },
  { value: "fuel", label: "เชื้อเพลิง", unit: "L" },
];

export default function ResourceForm({ onSubmit }: ResourceFormProps) {
  const [resources, setResources] = useState<ResourceData[]>([
    { resourceName: "electricity", amount: 0, unit: "kWh" },
  ]);

  const addResource = () => {
    setResources([
      ...resources,
      { resourceName: "paper", amount: 0, unit: "kg" },
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
        !resource.unit.trim()
    );

    if (resources.length === 0 || hasInvalidData) {
      alert("กรุณากรอกข้อมูลทรัพยากรให้ถูกต้อง");
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
              ระบุทรัพยากรที่ใช้ในการจัดกิจกรรมขององค์กร
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
                    value={resource.resourceName}
                    onChange={(e) => {
                      const selected = resourceOptions.find(
                        (option) => option.value === e.target.value
                      );

                      if (selected) {
                        setResources((previous) =>
                          previous.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  resourceName: selected.value,
                                  unit: selected.unit,
                                }
                              : item
                          )
                        );
                      }
                    }}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#32885F]"
                  >
                    {resourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
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