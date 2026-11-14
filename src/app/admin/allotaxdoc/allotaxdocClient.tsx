// หน้าของผู้ดูแลระบบ 3 ส่วน: (1) เป้าหมายการจัดสรรเครดิต ข้อ 5.4 (ตาราง project_target_rule)
//   (2) ต้นทุนโครงการปลูกป่า ข้อ 5.5 (ตาราง project_cost_type)  (3) เอกสารที่ให้องค์กรดาวน์โหลด ข้อ 13 (อัปโหลด แก้ชื่อ ลบ ดาวน์โหลด)
//   (1) และ (2) บันทึก/แก้/ลบลงฐานข้อมูลจริง ต้องมี RLS: project_target_rule -> supabase/rls_tver_allocation.sql, project_cost_type -> supabase/rls_project_cost.sql
'use client';

import Select from '@/components/Select'; // dropdown กลาง (แทน <select> ของ browser ให้หน้าตาเหมือนกันทั้งระบบ)
import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AlloTaxDoc } from '@/types/allotaxdoc';
import { ModalActions, ModalShell } from '@/components/Modal';
import { dbErrorMessage, deleteRecord, insertRecord, updateRecord } from '@/lib/supabaseCrud';
import { validateForm, extendSchema, notDuplicate, validateFile, type formError } from '@/lib/validation';
import { normalizeToArabicNumber, safeStorageName, fileBaseName, fileExtension } from '@/lib/normalization';
import FieldError from '@/components/FieldError';
import { docSchema, costSchema, targetSchema, checkCostPrice, DOC_FILE_RULE, type DocField, type CostField } from './schema';
import { showError, showSaved } from '@/lib/dialog'; // กล่องแจ้งเตือนกลางแทน alert
import { DownloadIcon, EyeIcon, PencilIcon, PlusIcon, TrashIcon, UploadCloudIcon } from '@/components/icons';
import RowActions from '@/components/RowActions'; // ปุ่มแก้ไข/ลบกลาง (ตารางต้นทุน + เอกสาร)
import { inputClass } from '@/components/formStyles'; // class ช่องกรอกกลาง (popup แก้ไขต้นทุน)
import { T } from '@/components/adminTable'; // การ์ด/ตารางแบบเดียวกับหน้า T-VER Project

/* สรุปสิ่งที่เปลี่ยนในไฟล์นี้
 * 1) เอกสาร: ชื่อผ่าน normalize + validate (ห้ามว่าง/ตัวเลขล้วน/ซ้ำ/ยาวเกิน) แสดง error ใต้ช่องแทน alert
 * 2) ไฟล์: ตรวจนามสกุล (PDF, DOCX, XLSX) และขนาด (ไม่เกิน 25MB) ตามที่หน้าเว็บบอกไว้ (เดิมไม่ได้ตรวจจริง)
 * 3) ชื่อไฟล์ใน Storage เปลี่ยนเป็น เวลา-สุ่ม.นามสกุล (safeStorageName)
 *    เดิมใช้ชื่อไฟล์จริง ถ้าเป็นภาษาไทยหรือมีอักขระพิเศษ Supabase จะปฏิเสธ (Invalid key)
 * 4) บันทึก/ลบแถวในตาราง documents ผ่านฟังก์ชันกลาง insertRecord / deleteRecord
 * 5) เพิ่มการแก้ไขชื่อเอกสาร
 * 6) ต้นทุนโครงการ: ตรวจชื่อและราคา (ไม่ติดลบ ทศนิยม 2 หลัก รับเลขไทย/comma) ก่อนเพิ่ม
 * 7) ต้นทุนโครงการ: แก้ไขรายการได้ (popup ใช้กฎตรวจเดียวกับตอนเพิ่ม)
 * 8) เอกสาร: แสดงเป็นตารางแบบหน้าอื่น ไอคอนขนาด/สีเดียวกับ RowActions เพิ่มปุ่มเปิดดู (PDF เปิดในเบราว์เซอร์,
 *    DOCX/XLSX เปิดผ่าน Office Online Viewer) และปุ่มดาวน์โหลดโหลดไฟล์จริงแทนการเปิดแท็บ
 * 9) เป้าหมายโครงการ (TOR ข้อ 5.4): เลิกใช้ข้อมูลจำลอง อ่าน/เพิ่ม/แก้/ลบ ตาราง project_target_rule จริง
 *    page.tsx ดึงรายการมาให้ ส่วนบันทึก/ลบทำที่ไฟล์นี้ผ่านฟังก์ชันกลาง (กฎตรวจอยู่ใน schema.ts)
 * 10) ต้นทุนโครงการ (TOR ข้อ 5.5): เลิกใช้ข้อมูลจำลอง อ่าน/เพิ่ม/แก้/ลบ ตาราง project_cost_type จริง
    ราคาสุทธิคำนวณ (ราคา x (1 + VAT/100) ปัดสตางค์) แล้วบันทึกลงคอลัมน์ net_price
    ลบได้เสมอ: ผลประเมินภาษีที่องค์กรบันทึกไว้เก็บสำเนาชื่อ/ยอดไว้เอง (FK cost_id แบบ set null) */

/**
 * Storage bucket that uploaded project documents are stored in.
 */
const BUCKET = 'documents';

/* ไอคอนที่เคยเขียนไว้ในไฟล์นี้ ย้ายไปไว้ที่ components/icons.tsx (ใช้ร่วมกันทุกหน้า) */

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

