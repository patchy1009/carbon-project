// หน้าจัดการเอกสารภาษีของแอดมิน: อัปโหลด แก้ชื่อ ลบ และดาวน์โหลดเอกสาร
'use client';

import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AlloTaxDoc } from '@/types/allotaxdoc';
import { ModalActions, ModalShell } from '@/components/Modal';
import { dbErrorMessage, deleteRecord, insertRecord, updateRecord } from '@/lib/supabaseCrud';
import { validateForm, extendSchema, notDuplicate, validateFile, type formError } from '@/lib/validation';
import { normalizeToArabicNumber, safeStorageName, fileBaseName, fileExtension } from '@/lib/normalization';
import FieldError from '@/components/FieldError';
import { docSchema, costSchema, DOC_FILE_RULE, type DocField, type CostField } from './schema';
import { showError } from '@/lib/dialog'; // กล่องแจ้งเตือนกลางแทน alert
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
 * 7) ต้นทุนโครงการ: แก้ไขรายการได้ (popup ใช้กฎตรวจเดียวกับตอนเพิ่ม) — ยังเก็บในหน้าจอเท่านั้น ไม่มีตารางใน DB
 * 8) เอกสาร: แสดงเป็นตารางแบบหน้าอื่น ไอคอนขนาด/สีเดียวกับ RowActions เพิ่มปุ่มเปิดดู (PDF เปิดในเบราว์เซอร์,
 *    DOCX/XLSX เปิดผ่าน Office Online Viewer) และปุ่มดาวน์โหลดโหลดไฟล์จริงแทนการเปิดแท็บ */

/**
 * Storage bucket that uploaded project documents are stored in.
 */
const BUCKET = 'documents';

/* ไอคอนที่เคยเขียนไว้ในไฟล์นี้ ย้ายไปไว้ที่ components/icons.tsx (ใช้ร่วมกันทุกหน้า) */

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatFileSize(bytes: number) {
  if (!bytes) return '0 KB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${Math.max(1, Math.round(kb))} KB`;
}

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
/*  Static section data (Project Targets / Project Cost are not backed by a  */
/*  Supabase table yet — wire them up the same way the documents section is  */
/*  wired up once you have tables for them).                                 */
/* -------------------------------------------------------------------------- */

type Target = {
  id: string;
  name: string;
  selfOffsetPct: number; // ชดเชยตนเอง
  commercialPct: number; // ขายเชิงพาณิชย์
};

const initialTargets: Target[] = [
  { id: 't1', name: 'Net Zero', selfOffsetPct: 60, commercialPct: 40 },
  { id: 't2', name: 'Carbon Neutrality', selfOffsetPct: 80, commercialPct: 20 },
  { id: 't3', name: 'Selling', selfOffsetPct: 30, commercialPct: 70 },
];

type CostItem = {
  id: string;
  name: string;
  basePrice: number;
  vatPct: number | null; // null = ไม่มี VAT
};

const initialCosts: CostItem[] = [
  { id: 'c1', name: 'ค่าขึ้นทะเบียนโครงการ T-VER', basePrice: 5000, vatPct: 7 },
  { id: 'c2', name: 'ขอรับรองคาร์บอนเครดิต', basePrice: 3000, vatPct: 7 },
  { id: 'c3', name: 'ค่าจ้างผู้ประเมินภายนอกอิสระ (VVB Inspection)', basePrice: 20000, vatPct: null },
];

