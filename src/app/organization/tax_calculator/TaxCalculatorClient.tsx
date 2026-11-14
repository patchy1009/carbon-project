"use client";

// หน้าประเมินการยกเว้นภาษีนิติบุคคลจากการขายคาร์บอนเครดิต (TOR ข้อ 12.1–12.4) ฝั่ง browser
//   1) เลือกโครงการ (12.1)  เลือกได้เฉพาะโครงการที่จัดสรรเครดิตแล้ว เครดิตที่นำไปขาย (CreditSold) มาจากผลจัดสรรของหน้าจัดสรร ผู้ใช้ไม่ต้องกรอก
//   2) กรอกราคาขายต่อหน่วยและค่าใช้จ่ายของโครงการ (12.2)  ค่าใช้จ่ายเลือกจากรายการมาตรฐานที่แอดมินตั้งไว้ (ข้อ 5.5) แล้วแก้จำนวนเงินได้ หรือเพิ่มรายการเอง
//   3) คำนวณรายได้ (12.3) และภาษีที่ได้รับยกเว้น (12.4) ด้วยสูตร 7, 8, 9 ในไฟล์นี้  แล้วบันทึกด้วยฟังก์ชัน save_tax_assessment
//   ใช้เครดิตปีที่ 1 เท่านั้น ตาม TOR ข้อ 11.3 (หน้าที่อ่านข้อมูลจากฐานข้อมูลอยู่ที่ page.tsx ไฟล์นี้รับมาทาง props)

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calculator, Plus, Save, Trash2 } from "lucide-react";
import Select from "@/components/Select";
import { supabase } from "@/lib/supabaseClient";
import { validateForm, type formError } from "@/lib/validation";
import { amountKey, buildTaxSchema, checkTaxRanges, nameKey, priceKey } from "./schema";

export type CostOption = { cost_id: string; cost_name: string; net_price: number }; // รายการมาตรฐานของแอดมิน
export type SavedCost = { costId: string | null; name: string; amount: number };
export type TaxProject = {
  id: string;
  name: string;
  allocated: boolean; // จัดสรรเครดิตแล้วหรือยัง
  creditSold: number; // เครดิตที่จัดสรรเพื่อขาย (CreditSold) ถ้ายังไม่จัดสรรเป็น 0
  stale: boolean; // เครดิตปีที่ 1 ของโครงการเปลี่ยนไปหลังจัดสรร
  saved: { price: number; costs: SavedCost[] } | null; // ผลประเมินที่เคยบันทึกไว้
};

type Props = {
  loadError: string | null;
  projects: TaxProject[];
  initialProjectId: string;
  catalog: CostOption[];
};

type CostRow = { key: string; costId: string | null; name: string; amount: string };
type Snapshot = { price: number; costs: SavedCost[] }; // ค่าที่ใช้คำนวณ (ส่งไปบันทึกชุดเดียวกับที่เห็นบนจอ)
type Message = { text: string; type: "success" | "error" };

/* -------------------------------------------------------------------------- */
/*  สูตรประเมินภาษี (Proposal สูตรที่ 7, 8, 9 / TOR ข้อ 12.3-12.4)               */
/*  ฟังก์ชัน save_tax_assessment ในฐานข้อมูลคำนวณสูตรเดียวกันซ้ำตอนบันทึก ผลต้องตรงกัน */
/* -------------------------------------------------------------------------- */

// CITRate: อัตราภาษีเงินได้นิติบุคคล 20% (Proposal สูตรที่ 9)
export const CIT_RATE = 0.2;

export type TaxInput = {
  creditSold: number; // CreditSold: เครดิตที่จัดสรรเพื่อขาย tCO2e (มาจากหน้าจัดสรร ไม่ให้ผู้ใช้กรอกเอง)
  price: number; // PriceCredit: ราคาขายต่อหน่วย บาท/tCO2e
  expenses: number[]; // ExpensesT-VER: ค่าใช้จ่ายของโครงการแต่ละรายการ (บาท)
};