// ป้ายชนิดไฟล์ สีเดียวกับหน้าเอกสารฝั่งองค์กร (organization/documents/DocumentsClient.tsx)
// ใช้ fileExtension กลาง (ไฟล์ไม่มีนามสกุล / ขึ้นต้นด้วยจุด จะได้ค่าว่าง)
function fileBadge(filePath: string | null): { label: string; color: string } {
  if (filePath && /^https?:\/\//i.test(filePath)) return { label: 'LINK', color: 'bg-[#6B7280]' };
  switch (fileExtension(filePath)) {
    case 'pdf':
      return { label: 'PDF', color: 'bg-[#D32F2F]' };
    case 'docx':
    case 'doc':
      return { label: 'DOCX', color: 'bg-[#1976D2]' };
    case 'xlsx':
    case 'xls':
      return { label: 'XLSX', color: 'bg-[#2E7D32]' };
    default:
      return { label: 'FILE', color: 'bg-[#6B7280]' };
  }
}

/* -------------------------------------------------------------------------- */
/*  เป้าหมายโครงการ (ตาราง project_target_rule)                                */
/* -------------------------------------------------------------------------- */

/* เป้าหมายการจัดสรร 1 แถว
 * offset_ratio = % ของเครดิตปีที่ 1 ที่ใช้ชดเชยการดำเนินงานของตนเอง
 * sell_ratio   = % ที่นำไปขาย (DB บังคับให้ offset + sell = 100) */
export type TargetRule = {
  target_id: string;
  target_name: string;
  offset_ratio: number;
  sell_ratio: number;
  updated_date?: string | null;
};

type TargetErrors = { target_name?: string; offset_ratio?: string };

// สัดส่วนชดเชย: จำนวนเต็ม 0-100 (รับเลขไทย/comma ผ่าน normalizeToArabicNumber) ตรงกับ check constraint ใน DB
function parseOffset(raw: string): { value: number | null; error?: string } {
  if (!raw.trim()) return { value: null, error: 'กรุณากรอกสัดส่วนชดเชย' };
  const n = normalizeToArabicNumber(raw);
  if (n === null || Number.isNaN(n)) return { value: null, error: 'สัดส่วนชดเชยต้องเป็นตัวเลข' };
  if (!Number.isInteger(n)) return { value: null, error: 'สัดส่วนชดเชยต้องเป็นจำนวนเต็ม' };
  if (n < 0 || n > 100) return { value: null, error: 'สัดส่วนชดเชยต้องอยู่ระหว่าง 0 ถึง 100' };
  return { value: n };
}

// เรียงแบบเดียวกับหน้าจัดสรรเครดิต: ชดเชยมากไปน้อย แล้วเรียงตามชื่อ
const sortTargets = (rows: TargetRule[]) =>
  [...rows].sort((a, b) => b.offset_ratio - a.offset_ratio || a.target_name.localeCompare(b.target_name, 'th'));

const emptyTargetForm = { target_name: '', offset_ratio: '' };

/* -------------------------------------------------------------------------- */
/*  ต้นทุนโครงการ (ตาราง project_cost_type)                                    */
/* -------------------------------------------------------------------------- */

/* รายการต้นทุนมาตรฐาน 1 แถว (เป็น "เมนู" ให้องค์กรเลือกในหน้าคำนวณภาษี)
 * price = ราคาก่อน VAT, vat = อัตรา VAT เป็นร้อยละ (ไม่มี VAT = 0), net_price = price x (1 + vat/100) */
export type CostRow = {
  cost_id: string;
  cost_name: string;
  price: number;
  vat: number;
  net_price: number;
};

const vatOptions = [0, 7];

// ราคาสุทธิ = ราคา x (1 + VAT/100) ปัดเป็นสตางค์ คิดเป็นจำนวนเต็มสตางค์เพื่อไม่ให้ทศนิยมลอยตัวทำให้เพี้ยน
// (ตรงกับ round(numeric, 2) ของ Postgres)
function netOf(price: number, vat: number): number {
  const satang = Math.round(price * 100);
  return Math.round((satang * (100 + vat)) / 100) / 100;
}

// เผื่อ numeric ถูกส่งมาเป็นสตริง: แปลงเป็นตัวเลขก่อนใช้คำนวณ/แสดง
const toCostRow = (r: CostRow): CostRow => ({
  ...r,
  price: Number(r.price),
  vat: Number(r.vat),
  net_price: Number(r.net_price),
});

// เรียงตามชื่อ (ตัวเดียวกับที่หน้าคำนวณภาษีฝั่งองค์กรใช้เรียงเมนู)
const sortCosts = (rows: CostRow[]) =>
  [...rows].sort((a, b) => a.cost_name.localeCompare(b.cost_name, 'th'));

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function AlloTaxDocClient({
  initialDocuments,
  initialTargets,
  initialCosts,
}: {
  initialDocuments: AlloTaxDoc[];
  initialTargets: TargetRule[];
  initialCosts: CostRow[];
}) {
  /* ---- Section 1: Project Targets (live, backed by Supabase: project_target_rule) ---- */
  const [targets, setTargets] = useState<TargetRule[]>(() => sortTargets(initialTargets));
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null); // null = เพิ่มใหม่
  const [targetForm, setTargetForm] = useState(emptyTargetForm);
  const [targetErrors, setTargetErrors] = useState<TargetErrors>({});
  const [savingTarget, setSavingTarget] = useState(false);

  // ช่อง "ขายเชิงพาณิชย์" คำนวณจาก 100 - ชดเชย (ผู้ใช้ไม่ต้องกรอกเอง กันผลรวมไม่เท่ากับ 100)
  const offsetPreview = parseOffset(targetForm.offset_ratio);
  const sellPreview = offsetPreview.value === null ? null : 100 - offsetPreview.value;

  // เปิดฟอร์มเป้าหมาย ถ้าส่ง row มาคือโหมดแก้ไข ถ้าไม่ส่งคือเพิ่มใหม่
  function openTargetModal(row?: TargetRule) {
    setEditTargetId(row?.target_id ?? null);
    setTargetForm(row ? { target_name: row.target_name, offset_ratio: String(row.offset_ratio) } : emptyTargetForm);
    setTargetErrors({});
    setShowTargetModal(true);
  }

  // ปิดฟอร์มเป้าหมายและล้างข้อความ error
  function closeTargetModal() {
    setShowTargetModal(false);
    setTargetErrors({});
  }

  // ตรวจชื่อ (schema + ห้ามซ้ำ) และสัดส่วน แล้วบันทึกลงตาราง project_target_rule
  async function handleSaveTarget(e: React.FormEvent) {
    e.preventDefault();
    if (savingTarget) return;

    const others = targets.filter((t) => t.target_id !== editTargetId).map((t) => t.target_name);
    const result = validateForm(
      { target_name: targetForm.target_name },
      extendSchema(targetSchema, { target_name: [notDuplicate('ชื่อเป้าหมาย', others)] })
    );
    const offset = parseOffset(targetForm.offset_ratio);

    const errs: TargetErrors = {};
    if (!result.ok) errs.target_name = result.errors.target_name;
    if (offset.error) errs.offset_ratio = offset.error;
    setTargetErrors(errs);
    const ratio = offset.value;
    if (errs.target_name || errs.offset_ratio || ratio === null || !result.ok) return;

    const values = {
      target_name: result.clean.target_name,
      offset_ratio: ratio,
      sell_ratio: 100 - ratio,
    };

    setSavingTarget(true);
    if (editTargetId) {
      const updated = await updateRecord<TargetRule>(
        'project_target_rule', 'target_id', editTargetId,
        { ...values, updated_date: new Date().toISOString() }, '*', 'แก้ไขเป้าหมาย'
      );
      if (!updated) { setSavingTarget(false); return; }
      setTargets((prev) => sortTargets(prev.map((t) => (t.target_id === editTargetId ? updated : t))));
    } else {
      const created = await insertRecord<TargetRule>('project_target_rule', values, '*', 'เพิ่มเป้าหมาย');
      if (!created) { setSavingTarget(false); return; }
      setTargets((prev) => sortTargets([...prev, created]));
    }
    setSavingTarget(false);
    closeTargetModal();
    showSaved();
  }

  // ลบเป้าหมาย: ถ้าองค์กรใช้จัดสรรไปแล้วลบไม่ได้ (FK แบบ restrict) บอกเหตุผลก่อนแทนข้อความ error ของ DB
  async function handleDeleteTarget(t: TargetRule) {
    const { count, error } = await supabase
      .from('org_credit_allocation')
      .select('orgallocate_id', { count: 'exact', head: true })
      .eq('target_id', t.target_id);
    if (!error && (count ?? 0) > 0) {
      showError(`ลบไม่ได้: เป้าหมาย "${t.target_name}" ถูกใช้ในการจัดสรรเครดิตของ ${count} โครงการ`);
      return;
    }

    const ok = await deleteRecord('project_target_rule', 'target_id', t.target_id, `ลบเป้าหมาย "${t.target_name}"?`);
    if (!ok) return;
    setTargets((prev) => prev.filter((x) => x.target_id !== t.target_id));
  }

  /* ---- Section 2: Project Cost (live, backed by Supabase: project_cost_type) ---- */
  const [costs, setCosts] = useState<CostRow[]>(() => sortCosts(initialCosts.map(toCostRow)));
  const [costName, setCostName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [costVat, setCostVat] = useState<number>(7);
  const [costErrors, setCostErrors] = useState<formError<CostField>>({});
  const [savingCost, setSavingCost] = useState(false);

  // เดิมใช้ Number(costPrice) ซึ่งรับเลขไทย/comma ไม่ได้ -> ใช้ normalizeToArabicNumber
  const previewBase = normalizeToArabicNumber(costPrice);
  const netPreview =
    previewBase !== null && Number.isFinite(previewBase) && previewBase >= 0 ? netOf(previewBase, costVat) : 0;

  // ตรวจชื่อ (schema + ห้ามซ้ำ) และราคา (ไม่ติดลบ ทศนิยม 2 หลัก ไม่เกินเพดาน) ใช้ร่วมกันทั้งตอนเพิ่มและตอนแก้
  function checkCost(name: string, priceRaw: string, otherNames: string[]) {
    const result = validateForm(
      { name, price: priceRaw },
      extendSchema(costSchema, { name: [notDuplicate('ชื่อรายการต้นทุน', otherNames)] })
    );
    const errors: formError<CostField> = result.ok ? {} : { ...result.errors };
    if (result.ok) {
      const rangeError = checkCostPrice(result.clean.price);
      if (rangeError) errors.price = rangeError;
    }
    if (!result.ok || Object.keys(errors).length > 0) return { ok: false as const, errors };
    return { ok: true as const, name: result.clean.name, price: normalizeToArabicNumber(result.clean.price) ?? 0 };
  }

  // ตรวจข้อมูลรายการต้นทุน ถ้าถูกต้องจึงบันทึกลงตาราง project_cost_type
  async function handleAddCost(e: React.FormEvent) {
    e.preventDefault();
    if (savingCost) return;
    const checked = checkCost(costName, costPrice, costs.map((c) => c.cost_name));
    if (!checked.ok) { setCostErrors(checked.errors); return; }
    setCostErrors({});
    if (!vatOptions.includes(costVat)) return; // VAT ต้องเป็นค่าที่มีในตัวเลือกเท่านั้น

    setSavingCost(true);
    const created = await insertRecord<CostRow>(
      'project_cost_type',
      { cost_name: checked.name, price: checked.price, vat: costVat, net_price: netOf(checked.price, costVat) },
      '*', 'เพิ่มรายการต้นทุน'
    );
    setSavingCost(false);
    if (!created) return;
    setCosts((prev) => sortCosts([...prev, toCostRow(created)]));
    setCostName('');
    setCostPrice('');
    setCostVat(7);
    showSaved();
  }

  // ลบรายการต้นทุน: ลบได้เสมอ เพราะผลประเมินที่องค์กรบันทึกไว้แล้วเก็บชื่อและยอดไว้เองแล้ว (cost_id แค่ถูกตั้งเป็นว่าง)
  async function handleDeleteCost(c: CostRow) {
    const ok = await deleteRecord(
      'project_cost_type', 'cost_id', c.cost_id,
      `ลบรายการ "${c.cost_name}"? (ผลประเมินที่องค์กรบันทึกไว้แล้วจะยังเก็บชื่อและยอดเดิมไว้)`
    );
    if (!ok) return;
    setCosts((prev) => prev.filter((x) => x.cost_id !== c.cost_id));
  }

  // แก้ไขรายการต้นทุน (ชื่อ ราคา VAT) ผ่าน popup ใช้กฎตรวจชุดเดียวกับตอนเพิ่ม
  const [editCost, setEditCost] = useState<CostRow | null>(null);
  const [editCostName, setEditCostName] = useState('');
  const [editCostPrice, setEditCostPrice] = useState('');
  const [editCostVat, setEditCostVat] = useState<number>(7);
  const [editCostErrors, setEditCostErrors] = useState<formError<CostField>>({});

  const editBase = normalizeToArabicNumber(editCostPrice);
  const editNetPreview =
    editBase !== null && Number.isFinite(editBase) && editBase >= 0 ? netOf(editBase, editCostVat) : 0;

  function openEditCost(c: CostRow) {
    setEditCost(c);
    setEditCostName(c.cost_name);
    setEditCostPrice(String(c.price));
    setEditCostVat(c.vat);
    setEditCostErrors({});
  }

  async function handleSaveCost(e: React.FormEvent) {
    e.preventDefault();
    if (!editCost || savingCost) return;
    // ชื่อห้ามซ้ำกับรายการอื่น (ไม่นับรายการที่กำลังแก้)
    const checked = checkCost(
      editCostName, editCostPrice,
      costs.filter((c) => c.cost_id !== editCost.cost_id).map((c) => c.cost_name)
    );
    if (!checked.ok) { setEditCostErrors(checked.errors); return; }
    setEditCostErrors({});
    if (!vatOptions.includes(editCostVat)) return;

    setSavingCost(true);
    const updated = await updateRecord<CostRow>(
      'project_cost_type', 'cost_id', editCost.cost_id,
      {
        cost_name: checked.name, price: checked.price, vat: editCostVat,
        net_price: netOf(checked.price, editCostVat), updated_date: new Date().toISOString(),
      },
      '*', 'แก้ไขรายการต้นทุน'
    );
    setSavingCost(false);
    if (!updated) return;
    setCosts((prev) => sortCosts(prev.map((c) => (c.cost_id === editCost.cost_id ? toCostRow(updated) : c))));
    setEditCost(null);
    showSaved();
  }

  /* ---- Section 3: Project Documents (live, backed by Supabase) ---- */
  const [documents, setDocuments] = useState<AlloTaxDoc[]>(initialDocuments);
  const [docName, setDocName] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // กดปุ่มแล้วเปิดหน้าต่างเลือกไฟล์ของ input ที่ซ่อนไว้
  function pickFile() {
    fileInputRef.current?.click();
  }

  // error ใต้ช่องชื่อเอกสาร และของไฟล์ที่เลือก
  const [docErrors, setDocErrors] = useState<formError<DocField | 'file'>>({});
  // แก้ไขชื่อเอกสาร
  const [editDoc, setEditDoc] = useState<AlloTaxDoc | null>(null);
  const [editDocName, setEditDocName] = useState('');
  const [editDocErrors, setEditDocErrors] = useState<formError<DocField>>({});

  // ชื่อเอกสารห้ามซ้ำกับเอกสารอื่น (ไม่นับตัวที่กำลังแก้ไข)
  const docNameSchema = (exceptId: string | null) =>
    extendSchema(docSchema, {
      document_name: [
        notDuplicate('ชื่อเอกสาร', documents.filter((d) => d.document_id !== exceptId).map((d) => d.document_name)),
      ],
    });

  // ตรวจชนิดและขนาดไฟล์ทันทีที่ผู้ใช้เลือก
  function onFileChosen(f: File | undefined | null) {
    if (!f) return;
    // ตรวจนามสกุลและขนาดทันทีที่เลือก ไม่ต้องรอกดเพิ่มเอกสาร
    const check = validateFile(f, DOC_FILE_RULE);
    if (!check.ok) {
      setDocErrors((prev) => ({ ...prev, file: check.message }));
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setDocErrors((prev) => ({ ...prev, file: undefined }));
    setPendingFile(f);
    if (!docName.trim()) setDocName(fileBaseName(f.name));
  }

  // ตรวจชื่อและไฟล์ อัปโหลดไฟล์ไป Storage แล้วบันทึกข้อมูลเอกสารลงตาราง
  async function handleAddDocument() {
    // เดิม alert ทีละข้อ -> ตรวจทั้งชื่อและไฟล์พร้อมกัน แล้วแสดงใต้ช่อง
    const errs: formError<DocField | 'file'> = {};
    const result = validateForm({ document_name: docName }, docNameSchema(null));
    if (!result.ok) errs.document_name = result.errors.document_name;
    if (!pendingFile) errs.file = 'กรุณาเลือกไฟล์ก่อน';
    else {
      const check = validateFile(pendingFile, DOC_FILE_RULE); // ตรวจซ้ำก่อนอัปโหลดจริง
      if (!check.ok) errs.file = check.message;
    }
    setDocErrors(errs);
    if (Object.keys(errs).length > 0 || !pendingFile) return;

    setUploading(true);

    // เดิมใช้ `${Date.now()}-${ชื่อไฟล์จริง}` ชื่อภาษาไทยทำให้อัปโหลดไม่ผ่าน
    const filePath = safeStorageName(pendingFile.name);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, pendingFile, { contentType: pendingFile.type || undefined });

    if (uploadError) {
      showError('อัปโหลดไฟล์ไม่สำเร็จ: ' + uploadError.message);
      setUploading(false);
      return;
    }

    // บันทึกผ่านฟังก์ชันกลาง (แปลง error ของ DB เป็นข้อความที่อ่านเข้าใจ)
    const created = await insertRecord<AlloTaxDoc>(
      'documents',
      { document_name: result.clean.document_name, file_path: filePath },
      '*',
      'บันทึกเอกสาร'
    );

    if (!created) {
      // roll back the uploaded object if the DB insert failed
      await supabase.storage.from(BUCKET).remove([filePath]);
      setUploading(false);
      return;
    }

    setDocuments((prev) => [...prev, created]);
    setDocName('');
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploading(false);
    showSaved('อัปโหลดเอกสารเรียบร้อยแล้ว'); // popup แจ้งบันทึกสำเร็จ (เหมือนฝั่งองค์กร)
  }

  // แก้ไขชื่อเอกสาร (ไฟล์เดิมคงไว้)
  function openEditDoc(doc: AlloTaxDoc) {
    setEditDoc(doc);
    setEditDocName(doc.document_name ?? '');
    setEditDocErrors({});
  }

  // บันทึกชื่อเอกสารที่แก้ไขลงตาราง
  async function handleSaveDocName(e: React.FormEvent) {
    e.preventDefault();
    if (!editDoc) return;
    const result = validateForm({ document_name: editDocName }, docNameSchema(editDoc.document_id));
    if (!result.ok) { setEditDocErrors(result.errors); return; }

    const updated = await updateRecord<AlloTaxDoc>(
      'documents', 'document_id', editDoc.document_id,
      { document_name: result.clean.document_name }, '*', 'แก้ไขชื่อเอกสาร'
    );
    if (!updated) return;
    setDocuments((prev) => prev.map((d) => (d.document_id === editDoc.document_id ? updated : d)));
    setEditDoc(null);
    showSaved();
  }

  // ลบข้อมูลเอกสารในตารางก่อน แล้วจึงลบไฟล์ใน Storage
  async function handleDeleteDocument(doc: AlloTaxDoc) {
    // ลบแถวใน DB ก่อน (ถามยืนยันใน deleteRecord) แล้วค่อยลบไฟล์
    // เดิมลบไฟล์ก่อน ถ้าลบแถวไม่ผ่าน (เช่น ไม่มีสิทธิ์) จะเหลือแถวที่ชี้ไปยังไฟล์ที่หายไปแล้ว
    const ok = await deleteRecord(
      'documents',
      'document_id',
      doc.document_id,
      `ลบเอกสาร "${doc.document_name ?? 'ไม่มีชื่อ'}"?`
    );
    if (!ok) return;

    if (doc.file_path && !/^https?:\/\//i.test(doc.file_path)) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([doc.file_path]);
      if (storageError) {
        // แถวถูกลบแล้ว ไฟล์ที่ค้างใน Storage ไม่กระทบการใช้งาน แค่แจ้งให้ทราบ
        showError('ลบเอกสารแล้ว แต่ลบไฟล์ใน Storage ไม่สำเร็จ: ' + dbErrorMessage(storageError));
      }
    }

    setDocuments((prev) => prev.filter((d) => d.document_id !== doc.document_id));
  }

  // หาลิงก์ของไฟล์: ลิงก์เว็บใช้ตามเดิม / ไฟล์ใน Storage ใช้ลิงก์ชั่วคราว 1 ชม. (bucket public ใช้ลิงก์ public แทน)
  async function getDocumentUrl(doc: AlloTaxDoc): Promise<string | null> {
    if (!doc.file_path) return null;
    if (/^https?:\/\//i.test(doc.file_path)) return doc.file_path;

    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) return data.signedUrl;

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(doc.file_path);
    return publicUrlData.publicUrl || null;
  }

  // [เพิ่ม] เปิดดูเอกสารในแท็บใหม่
  //   PDF เบราว์เซอร์เปิดได้เอง / DOCX, XLSX เบราว์เซอร์เปิดไม่ได้ (จะดาวน์โหลดแทน) จึงเปิดผ่าน Office Online Viewer
  async function handleViewDocument(doc: AlloTaxDoc) {
    // เปิดแท็บก่อนรอลิงก์ ไม่งั้นเบราว์เซอร์จะมองว่าเป็น popup แล้วบล็อก
    const tab = window.open('', '_blank');
    const url = await getDocumentUrl(doc);
    if (!url) {
      tab?.close();
      showError('ไม่พบไฟล์สำหรับเอกสารนี้');
      return;
    }
    const ext = fileExtension(doc.file_path ?? '').toLowerCase();
    const isOffice = ['docx', 'doc', 'xlsx', 'xls'].includes(ext);
    const viewUrl = isOffice
      ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`
      : url;
    if (tab) {
      tab.opener = null; // กันหน้าที่เปิดสั่งหน้านี้ได้ (แทน noopener)
      tab.location.href = viewUrl;
    } else {
      window.open(viewUrl, '_blank', 'noopener,noreferrer');
    }
  }

  // ดาวน์โหลดเอกสาร: ไฟล์ใน Storage โหลดมาเป็นไฟล์จริงแล้วบันทึกด้วยชื่อเอกสาร (เดิมแค่เปิดลิงก์ในแท็บใหม่ ซึ่งซ้ำกับการเปิดดู)
  async function handleDownloadDocument(doc: AlloTaxDoc) {
    if (!doc.file_path) return;

    if (/^https?:\/\//i.test(doc.file_path)) {
      window.open(doc.file_path, '_blank', 'noopener,noreferrer');
      return;
    }

    const { data, error } = await supabase.storage.from(BUCKET).download(doc.file_path);
    if (error || !data) {
      showError('ดาวน์โหลดไม่สำเร็จ: ' + (error?.message ?? 'ไม่ทราบสาเหตุ'));
      return;
    }
    const blobUrl = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = blobUrl;
    const ext = fileExtension(doc.file_path);
    a.download = `${doc.document_name ?? 'document'}${ext ? `.${ext}` : ''}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }

  return (
    <div className={T.page}>
      {/* Page Title */}
      <h1 className={T.h1}>
        เป้าหมาย, ต้นทุน &amp; เอกสารโครงการ
      </h1>

      {/* ---------------------------------------------------------------- */}
      {/* Section 1: เป้าหมายโครงการ (live / Supabase-backed: project_target_rule) */}
      {/* การ์ด/หัวข้อ/ตารางทุกส่วนใช้แบบหน้า T-VER Project (components/adminTable.ts) เอาจุดสีเขียวหน้าหัวข้อออก */}
      {/* ---------------------------------------------------------------- */}
      <section className={T.card}>
        <div className={T.cardHead}>
          <h2 className={T.h2}>
            เป้าหมายโครงการ
          </h2>
          <button
            type="button"
            onClick={() => openTargetModal()}
            className={T.addBtn}
          >
            + เพิ่มเป้าหมาย
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {targets.map((t) => (
            <div
              key={t.target_id}
              className="flex flex-col gap-4 rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-semibold text-[#1E293B]">
                  {t.target_name}
                </span>
                <div className="flex items-center gap-0.5 text-slate-400">
                  <button
                    type="button"
                    title="แก้ไข"
                    aria-label={`แก้ไข ${t.target_name}`}
                    onClick={() => openTargetModal(t)}
                    className="rounded p-1 hover:bg-slate-50 hover:text-blue-600"
                  >
                    <PencilIcon className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="ลบ"
                    aria-label={`ลบ ${t.target_name}`}
                    onClick={() => handleDeleteTarget(t)}
                    className="rounded p-1 hover:bg-slate-50 hover:text-red-500"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-[#475569]">
                    <span className="h-2 w-2 rounded-full bg-[#FF9D42]" />
                    ชดเชยตนเอง
                  </span>
                  <span className="font-semibold text-[#334155]">
                    {t.offset_ratio}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-[#475569]">
                    <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
                    ขายเชิงพาณิชย์
                  </span>
                  <span className="font-semibold text-[#334155]">
                    {t.sell_ratio}%
                  </span>
                </div>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                  <div className="h-full bg-[#FF9D42]" style={{ width: `${t.offset_ratio}%` }} />
                  <div className="h-full bg-[#CBD5E1]" style={{ width: `${t.sell_ratio}%` }} />
                </div>
              </div>
            </div>
          ))}
          {targets.length === 0 && (
            <p className={`${T.empty} col-span-3`}>ยังไม่มีเป้าหมายโครงการ</p>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Section 2: ต้นทุนโครงการ                                         */}
      {/* ---------------------------------------------------------------- */}
      <section className={T.card}>
        <div className={T.cardHead}>
          <h2 className={T.h2}>
            ต้นทุนโครงการ
          </h2>
        </div>
        <p className="mb-4 text-xs text-[#64748B]">
          ทุกรายการในตารางนี้จะถูกดึงไปเป็นค่าใช้จ่ายตั้งต้นในหน้าคำนวณภาษีขององค์กรโดยอัตโนมัติ (องค์กรแก้จำนวนเงินหรือลบออกได้)
          จึงควรใส่เฉพาะค่าที่ทุกโครงการต้องมี รายการเดียวต่อ 1 ค่าใช้จ่าย
        </p>

        <div className="flex flex-col gap-5">
          <form onSubmit={handleAddCost} className="flex items-start gap-4" noValidate>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-[#475569]">ชื่อรายการต้นทุน</label>
              <input
                value={costName}
                maxLength={150}
                onChange={(e) => setCostName(e.target.value)}
                placeholder="เช่น ค่าธรรมเนียม อบก., ค่าผู้ประเมินภายนอก VVB"
                className={`rounded-lg border px-3 py-2 text-xs text-[#334155] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#266955] ${costErrors.name ? 'border-red-500' : 'border-[#E2E8F0]'}`}
              />
              <FieldError message={costErrors.name} />
            </div>
            <div className="flex w-[180px] flex-col gap-1">
              <label className="text-xs text-[#475569]">ราคา (บาท)</label>
              {/* type="number" -> text + inputMode เพื่อให้พิมพ์เลขไทย/comma ได้ แล้ว normalize เอง */}
              <input
                type="text"
                inputMode="decimal"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
                className={`rounded-lg border px-3 py-2 text-xs text-[#334155] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#266955] ${costErrors.price ? 'border-red-500' : 'border-[#E2E8F0]'}`}
              />
              <FieldError message={costErrors.price} />
            </div>
            <div className="flex w-[120px] flex-col gap-1">
              <label className="text-xs text-[#475569]">VAT (%)</label>
              <Select
                value={costVat}
                onChange={(v) => setCostVat(Number(v))}
                className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#266955]"
                options={vatOptions.map((v) => ({ value: v, label: `${v}%` }))}
              />
            </div>
            <div className="flex w-[180px] flex-col gap-1">
              <label className="text-xs text-[#475569]">ราคาสุทธิคำนวณ</label>
              <div className="flex items-center justify-between rounded-lg border border-[#DCF0E8] bg-[#F0F9F6]/70 px-3 py-2">
                <span className="text-sm font-semibold text-[#346556]">
                  {netPreview.toFixed(2)}
                </span>
                <span className="text-[10px] text-[#64748B]">บาท</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={savingCost}
              className="btn btn-create mt-5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full"
              aria-label="เพิ่มรายการต้นทุน"
            >
              <PlusIcon className="h-3 w-3" />
            </button>
          </form>

          <div className={T.wrap}>
            <table className={T.table}>
              <thead className={T.thead}>
                <tr className={T.headRow}>
                  <th className={`${T.th} text-left`}>รายการต้นทุน</th>
                  <th className={`${T.th} text-right`}>ราคาฐาน (บาท)</th>
                  <th className={`${T.th} text-center`}>VAT</th>
                  <th className={`${T.th} text-right`}>ราคาสุทธิ (บาท)</th>
                  <th className={`${T.th} text-right`}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={c.cost_id} className={T.row}>
                    <td className={T.tdMain}>{c.cost_name}</td>
                    <td className={`${T.td} text-right`}>
                      {c.price.toFixed(2)}
                    </td>
                    <td className={`${T.td} text-center`}>
                      {c.vat > 0 ? `${c.vat}%` : '—'}
                    </td>
                    <td className={`${T.td} text-right font-semibold text-[#346556]`}>
                      {c.net_price.toFixed(2)}
                    </td>
                    <td className={T.tdActions}>
                      {/* ปุ่มแก้ไข + ลบ แบบเดียวกับตารางอื่นของแอดมิน */}
                      <RowActions onEdit={() => openEditCost(c)} onDelete={() => handleDeleteCost(c)} />
                    </td>
                  </tr>
                ))}
                {costs.length === 0 && (
                  <tr>
                    <td colSpan={5} className={T.empty}>
                      ยังไม่มีรายการต้นทุน
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Section 3: เอกสารโครงการ (live / Supabase-backed)                */}
      {/* ---------------------------------------------------------------- */}
      <section className={T.card}>
        <div className={T.cardHead}>
          <h2 className={T.h2}>
            เอกสารโครงการ
          </h2>
        </div>

        <div className="flex gap-6">
          {/* Left: name + upload zone */}
          <div className="flex w-[320px] shrink-0 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#475569]">ชื่อเอกสาร</label>
              <input
                value={docName}
                maxLength={255}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="เช่น รายงานการตรวจสอบความใช้ได้"
                className={`rounded-lg border px-3 py-2 text-xs text-[#334155] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#266955] ${docErrors.document_name ? 'border-red-500' : 'border-[#E2E8F0]'}`}
              />
              <FieldError message={docErrors.document_name} />
            </div>

            <div
              onClick={pickFile}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                onFileChosen(e.dataTransfer.files?.[0]);
              }}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-5 py-5 text-center transition-colors ${
                isDragging ? 'border-[#549C83] bg-[#F0F9F6]' : 'border-[#CBD5E1] bg-white'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx"
                className="hidden"
                onChange={(e) => onFileChosen(e.target.files?.[0])}
              />
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0F9F6]">
                <UploadCloudIcon className="h-4 w-4 text-[#549C83]" />
              </span>
              <span className="text-xs font-bold text-[#334155]">
                คลิกหรือลากไฟล์มาวางที่นี่
              </span>
              <span className="text-[11px] text-[#94A3B8]">
                {pendingFile ? pendingFile.name : 'รองรับ PDF, DOCX, XLSX (สูงสุด 25MB)'}
              </span>
            </div>
            <FieldError message={docErrors.file} />

            <button
              type="button"
              disabled={uploading}
              onClick={handleAddDocument}
              className="btn btn-create flex items-center justify-center gap-1 self-center rounded-full px-4 py-1.5 text-sm font-semibold"
            >
              <PlusIcon className="h-2.5 w-2.5" />
              {uploading ? 'กำลังอัปโหลด...' : 'เพิ่มเอกสาร'}
            </button>
          </div>

          {/* Right: documents list
              [แก้ไข] เดิมเป็นการ์ดตัวเล็ก ไอคอน 12px สีจาง -> ตารางแบบเดียวกับหน้าอื่น ไอคอนขนาดเดียวกับ RowActions
              ป้ายชนิดไฟล์สีเดียวกับหน้าเอกสารฝั่งองค์กร และเพิ่มปุ่มเปิดดู */}
          <div className={`${T.wrap} flex-1`}>
            <table className={T.table}>
              <thead className={T.thead}>
                <tr className={T.headRow}>
                  <th className={`${T.th} text-left`}>ชื่อเอกสาร</th>
                  <th className={`${T.th} text-right`}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 && (
                  <tr>
                    <td colSpan={2} className={T.empty}>
                      ยังไม่มีเอกสารที่อัปโหลด
                    </td>
                  </tr>
                )}
                {documents.map((doc) => {
                  const badge = fileBadge(doc.file_path);
                  return (
                    <tr key={doc.document_id} className={T.row}>
                      <td className={T.tdMain}>
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold text-white ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                          <span>{doc.document_name ?? 'ไม่มีชื่อเอกสาร'}</span>
                        </div>
                      </td>
                      <td className={T.tdActions}>
                        <span className="inline-flex items-center gap-3 align-middle">
                          <button
                            type="button"
                            onClick={() => handleViewDocument(doc)}
                            title="เปิดดู"
                            aria-label="เปิดดู"
                            className="text-[#64748B] transition-colors hover:text-[#32885F]"
                          >
                            <EyeIcon />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadDocument(doc)}
                            title="ดาวน์โหลด"
                            aria-label="ดาวน์โหลด"
                            className="text-[#64748B] transition-colors hover:text-[#32885F]"
                          >
                            <DownloadIcon />
                          </button>
                          {/* แก้ไขชื่อ + ลบ ใช้ปุ่มกลางเหมือนตารางอื่น */}
                          <RowActions onEdit={() => openEditDoc(doc)} onDelete={() => handleDeleteDocument(doc)} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Modal เพิ่ม/แก้ไขเป้าหมายโครงการ */}
      {showTargetModal && (
        <ModalShell onClose={closeTargetModal}>
          <form onSubmit={handleSaveTarget} className="space-y-4" noValidate>
            <h3 className="text-lg font-bold">{editTargetId ? 'แก้ไขเป้าหมาย' : 'เพิ่มเป้าหมายใหม่'}</h3>
            <div>
              <label className="mb-1 block text-xs text-[#475569]">ชื่อเป้าหมาย</label>
              <input
                className={inputClass(!!targetErrors.target_name)}
                placeholder="เช่น Net Zero"
                maxLength={100}
                value={targetForm.target_name}
                onChange={(e) => setTargetForm({ ...targetForm, target_name: e.target.value })}
              />
              <FieldError message={targetErrors.target_name} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-[#475569]">ชดเชยตนเอง (%)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={inputClass(!!targetErrors.offset_ratio)}
                  placeholder="0 - 100"
                  value={targetForm.offset_ratio}
                  onChange={(e) => setTargetForm({ ...targetForm, offset_ratio: e.target.value })}
                />
                <FieldError message={targetErrors.offset_ratio} />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-[#475569]">ขายเชิงพาณิชย์ (%)</label>
                {/* คำนวณอัตโนมัติ = 100 - ชดเชย กรอกเองไม่ได้ */}
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#334155]">
                  {sellPreview === null ? '—' : sellPreview}
                </div>
              </div>
            </div>
            <p className="text-xs text-[#6F7974]">
              สัดส่วนชดเชยกับขายรวมกันต้องเท่ากับ 100% การแก้ไขมีผลกับการจัดสรรครั้งถัดไป
              องค์กรที่จัดสรรด้วยเป้าหมายนี้ไว้แล้วจะต้องกดบันทึกการจัดสรรใหม่เพื่อใช้สัดส่วนที่แก้
            </p>
            <ModalActions onCancel={closeTargetModal} />
          </form>
        </ModalShell>
      )}

      {/* Modal แก้ไขรายการต้นทุน */}
      {editCost && (
        <ModalShell onClose={() => setEditCost(null)}>
          <form onSubmit={handleSaveCost} className="space-y-4" noValidate>
            <h3 className="text-lg font-bold">แก้ไขรายการต้นทุน</h3>
            <div>
              <label className="mb-1 block text-xs text-[#475569]">ชื่อรายการต้นทุน</label>
              <input
                className={inputClass(!!editCostErrors.name)}
                maxLength={150}
                value={editCostName}
                onChange={(e) => setEditCostName(e.target.value)}
              />
              <FieldError message={editCostErrors.name} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-[#475569]">ราคา (บาท)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className={inputClass(!!editCostErrors.price)}
                  value={editCostPrice}
                  onChange={(e) => setEditCostPrice(e.target.value)}
                />
                <FieldError message={editCostErrors.price} />
              </div>
              <div className="w-28">
                <label className="mb-1 block text-xs text-[#475569]">VAT (%)</label>
                <Select
                  className={inputClass(false)}
                  value={editCostVat}
                  onChange={(v) => setEditCostVat(Number(v))}
                  options={vatOptions.map((v) => ({ value: v, label: `${v}%` }))}
                />
              </div>
            </div>
            <p className="text-sm text-[#475569]">
              ราคาสุทธิ: <span className="font-semibold text-[#346556]">{editNetPreview.toFixed(2)}</span> บาท
            </p>
            <ModalActions onCancel={() => setEditCost(null)} />
          </form>
        </ModalShell>
      )}

      {/* Modal แก้ไขชื่อเอกสาร */}
      {editDoc && (
        <ModalShell onClose={() => setEditDoc(null)}>
          <form onSubmit={handleSaveDocName} className="space-y-4" noValidate>
            <h3 className="text-lg font-bold">แก้ไขชื่อเอกสาร</h3>
            <div>
              <input
                className={`w-full border rounded-lg px-3 py-2 text-sm ${editDocErrors.document_name ? 'border-red-500' : ''}`}
                maxLength={255}
                value={editDocName}
                onChange={(e) => setEditDocName(e.target.value)}
              />
              <FieldError message={editDocErrors.document_name} />
            </div>
            <ModalActions onCancel={() => setEditDoc(null)} />
          </form>
        </ModalShell>
      )}
    </div>
  );
}