const vatOptions = [0, 7];

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function AlloTaxDocClient({
  initialDocuments,
}: {
  initialDocuments: AlloTaxDoc[];
}) {
  /* ---- Section 1: Project Targets (static/local) ---- */
  const [targets] = useState<Target[]>(initialTargets);

  /* ---- Section 2: Project Cost (static/local) ---- */
  const [costs, setCosts] = useState<CostItem[]>(initialCosts);
  const [costName, setCostName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [costVat, setCostVat] = useState<number>(7);
  const [costErrors, setCostErrors] = useState<formError<CostField>>({});

  // เดิมใช้ Number(costPrice) ซึ่งรับเลขไทย/comma ไม่ได้ -> ใช้ normalizeToArabicNumber
  const previewBase = normalizeToArabicNumber(costPrice);
  const netPreview = previewBase !== null && previewBase >= 0 ? previewBase * (1 + costVat / 100) : 0;

  // ตรวจข้อมูลรายการค่าใช้จ่าย ถ้าถูกต้องจึงเพิ่มเข้ารายการ
  function handleAddCost(e: React.FormEvent) {
    e.preventDefault();
    // เดิมเช็กแค่ว่าง และไม่บอกผู้ใช้ว่าผิดตรงไหน -> ใช้ schema + ห้ามชื่อซ้ำ
    const result = validateForm(
      { name: costName, price: costPrice },
      extendSchema(costSchema, { name: [notDuplicate('ชื่อรายการต้นทุน', costs.map((c) => c.name))] })
    );
    if (!result.ok) { setCostErrors(result.errors); return; }
    setCostErrors({});
    if (!vatOptions.includes(costVat)) return; // VAT ต้องเป็นค่าที่มีในตัวเลือกเท่านั้น

    setCosts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: result.clean.name,
        basePrice: normalizeToArabicNumber(result.clean.price) ?? 0,
        vatPct: costVat,
      },
    ]);
    setCostName('');
    setCostPrice('');
    setCostVat(7);
  }

  // เอารายการค่าใช้จ่ายออกจากรายการบนหน้า
  function handleDeleteCost(id: string) {
    setCosts((prev) => prev.filter((c) => c.id !== id));
  }

  // [เพิ่ม] แก้ไขรายการต้นทุน (ชื่อ ราคา VAT) ผ่าน popup ใช้กฎตรวจชุดเดียวกับตอนเพิ่ม
  const [editCost, setEditCost] = useState<CostItem | null>(null);
  const [editCostName, setEditCostName] = useState('');
  const [editCostPrice, setEditCostPrice] = useState('');
  const [editCostVat, setEditCostVat] = useState<number>(7);
  const [editCostErrors, setEditCostErrors] = useState<formError<CostField>>({});

  const editBase = normalizeToArabicNumber(editCostPrice);
  const editNetPreview = editBase !== null && editBase >= 0 ? editBase * (1 + editCostVat / 100) : 0;

  function openEditCost(c: CostItem) {
    setEditCost(c);
    setEditCostName(c.name);
    setEditCostPrice(String(c.basePrice));
    setEditCostVat(c.vatPct ?? 0);
    setEditCostErrors({});
  }

  function handleSaveCost(e: React.FormEvent) {
    e.preventDefault();
    if (!editCost) return;
    // ชื่อห้ามซ้ำกับรายการอื่น (ไม่นับรายการที่กำลังแก้)
    const result = validateForm(
      { name: editCostName, price: editCostPrice },
      extendSchema(costSchema, {
        name: [notDuplicate('ชื่อรายการต้นทุน', costs.filter((c) => c.id !== editCost.id).map((c) => c.name))],
      })
    );
    if (!result.ok) { setEditCostErrors(result.errors); return; }
    if (!vatOptions.includes(editCostVat)) return;

    setCosts((prev) =>
      prev.map((c) =>
        c.id === editCost.id
          ? {
              ...c,
              name: result.clean.name,
              basePrice: normalizeToArabicNumber(result.clean.price) ?? 0,
              vatPct: editCostVat,
            }
          : c
      )
    );
    setEditCost(null);
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
      {/* Section 1: เป้าหมายโครงการ                                       */}
      {/* การ์ด/หัวข้อ/ตารางทุกส่วนใช้แบบหน้า T-VER Project (components/adminTable.ts) เอาจุดสีเขียวหน้าหัวข้อออก */}
      {/* ---------------------------------------------------------------- */}
      <section className={T.card}>
        <div className={T.cardHead}>
          <h2 className={T.h2}>
            เป้าหมายโครงการ
          </h2>
          <button
            type="button"
            className={T.addBtn}
          >
            + เพิ่มเป้าหมาย
          </button>
        </div>

        <div className="flex gap-4">
          {targets.map((t) => (
            <div
              key={t.id}
              className="flex w-1/3 flex-col gap-4 rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-semibold text-[#1E293B]">
                  {t.name}
                </span>
                <div className="flex items-center gap-0.5 text-slate-400">
                  <button type="button" className="rounded p-1 hover:bg-slate-50 hover:text-blue-600">
                    <PencilIcon className="h-3 w-3" />
                  </button>
                  <button type="button" className="rounded p-1 hover:bg-slate-50 hover:text-red-500">
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
                    {t.selfOffsetPct}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-[#475569]">
                    <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
                    ขายเชิงพาณิชย์
                  </span>
                  <span className="font-semibold text-[#334155]">
                    {t.commercialPct}%
                  </span>
                </div>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                  <div className="h-full bg-[#FF9D42]" style={{ width: `${t.selfOffsetPct}%` }} />
                  <div className="h-full bg-[#CBD5E1]" style={{ width: `${t.commercialPct}%` }} />
                </div>
              </div>
            </div>
          ))}
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

        <div className="flex flex-col gap-5">
          <form onSubmit={handleAddCost} className="flex items-start gap-4" noValidate>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-[#475569]">ชื่อรายการต้นทุน</label>
              <input
                value={costName}
                maxLength={150}
                onChange={(e) => setCostName(e.target.value)}
                placeholder="เช่น ค่าตรวจประเมิน VVB, ค่ากล้าไม้"
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
              <select
                value={costVat}
                onChange={(e) => setCostVat(Number(e.target.value))}
                className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#266955]"
              >
                {vatOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}%
                  </option>
                ))}
              </select>
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
              className="btn btn-create mt-5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg"
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
                {costs.map((c) => {
                  const net = c.basePrice * (1 + (c.vatPct ?? 0) / 100);
                  return (
                    <tr key={c.id} className={T.row}>
                      <td className={T.tdMain}>{c.name}</td>
                      <td className={`${T.td} text-right`}>
                        {c.basePrice.toFixed(2)}
                      </td>
                      <td className={`${T.td} text-center`}>
                        {c.vatPct !== null ? `${c.vatPct}%` : '—'}
                      </td>
                      <td className={`${T.td} text-right font-semibold text-[#346556]`}>
                        {net.toFixed(2)}
                      </td>
                      <td className={T.tdActions}>
                        {/* [เพิ่ม] ปุ่มแก้ไข + ลบ แบบเดียวกับตารางอื่นของแอดมิน */}
                        <RowActions onEdit={() => openEditCost(c)} onDelete={() => handleDeleteCost(c.id)} />
                      </td>
                    </tr>
                  );
                })}
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
              className="btn btn-create flex items-center justify-center gap-1.5 self-start rounded-lg px-3 py-2 text-xs"
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

      {/* [เพิ่ม] Modal แก้ไขรายการต้นทุน */}
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
                <select
                  className={inputClass(false)}
                  value={editCostVat}
                  onChange={(e) => setEditCostVat(Number(e.target.value))}
                >
                  {vatOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}%
                    </option>
                  ))}
                </select>
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