export type TaxResult = {
  creditSold: number;
  price: number;
  revenue: number; // RevenueT-VER = CreditSold x PriceCredit
  expenses: number; // ผลรวมค่าใช้จ่าย
  profit: number; // ProfitT-VER = Revenue - Expenses (ติดลบได้ = ขาดทุน)
  taxExempt: number; // TaxExempt = Profit x CITRate (ขาดทุนไม่มีภาษีให้ยกเว้น = 0)
};

// ฐานข้อมูลเก็บเครดิต 4 ตำแหน่ง ราคาและเงิน 2 ตำแหน่ง -> คำนวณเป็นจำนวนเต็มแล้วค่อยปัดครึ่งขึ้น
// ได้ผลเท่ากับ round(numeric, 2) ของ Postgres ทุกกรณี (ไม่เจอปัญหาทศนิยมของ float เช่น 0.1 + 0.2)
const toInt = (v: number, decimals: number) => Math.round(v * 10 ** decimals);

export function calculateTax({ creditSold, price, expenses }: TaxInput): TaxResult {
  const credit4 = toInt(creditSold, 4);
  const price2 = toInt(price, 2);

  // สูตรที่ 8: Revenue = CreditSold x PriceCredit  (หน่วย 10^-6 -> ปัดเหลือสตางค์)
  const revenueSatang = Math.round((credit4 * price2) / 10000);

  // รวมค่าใช้จ่าย (แต่ละรายการปัดเป็นสตางค์ก่อนรวม เหมือนที่ฐานข้อมูลเก็บ numeric(16,2))
  const expenseSatang = expenses.reduce((sum, e) => sum + toInt(e, 2), 0);

  // สูตรที่ 7: Profit = Revenue - Expenses
  const profitSatang = revenueSatang - expenseSatang;

  // สูตรที่ 9: TaxExempt = Profit x CITRate (ขาดทุน -> 0)
  const taxSatang = Math.round((Math.max(profitSatang, 0) * toInt(CIT_RATE, 4)) / 10000);

  return {
    creditSold: credit4 / 10000,
    price: price2 / 100,
    revenue: revenueSatang / 100,
    expenses: expenseSatang / 100,
    profit: profitSatang / 100,
    taxExempt: taxSatang / 100,
  };
}

const baht = (v: number) => v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const credit = (v: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 4 }).format(v);
const inputClass = (hasError: boolean) =>
  `w-full rounded-2xl border px-4 py-3 text-xs font-bold text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
    hasError ? "border-red-500" : "border-slate-200"
  }`;

let rowSeq = 0;
const newKey = () => `row${++rowSeq}`;
const toRow = (c: SavedCost): CostRow => ({ key: newKey(), costId: c.costId, name: c.name, amount: String(c.amount) });

// โครงการที่ใช้ประเมินได้ = จัดสรรแล้ว และมีเครดิตเหลือไปขาย (เป้าหมาย Net Zero ขาย 0% จึงไม่มีรายได้ให้ประเมิน)
const canAssess = (p: TaxProject | undefined): p is TaxProject => !!p && p.allocated && p.creditSold > 0;

function snapshotOf(p: TaxProject | undefined): Snapshot | null {
  return p && canAssess(p) && p.saved ? { price: p.saved.price, costs: p.saved.costs } : null;
}
function resultOf(p: TaxProject | undefined): TaxResult | null {
  const s = snapshotOf(p);
  return p && s ? calculateTax({ creditSold: p.creditSold, price: s.price, expenses: s.costs.map((c) => c.amount) }) : null;
}

