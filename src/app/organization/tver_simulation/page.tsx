"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Save,
} from "lucide-react";

type ProjectForm = {
  projectName: string;
  treeType: string;
  area: string;
  treesPerRai: string;
  startDate: string;
};

type CreditRecord = {
  id: string;
  name: string;
  amount: number;
};

type MessageType = "success" | "error" | "";

const treeOptions = [
  "สัก (Tectona grandis)",
  "ยูคาลิปตัส (Eucalyptus)",
  "โกงกาง (Rhizophora)",
  "ประดู่ (Pterocarpus macrocarpus)",
];

const creditRecords: CreditRecord[] = [
  {
    id: "FP-2024-001",
    name: "การดำเนินงานไตรมาส 1 ปี 2024",
    amount: 6900,
  },
  {
    id: "FP-2024-002",
    name: "การดำเนินงานไตรมาส 2 ปี 2024",
    amount: 6030,
  },
  {
    id: "FP-2024-003",
    name: "การดำเนินงานไตรมาส 3 ปี 2024",
    amount: 6500,
  },
];

const formatNumber = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 2,
  }).format(value);

export default function TVERSimulationPage() {
  const [step, setStep] = useState<1 | 2>(1);

  const [project, setProject] = useState<ProjectForm>({
    projectName: "โครงการปลูกป่าสัก ที่ราบสูงตอนเหนือ",
    treeType: treeOptions[0],
    area: "500",
    treesPerRai: "125",
    startDate: "2024-01-01",
  });

  const [goal, setGoal] = useState<"netzero" | "neutral" | "selling">(
    "neutral"
  );

  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [calculated, setCalculated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("");

  const area = Math.max(0, Number(project.area) || 0);
  const treesPerRai = Math.max(0, Number(project.treesPerRai) || 0);
  const totalTrees = area * treesPerRai;

  // ค่าตัวอย่างสำหรับทดลอง UI เท่านั้น
  // ไม่ใช่สูตรคำนวณ T-VER ที่ได้รับการรับรองอย่างเป็นทางการ
  const yearlyCredits = useMemo(() => {
    const factors: Record<string, number> = {
      [treeOptions[0]]: 2.5,
      [treeOptions[1]]: 2.95,
      [treeOptions[2]]: 3.45,
      [treeOptions[3]]: 2.8,
      [treeOptions[4]]: 2.4,
    };

    const factor = factors[project.treeType] ?? 2.5;

    return [1, 2, 3].map((year) =>
      Math.round(totalTrees * factor * (1 + (year - 1) * 0.18))
    );
  }, [project.treeType, totalTrees]);

  const totalCredits = yearlyCredits.reduce((sum, value) => sum + value, 0);

  const allocationRatio = {
    netzero: { offset: 100, sell: 0 },
    neutral: { offset: 50, sell: 50 },
    selling: { offset: 20, sell: 80 },
  }[goal];

  const creditsForOffset = totalCredits * (allocationRatio.offset / 100);
  const creditsForSale = totalCredits * (allocationRatio.sell / 100);

  const selectedTotal = creditRecords
    .filter((record) => selectedRecords.includes(record.id))
    .reduce((sum, record) => sum + record.amount, 0);

  const maxCredit = Math.max(...yearlyCredits, 1);

  const cumulativeCredits = yearlyCredits.map((_, index) =>
    yearlyCredits
      .slice(0, index + 1)
      .reduce((sum, value) => sum + value, 0)
  );

  const showMessage = (text: string, type: MessageType) => {
    setMessage(text);
    setMessageType(type);
  };

  const clearMessage = () => {
    setMessage("");
    setMessageType("");
  };

  const updateProject = (field: keyof ProjectForm, value: string) => {
    setProject((previous) => ({
      ...previous,
      [field]: value,
    }));

    // เปลี่ยนข้อมูลแล้วต้องคำนวณใหม่
    setCalculated(false);
    setSaved(false);
    setSelectedRecords([]);
    clearMessage();
  };

  const toggleRecord = (id: string) => {
    setSelectedRecords((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );

    setSaved(false);
    clearMessage();
  };

  const handleCalculate = () => {
    clearMessage();
    setCalculated(false);
    setSaved(false);

    if (!project.projectName.trim()) {
      showMessage("กรุณากรอกชื่อโครงการ", "error");
      return;
    }

    if (
      project.area.trim() === "" ||
      project.treesPerRai.trim() === "" ||
      !Number.isFinite(Number(project.area)) ||
      !Number.isFinite(Number(project.treesPerRai)) ||
      area <= 0 ||
      treesPerRai <= 0
    ) {
      showMessage(
        "กรุณากรอกพื้นที่และจำนวนต้นไม้ต่อไร่ให้มากกว่า 0",
        "error"
      );
      return;
    }

    if (!project.startDate) {
      showMessage("กรุณาเลือกวันที่เริ่มโครงการ", "error");
      return;
    }

    setCalculated(true);
    showMessage("คำนวณประมาณการเรียบร้อยแล้ว", "success");
  };

  const handleSave = () => {
    clearMessage();

    if (!calculated) {
      showMessage("กรุณาคำนวณโครงการก่อนจัดสรรเครดิต", "error");
      return;
    }

    if (selectedRecords.length === 0) {
      setSaved(false);
      showMessage("กรุณาเลือกรายการปล่อยก๊าซอย่างน้อย 1 รายการ", "error");
      return;
    }

    setSaved(true);
    showMessage(
      "จัดสรรเครดิตเรียบร้อยแล้ว แต่ข้อมูลยังไม่ได้บันทึกลงฐานข้อมูล",
      "success"
    );
  };

  const messageClass =
    messageType === "success" ? "text-emerald-700" : "text-red-600";

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        {/* หัวข้อ */}
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              จำลองโครงการ T-VER
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              การจำลองโครงการปลูกป่าและการจัดสรรคาร์บอนเครดิต
            </p>
          </div>

          {step === 2 && calculated && (
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
            >
              <Save size={16} />
              ยืนยันการจัดสรร
            </button>
          )}
        </div>

        {/* ขั้นตอน */}
        <div className="mb-8 flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              setStep(1);
              clearMessage();
            }}
            className="flex items-center gap-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 font-semibold text-white">
              {step === 2 ? <Check size={16} /> : "1"}
            </span>
            <span
              className={
                step === 1
                  ? "font-semibold text-gray-800"
                  : "text-gray-500"
              }
            >
              จำลองโครงการ
            </span>
          </button>

          <div className="h-px w-12 bg-gray-300" />

          <button
            type="button"
            onClick={() => {
              if (calculated) {
                setStep(2);
                clearMessage();
              } else {
                showMessage(
                  "กรุณากรอกข้อมูลและคำนวณโครงการก่อน",
                  "error"
                );
              }
            }}
            className="flex items-center gap-2"
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full font-semibold ${
                step === 2
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              2
            </span>
            <span
              className={
                step === 2
                  ? "font-semibold text-gray-800"
                  : "text-gray-400"
              }
            >
              จัดสรรเครดิตและรายงาน
            </span>
          </button>
        </div>

        {/* ขั้นตอนที่ 1 */}
        {step === 1 && (
          <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[0.82fr_1.18fr]">
            {/* ฟอร์มโครงการ */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
              <h2 className="mb-6 text-lg font-bold text-gray-800">
                ตั้งค่าโครงการปลูกป่า
              </h2>

              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="projectName"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    ชื่อโครงการ
                  </label>
                  <input
                    id="projectName"
                    value={project.projectName}
                    onChange={(e) =>
                      updateProject("projectName", e.target.value)
                    }
                    placeholder="กรอกชื่อโครงการ"
                    className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="treeType"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    พันธุ์ไม้
                  </label>
                  <div className="relative">
                    <select
                      id="treeType"
                      value={project.treeType}
                      onChange={(e) =>
                        updateProject("treeType", e.target.value)
                      }
                      className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-3 pr-10 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      {treeOptions.map((tree) => (
                        <option key={tree} value={tree}>
                          {tree}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={18}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="area"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      พื้นที่ปลูก (ไร่)
                    </label>
                    <input
                      id="area"
                      type="number"
                      min="0"
                      value={project.area}
                      onChange={(e) =>
                        updateProject("area", e.target.value)
                      }
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="treesPerRai"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      จำนวนต้นไม้ต่อไร่
                    </label>
                    <input
                      id="treesPerRai"
                      type="number"
                      min="1"
                      value={project.treesPerRai}
                      onChange={(e) =>
                        updateProject("treesPerRai", e.target.value)
                      }
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="startDate"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    วันที่เริ่มโครงการ
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={project.startDate}
                    onChange={(e) =>
                      updateProject("startDate", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                {message && (
                  <p
                    role="status"
                    aria-live="polite"
                    className={`text-sm leading-6 ${messageClass}`}
                  >
                    {message}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleCalculate}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#31865F] px-5 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#26734F]"
                >
                  คำนวณและดูรายงาน
                  <ArrowRight size={17} />
                </button>

                {calculated && (
                  <button
                    type="button"
                    onClick={() => {
                      setStep(2);
                      clearMessage();
                    }}
                    className="w-full rounded-xl border border-emerald-200 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    ไปขั้นตอนจัดสรรเครดิต
                  </button>
                )}
              </div>
            </section>

            {/* ผลประมาณการ */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
              {!calculated ? (
                <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
                  <h2 className="text-lg font-bold text-gray-700">
                    การประมาณคาร์บอนเครดิต 3 ปี
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-gray-400">
                    กรอกข้อมูลโครงการทางด้านซ้าย แล้วกดคำนวณเพื่อแสดงกราฟและผลประมาณการ
                  </p>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-gray-800">
                    การประมาณคาร์บอนเครดิต 3 ปี
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    ปริมาณคาร์บอนเครดิตที่คาดการณ์ (tCO₂e)
                  </p>

                  <div className="mt-7 flex h-72">
                    <div className="flex flex-col justify-between pb-7 pr-3 text-right text-xs text-gray-400">
                      {[
                        maxCredit,
                        maxCredit * 0.75,
                        maxCredit * 0.5,
                        maxCredit * 0.25,
                        0,
                      ].map((tick, index) => (
                        <span key={index}>{formatNumber(tick)}</span>
                      ))}
                    </div>

                    <div className="relative flex flex-1 items-end justify-around border-b border-gray-200">
                      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                        {[0, 1, 2, 3].map((line) => (
                          <div
                            key={line}
                            className="border-t border-dashed border-gray-100"
                          />
                        ))}
                      </div>

                      {yearlyCredits.map((credit, index) => (
                        <div
                          key={index}
                          className="z-10 flex h-full w-1/4 flex-col items-center justify-end"
                        >
                          <div className="flex h-full w-full items-end justify-center">
                            <div
                              className={`w-12 max-w-[70%] rounded-t-xl transition-all duration-500 sm:w-16 ${
                                index === 0
                                  ? "bg-green-500"
                                  : index === 1
                                  ? "bg-amber-400"
                                  : "bg-sky-500"
                              }`}
                              style={{
                                height: `${Math.max(
                                  4,
                                  (credit / maxCredit) * 100
                                )}%`,
                              }}
                              title={`${formatNumber(credit)} tCO₂e`}
                            />
                          </div>
                          <span className="mt-2 whitespace-nowrap text-xs text-gray-500">
                            ปีที่ {index + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {yearlyCredits.map((credit, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center sm:p-4"
                      >
                        <p className="text-xs text-gray-500">
                          ปีที่ {index + 1}
                        </p>
                        <p className="mt-2 text-xl font-bold text-green-600">
                          {formatNumber(credit)}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">tCO₂e</p>
                        {index > 0 && (
                          <p className="mt-2 text-xs font-semibold text-green-600">
                            +
                            {Math.round(
                              ((credit - yearlyCredits[index - 1]) /
                                Math.max(yearlyCredits[index - 1], 1)) *
                                100
                            )}
                            % จากปีก่อน
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {/* ขั้นตอนที่ 2 */}
        {step === 2 && (
          <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-2">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
              <h2 className="mb-6 text-lg font-bold text-gray-800">
                ตรรกะการจัดสรรเครดิต
              </h2>

              <p className="mb-3 text-sm font-medium text-gray-700">
                เป้าหมายองค์กร
              </p>

              <div className="space-y-3">
                {(
                  [
                    {
                      value: "netzero",
                      title: "เป้าหมายการปล่อยก๊าซสุทธิเป็นศูนย์ (Net Zero)",
                      description: "ชดเชย 100% · ขาย 0%",
                    },
                    {
                      value: "neutral",
                      title: "ความเป็นกลางทางคาร์บอน (Carbon Neutral)",
                      description: "ชดเชย 50% · ขาย 50%",
                    },
                    {
                      value: "selling",
                      title: "การขายเครดิต (Credit Selling)",
                      description: "ชดเชย 20% · ขาย 80%",
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setGoal(item.value);
                      setSaved(false);
                      clearMessage();
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                      goal === item.value
                        ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                        : "border-gray-200 hover:border-emerald-300"
                    }`}
                  >
                    <span
                      className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        goal === item.value
                          ? "border-emerald-600 bg-emerald-600"
                          : "border-gray-300"
                      }`}
                    >
                      {goal === item.value && (
                        <span className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-gray-800">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        {item.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="mb-3 mt-7 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-700">
                  เลือกรายการปล่อยก๊าซที่ต้องการจัดสรร
                  <span className="text-red-500"> *</span>
                </p>
                <span className="text-xs text-gray-400">
                  เลือกแล้ว {selectedRecords.length} รายการ
                </span>
              </div>

              <div className="space-y-3">
                {creditRecords.map((record) => {
                  const checked = selectedRecords.includes(record.id);

                  return (
                    <label
                      key={record.id}
                      className={`flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border p-3 sm:flex-nowrap ${
                        checked
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-gray-100 bg-gray-50 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRecord(record.id)}
                        className="h-4 w-4 shrink-0 accent-emerald-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-gray-800">
                          {record.id}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {record.name}
                        </span>
                      </span>
                      <span className="whitespace-nowrap text-sm font-bold text-gray-800">
                        {formatNumber(record.amount)} tCO₂e
                      </span>
                    </label>
                  );
                })}
              </div>

              {message && (
                <p
                  role="status"
                  aria-live="polite"
                  className={`mt-4 text-sm leading-6 ${messageClass}`}
                >
                  {message}
                </p>
              )}

              <div className="mt-4 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-600">ยอดรวมรายการที่เลือก</span>
                  <span className="font-bold text-gray-900">
                    {formatNumber(selectedTotal)} tCO₂e
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    clearMessage();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 px-4 py-3 font-semibold text-gray-600 transition hover:bg-gray-50"
                >
                  <ArrowLeft size={17} />
                  ย้อนกลับ
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#31865F] px-4 py-3 font-semibold text-white transition hover:bg-[#26734F]"
                >
                  <Save size={17} />
                  ยืนยันการจัดสรร
                </button>
              </div>
            </section>

            {/* รายงานผล */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold text-gray-800">
                รายงานผลการจัดสรรเครดิต
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {goal === "netzero"
                  ? "Net Zero — ชดเชย 100%"
                  : goal === "neutral"
                  ? "Carbon Neutral — ชดเชย 50% · ขาย 50%"
                  : "Credit Selling — ชดเชย 20% · ขาย 80%"}
              </p>

              <h3 className="mb-4 mt-7 text-sm font-semibold text-gray-700">
                เครดิตที่เกิดขึ้นต่อรอบบัญชี
              </h3>

              <div className="relative h-52 border-b border-gray-100">
                <div className="absolute inset-0 flex flex-col justify-between">
                  {[0, 1, 2, 3].map((line) => (
                    <div key={line} className="border-t border-gray-100" />
                  ))}
                </div>

                <div className="absolute inset-0 flex items-center">
                  <svg
                    viewBox="0 0 600 180"
                    preserveAspectRatio="none"
                    className="h-full w-full overflow-visible"
                    role="img"
                    aria-label="กราฟแนวโน้มคาร์บอนเครดิต 3 ปี"
                  >
                    <defs>
                      <linearGradient
                        id="creditArea"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#16a34a"
                          stopOpacity="0.18"
                        />
                        <stop
                          offset="100%"
                          stopColor="#16a34a"
                          stopOpacity="0.02"
                        />
                      </linearGradient>
                    </defs>

                    <polygon
                      points={`0,${150 - (yearlyCredits[0] / maxCredit) * 120} 300,${150 - (yearlyCredits[1] / maxCredit) * 120} 600,${150 - (yearlyCredits[2] / maxCredit) * 120} 600,180 0,180`}
                      fill="url(#creditArea)"
                    />

                    <polyline
                      points={`0,${150 - (yearlyCredits[0] / maxCredit) * 120} 300,${150 - (yearlyCredits[1] / maxCredit) * 120} 600,${150 - (yearlyCredits[2] / maxCredit) * 120}`}
                      fill="none"
                      stroke="#16a34a"
                      strokeWidth="3"
                      vectorEffect="non-scaling-stroke"
                    />

                    {yearlyCredits.map((credit, index) => (
                      <circle
                        key={index}
                        cx={index * 300}
                        cy={150 - (credit / maxCredit) * 120}
                        r="4"
                        fill="#16a34a"
                        stroke="white"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </svg>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 text-center text-xs text-gray-400">
                <span>ปีที่ 1</span>
                <span>ปีที่ 2</span>
                <span>ปีที่ 3</span>
              </div>

              <div className="mt-7 overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">ช่วงเวลา</th>
                      <th className="px-4 py-3 text-right font-medium">
                        เครดิตที่เกิดขึ้น
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        เครดิตสะสม
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyCredits.map((credit, index) => (
                      <tr key={index} className="border-t border-gray-100">
                        <td className="px-4 py-4 text-gray-700">
                          ปีที่ {index + 1}
                        </td>
                        <td className="px-4 py-4 text-right text-gray-700">
                          {formatNumber(credit)} tCO₂e
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-green-600">
                          {formatNumber(cumulativeCredits[index])} tCO₂e
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4">
                  <span className="text-sm font-semibold text-emerald-700">
                    เครดิตสำหรับชดเชย
                  </span>
                  <span className="font-bold text-gray-800">
                    {formatNumber(creditsForOffset)} tCO₂e
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4">
                  <span className="text-sm font-semibold text-emerald-700">
                    เครดิตที่จัดสรรเพื่อขาย
                  </span>
                  <span className="font-bold text-gray-800">
                    {formatNumber(creditsForSale)} tCO₂e
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-5">
                <span className="font-bold text-gray-800">
                  รวมเครดิตประมาณการ
                </span>
                <span className="text-xl font-bold text-gray-900">
                  {formatNumber(totalCredits)} tCO₂e
                </span>
              </div>

              <p className="mt-4 text-xs leading-5 text-gray-500">
                ผลลัพธ์นี้เป็นค่าประมาณสำหรับทดลองระบบ และยังไม่ใช่ผลคำนวณที่รับรองตามระเบียบ T-VER อย่างเป็นทางการ
              </p>

              <Link
                href="/organization/tax_calculator"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-amber-700"
              >
                เริ่มคำนวณภาษี
                <ArrowRight size={17} />
              </Link>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}