export default function TaxCalculatorClient({ loadError, projects, initialProjectId, catalog }: Props) {
  const router = useRouter();

  // เข้าหน้านี้ทีไรให้ขอข้อมูลใหม่จากเซิร์ฟเวอร์เสมอ
  //   กันกรณีเพิ่งบันทึกการจัดสรรที่หน้าก่อนหน้า แล้วเห็นข้อมูลเก่าจากแคชของ Next
  useEffect(() => {
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // แถวค่าใช้จ่ายตั้งต้นของโครงการ:
  //   เคยบันทึกผลประเมินไว้ -> ใช้ค่าที่บันทึกไว้ เพื่อแก้ไขต่อได้ (ข้อ 12.2)
  //   ยังไม่เคยบันทึก     -> ดึงรายการต้นทุนมาตรฐานของแอดมิน (ข้อ 5.5) มาใส่ให้ทั้งหมด พร้อมราคาสุทธิ
  //                         ตามแผนภาพ 5.2.2.11 ที่ข้อมูลต้นทุนโครงการ "ถูกนำเข้ามาประมวลผล" องค์กรแก้จำนวนเงิน/ลบ/เพิ่มเองได้
  const initialRows = (p: TaxProject | undefined): CostRow[] =>
    p?.saved
      ? p.saved.costs.map(toRow)
      : catalog.map((c) => ({ key: newKey(), costId: c.cost_id, name: c.cost_name, amount: String(c.net_price) }));

  const first = projects.find((p) => p.id === initialProjectId);
  const [projectId, setProjectId] = useState(initialProjectId);
  // ถ้าเคยบันทึกผลประเมินไว้ ให้เริ่มจากค่าที่บันทึกไว้ เพื่อแก้ไขต่อได้ (ข้อ 12.2)
  const [price, setPrice] = useState(first?.saved ? String(first.saved.price) : "");
  const [rows, setRows] = useState<CostRow[]>(() => initialRows(first));
  const [errors, setErrors] = useState<formError<string>>({});
  const [snapshot, setSnapshot] = useState<Snapshot | null>(() => snapshotOf(first));
  const [result, setResult] = useState<TaxResult | null>(() => resultOf(first));
  const [savedNow, setSavedNow] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  const ready = canAssess(project);
  const hasSaved = !!project?.saved || savedNow;
  const unusedCatalog = catalog.filter((c) => !rows.some((r) => r.costId === c.cost_id));

  // แก้อะไรก็ตาม ผลที่คำนวณไว้ไม่ตรงกับช่องกรอกแล้ว -> ซ่อนผล ต้องกดคำนวณใหม่
  function touch(fieldKey?: string) {
    setResult(null);
    setSnapshot(null);
    setSavedNow(false);
    setMessage(null);
    if (fieldKey) setErrors((prev) => ({ ...prev, [fieldKey]: undefined }));
  }

  function pickProject(id: string) {
    const p = projects.find((x) => x.id === id);
    setProjectId(id);
    setPrice(p?.saved ? String(p.saved.price) : "");
    setRows(initialRows(p));
    setSnapshot(snapshotOf(p));
    setResult(resultOf(p));
    setErrors({});
    setSavedNow(false);
    setMessage(null);
  }

  function addFromCatalog(costId: string) {
    const item = catalog.find((c) => c.cost_id === costId);
    if (!item || rows.some((r) => r.costId === costId)) return;
    setRows((prev) => [...prev, { key: newKey(), costId: item.cost_id, name: item.cost_name, amount: String(item.net_price) }]);
    touch("rows");
  }

  function addCustom() {
    setRows((prev) => [...prev, { key: newKey(), costId: null, name: "", amount: "" }]);
    touch("rows");
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    touch();
  }

  function updateRow(key: string, patch: Partial<CostRow>, fieldKey: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    touch(fieldKey);
  }

  function handleCalculate() {
    if (!project || !ready) return;
    setMessage(null);
    setSavedNow(false);

    if (rows.length === 0) {
      setResult(null);
      setSnapshot(null);
      setErrors({ rows: "กรุณาเพิ่มค่าใช้จ่ายอย่างน้อย 1 รายการ" });
      return;
    }

    const values: Record<string, string> = { [priceKey]: price };
    for (const r of rows) {
      values[nameKey(r.key)] = r.name;
      values[amountKey(r.key)] = r.amount;
    }
    const checked = validateForm(values, buildTaxSchema(rows.map((r) => ({ key: r.key, name: r.name, custom: r.costId === null }))));
    // ช่วงของค่า (ราคา > 0, ไม่เกินขนาดช่องใน DB) ตรวจเพิ่มจากกฎรูปแบบ ถ้าช่องไหนผิดรูปแบบอยู่แล้วใช้ข้อความรูปแบบก่อน
    const rangeErrors = checkTaxRanges(checked.clean, rows.map((r) => r.key));
    if (!checked.ok || Object.keys(rangeErrors).length > 0) {
      setResult(null);
      setSnapshot(null);
      setErrors({ ...rangeErrors, ...(checked.ok ? {} : checked.errors) });
      return;
    }

    setErrors({});
    const costs: SavedCost[] = rows.map((r) => ({
      costId: r.costId,
      name: r.costId === null ? checked.clean[nameKey(r.key)].trim() : r.name,
      amount: Number(checked.clean[amountKey(r.key)]),
    }));
    const priceNumber = Number(checked.clean[priceKey]);
    setSnapshot({ price: priceNumber, costs });
    setResult(calculateTax({ creditSold: project.creditSold, price: priceNumber, expenses: costs.map((c) => c.amount) }));
  }

  async function handleSave() {
    if (!project || !result || !snapshot) return;
    setSubmitting(true);
    // ส่งแค่ราคากับรายการค่าใช้จ่าย ฐานข้อมูลคำนวณรายได้/กำไร/ภาษีใหม่เองจากเครดิตที่จัดสรรไว้
    const { error } = await supabase.rpc("save_tax_assessment", {
      p_project_id: project.id,
      p_selling_price: snapshot.price,
      p_costs: snapshot.costs.map((c) => ({ cost_id: c.costId, cost_name: c.name, amount: c.amount })),
    });
    setSubmitting(false);
    if (error) {
      setMessage({ text: `บันทึกไม่สำเร็จ: ${error.message}`, type: "error" });
      return;
    }
    setSavedNow(true);
    setMessage({ text: "บันทึกการประเมินภาษีเรียบร้อยแล้ว", type: "success" });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 text-slate-800 md:py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold text-[#11221C] md:text-3xl">ประเมินการยกเว้นภาษี</h1>
        <p className="text-xs font-medium text-slate-500 md:text-sm">
          ประเมินภาษีเงินได้นิติบุคคลที่ได้รับการยกเว้นจากการขายคาร์บอนเครดิต (ปีที่ 1 ของโครงการ)
        </p>
      </div>

      {loadError && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          โหลดข้อมูลไม่สำเร็จ: {loadError}
        </p>
      )}

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-800">
          ยังไม่พบโครงการป่าไม้ T-VER <br />
          กรุณาไปที่{" "}
          <Link href="/organization/tver-simulation" className="font-semibold underline">
            จำลองโครงการ T-VER
          </Link>{" "}
          เพื่อสร้างโครงการก่อน
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* ซ้าย: ข้อมูลที่ใช้คำนวณ */}
          <section className="space-y-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-5">
            <h2 className="text-base font-bold text-[#11221C]">ตั้งค่าข้อมูลโครงการและภาษี</h2>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">เลือกโครงการป่าไม้ T-VER</label>
              <Select
                value={projectId}
                onChange={pickProject}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-semibold text-slate-800"
                options={projects.map((p) => ({
                  value: p.id,
                  label: p.allocated ? p.name : `${p.name} (ยังไม่จัดสรรเครดิต)`,
                }))}
              />
            </div>

            {project && !project.allocated && (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                โครงการนี้ยังไม่ได้จัดสรรคาร์บอนเครดิต กรุณา{" "}
                <Link href={`/organization/tver-allocation?project=${project.id}`} className="font-semibold underline">
                  ไปจัดสรรเครดิตก่อน
                </Link>{" "}
                แล้วกลับมาประเมินภาษี
              </p>
            )}

            {project && project.allocated && project.creditSold <= 0 && (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                การจัดสรรของโครงการนี้ไม่มีเครดิตสำหรับขาย (เช่น เป้าหมาย Net Zero) จึงไม่มีรายได้ให้ประเมินภาษี หากต้องการขายเครดิต{" "}
                <Link href={`/organization/tver-allocation?project=${project.id}`} className="font-semibold underline">
                  เปลี่ยนเป้าหมายที่หน้าจัดสรร
                </Link>
              </p>
            )}

            {project && ready && (
              <>
                {project.stale && (
                  <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                    เครดิตปีที่ 1 ของโครงการเปลี่ยนไปจากตอนที่จัดสรรไว้ กรุณา{" "}
                    <Link href={`/organization/tver-allocation?project=${project.id}`} className="font-semibold underline">
                      จัดสรรเครดิตใหม่
                    </Link>{" "}
                    ก่อนประเมินภาษี
                  </p>
                )}

                {hasSaved && !savedNow && (
                  <p className="text-xs font-semibold text-emerald-700">มีผลการประเมินที่บันทึกไว้แล้ว แก้ไขได้ด้านล่าง</p>
                )}

                {/* CreditSold: อ่านอย่างเดียว มาจากหน้าจัดสรร */}
                <div className="space-y-1 rounded-2xl bg-slate-50/60 p-3">
                  <span className="block text-xs font-bold text-slate-700">เครดิตที่จัดสรรเพื่อขาย ปีที่ 1 (CreditSold)</span>
                  <span className="text-lg font-extrabold text-slate-800">{credit(project.creditSold)}</span>{" "}
                  <span className="text-xs text-slate-500">tCO₂e</span>
                  <p className="text-[10px] text-slate-400">
                    มาจากผลการจัดสรรเครดิต (แก้ได้ที่{" "}
                    <Link href={`/organization/tver-allocation?project=${project.id}`} className="underline">
                      หน้าจัดสรร
                    </Link>
                    )
                  </p>
                </div>

                <div className="space-y-1.5 border-t border-slate-100 pt-3">
                  <label className="text-xs font-bold text-slate-500">ราคาขายคาร์บอนเครดิต (บาท/tCO₂e)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label="ราคาขายคาร์บอนเครดิต"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value);
                      touch(priceKey);
                    }}
                    className={inputClass(!!errors[priceKey])}
                  />
                  {errors[priceKey] && <p className="text-xs text-red-600">{errors[priceKey]}</p>}
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <label className="block text-xs font-bold text-slate-700">ค่าใช้จ่ายของโครงการ (บาท)</label>

                  {catalog.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 p-3 text-center text-xs text-amber-700">
                      ผู้ดูแลระบบยังไม่ได้ตั้งรายการต้นทุนมาตรฐาน เพิ่มรายการเองด้านล่างได้
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400">
                      รายการมาตรฐานดึงมาจากผู้ดูแลระบบ แก้จำนวนเงินหรือลบออกได้ และเพิ่มรายการของโครงการเองได้
                    </p>
                  )}

                  {rows.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                      ยังไม่มีรายการ เลือกจากรายการมาตรฐานหรือเพิ่มรายการเองด้านล่าง
                    </p>
                  )}

                  {rows.map((r) => (
                    <div key={r.key} className="space-y-1">
                      <div className="grid grid-cols-[1fr_8rem_2rem] items-center gap-2">
                        {r.costId === null ? (
                          <input
                            type="text"
                            aria-label="ชื่อรายการค่าใช้จ่าย"
                            placeholder="ชื่อรายการ เช่น ค่ากล้าไม้"
                            maxLength={150}
                            value={r.name}
                            onChange={(e) => updateRow(r.key, { name: e.target.value }, nameKey(r.key))}
                            className={inputClass(!!errors[nameKey(r.key)])}
                          />
                        ) : (
                          <span className="text-xs font-semibold text-slate-700">{r.name}</span>
                        )}
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`จำนวนเงิน ${r.name || "รายการใหม่"}`}
                          placeholder="0.00"
                          value={r.amount}
                          onChange={(e) => updateRow(r.key, { amount: e.target.value }, amountKey(r.key))}
                          className={`${inputClass(!!errors[amountKey(r.key)])} text-right`}
                        />
                        <button
                          type="button"
                          aria-label={`ลบ ${r.name || "รายการใหม่"}`}
                          onClick={() => removeRow(r.key)}
                          className="rounded p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {errors[nameKey(r.key)] && <p className="text-xs text-red-600">{errors[nameKey(r.key)]}</p>}
                      {errors[amountKey(r.key)] && <p className="text-xs text-red-600">{errors[amountKey(r.key)]}</p>}
                    </div>
                  ))}
                  {errors.rows && <p className="text-xs text-red-600">{errors.rows}</p>}

                  {unusedCatalog.length > 0 && (
                    <Select
                      value=""
                      onChange={addFromCatalog}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-semibold text-slate-800"
                      options={[
                        { value: "", label: "+ เลือกจากรายการต้นทุนมาตรฐาน", placeholder: true },
                        ...unusedCatalog.map((c) => ({ value: c.cost_id, label: `${c.cost_name} (${baht(c.net_price)} บาท)` })),
                      ]}
                    />
                  )}
                  <button
                    type="button"
                    onClick={addCustom}
                    className="flex items-center gap-1 text-xs font-semibold text-[#2C7A59] hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    เพิ่มรายการเอง
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCalculate}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2C7A59] py-3 text-xs font-bold text-white shadow-md transition hover:bg-[#1f5a41]"
                >
                  <Calculator className="h-4 w-4" />
                  คำนวณภาษีและประเมินสิทธิประโยชน์
                </button>
              </>
            )}
          </section>

          {/* ขวา: ผลการคำนวณ */}
          <section className="space-y-6 lg:col-span-7">
            {message && (
              <p
                className={`rounded-2xl border p-3 text-xs ${
                  message.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-600"
                }`}
              >
                {message.text}
              </p>
            )}

            {project && ready && result && snapshot ? (
              <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-[#11221C]">ผลการประเมิน ({project.name})</h3>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-600">
                      รายได้จากการขายคาร์บอนเครดิต
                    </span>
                    <span className="font-extrabold text-slate-800">฿ {baht(result.revenue)}</span>
                  </div>

                  <div className="space-y-1 rounded-2xl bg-slate-50/60 p-3">
                    <span className="block font-bold text-slate-600">ค่าใช้จ่ายของโครงการ</span>
                    {snapshot.costs.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-slate-600">
                        <span>{c.name}</span>
                        <span className="text-red-600">- {baht(c.amount)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-slate-200 pt-1 font-bold text-slate-700">
                      <span>รวมค่าใช้จ่าย</span>
                      <span className="text-red-600">- {baht(result.expenses)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-600">
                      กำไรสุทธิเฉพาะโครงการ
                    </span>
                    <span className={`font-extrabold ${result.profit < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      ฿ {baht(result.profit)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="font-bold text-slate-700">
                      ภาษีเงินได้นิติบุคคลที่ได้รับการยกเว้น
                    </span>
                    <span className="text-sm font-extrabold text-emerald-800">฿ {baht(result.taxExempt)}</span>
                  </div>

                  {result.profit <= 0 && (
                    <p className="rounded-2xl bg-amber-50 p-3 text-amber-800">
                      ค่าใช้จ่ายมากกว่าหรือเท่ากับรายได้ (ขาดทุนหรือเสมอตัว) จึงไม่มีกำไรที่จะได้รับการยกเว้นภาษี
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={submitting || savedNow}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#11221C] py-3 text-xs font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {submitting ? "กำลังบันทึก..." : savedNow ? "บันทึกแล้ว" : "บันทึกผลการประเมิน"}
                </button>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-400">
                กรอกราคาขายและค่าใช้จ่ายฝั่งซ้าย แล้วกดปุ่มคำนวณเพื่อดูผลการประเมิน
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
