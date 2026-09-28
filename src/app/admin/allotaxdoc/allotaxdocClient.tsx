'use client';

import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AlloTaxDoc } from '@/types/allotaxdoc';

/**
 * Storage bucket that uploaded project documents are stored in.
 */
const BUCKET = 'documents';

/* -------------------------------------------------------------------------- */
/*  Small inline icons (kept dependency-free)                                 */
/* -------------------------------------------------------------------------- */

function PencilIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M11.3 2.3a1.5 1.5 0 0 1 2.1 2.1L5 12.8l-2.8.7.7-2.8 8.4-8.4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M2.5 4.5h11M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M6.8 7.5v4M9.2 7.5v4M3.5 4.5l.6 8a1 1 0 0 0 1 .9h5.8a1 1 0 0 0 1-.9l.6-8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M8 2v8m0 0 3-3M8 10 5 7M3 13h10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" className={className}>
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 16" fill="none" className={className}>
      <path
        d="M2 1.5h6L12 5.5V14a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 2 14V1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M8 1.5V5h4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function UploadCloudIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 18" fill="none" className={className}>
      <path
        d="M6.5 17A4.5 4.5 0 0 1 5.4 8.1 5.5 5.5 0 0 1 16.2 6.6 4 4 0 0 1 17.5 17H6.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M12 14V8m0 0-2.4 2.4M12 8l2.4 2.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

function extOf(name: string) {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()!.toUpperCase() : '';
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

  const netPreview =
    costPrice && !Number.isNaN(Number(costPrice))
      ? Number(costPrice) * (1 + costVat / 100)
      : 0;

  function handleAddCost(e: React.FormEvent) {
    e.preventDefault();
    if (!costName.trim() || !costPrice) return;
    const base = Number(costPrice);
    setCosts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: costName.trim(),
        basePrice: base,
        vatPct: costVat,
      },
    ]);
    setCostName('');
    setCostPrice('');
    setCostVat(7);
  }

  function handleDeleteCost(id: string) {
    setCosts((prev) => prev.filter((c) => c.id !== id));
  }

  /* ---- Section 3: Project Documents (live, backed by Supabase) ---- */
  const [documents, setDocuments] = useState<AlloTaxDoc[]>(initialDocuments);
  const [docName, setDocName] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFile() {
    fileInputRef.current?.click();
  }

  function onFileChosen(f: File | undefined | null) {
    if (!f) return;
    setPendingFile(f);
    if (!docName.trim()) setDocName(f.name.replace(/\.[^/.]+$/, ''));
  }

  async function handleAddDocument() {
    if (!pendingFile) {
      alert('กรุณาเลือกไฟล์ก่อน');
      return;
    }
    if (!docName.trim()) {
      alert('กรุณาระบุชื่อเอกสาร');
      return;
    }

    setUploading(true);

    const filePath = `${Date.now()}-${pendingFile.name}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, pendingFile);

    if (uploadError) {
      alert('อัปโหลดไฟล์ไม่สำเร็จ: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data, error } = await supabase
      .from('documents')
      .insert({
        document_name: docName.trim(),
        file_path: filePath,
      })
      .select()
      .single();

    if (error) {
      // roll back the uploaded object if the DB insert failed
      await supabase.storage.from(BUCKET).remove([filePath]);
      alert('บันทึกเอกสารไม่สำเร็จ: ' + error.message);
      setUploading(false);
      return;
    }

    setDocuments((prev) => [...prev, data as AlloTaxDoc]);
    setDocName('');
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploading(false);
  }

  async function handleDeleteDocument(doc: AlloTaxDoc) {
    if (!confirm(`ลบเอกสาร "${doc.document_name ?? 'ไม่มีชื่อ'}"?`)) return;

    if (doc.file_path && !/^https?:\/\//i.test(doc.file_path)) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([doc.file_path]);
      if (storageError) {
        alert('ลบไฟล์ไม่สำเร็จ: ' + storageError.message);
        return;
      }
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('document_id', doc.document_id);
    if (error) {
      alert('ลบเอกสารไม่สำเร็จ: ' + error.message);
      return;
    }

    setDocuments((prev) => prev.filter((d) => d.document_id !== doc.document_id));
  }

  async function handleDownloadDocument(doc: AlloTaxDoc) {
    if (!doc.file_path) return;

    if (/^https?:\/\//i.test(doc.file_path)) {
      window.open(doc.file_path, '_blank', 'noopener,noreferrer');
      return;
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.file_path, 3600);

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // A public bucket may reject signed URLs while still exposing a public URL.
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(doc.file_path);

    if (publicUrlData.publicUrl) {
      window.open(publicUrlData.publicUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    alert('เปิดเอกสารไม่สำเร็จ: ' + (error?.message ?? 'ไม่พบลิงก์เอกสาร'));
  }

  return (
    <div className="flex max-w-[1152px] flex-col gap-4 px-6 py-8">
      {/* Page Title */}
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 pt-8">
        <h1 className="font-['Be_Vietnam_Pro'] text-[32px] font-bold leading-[32px] text-[#1E293B]">
          เป้าหมาย, ต้นทุน &amp; เอกสารโครงการ
        </h1>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Section 1: เป้าหมายโครงการ                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-['Be_Vietnam_Pro'] text-xl font-bold text-[#1E293B]">
            <span className="h-[6px] w-[7px] rounded-full bg-[#266955]" />
            เป้าหมายโครงการ
          </h2>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-[#266955] px-4 py-2 text-xs text-white shadow-sm hover:bg-[#1f5747]"
          >
            <PlusIcon className="h-2.5 w-2.5" />
            เพิ่มเป้าหมาย
          </button>
        </div>

        <div className="flex gap-4">
          {targets.map((t) => (
            <div
              key={t.id}
              className="flex w-1/3 flex-col gap-4 rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <span className="font-['Be_Vietnam_Pro'] text-sm font-semibold text-[#1E293B]">
                  {t.name}
                </span>
                <div className="flex items-center gap-0.5 text-slate-400">
                  <button type="button" className="rounded p-1 hover:bg-slate-50 hover:text-slate-600">
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
                  <span className="font-['Be_Vietnam_Pro'] font-semibold text-[#334155]">
                    {t.selfOffsetPct}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-[#475569]">
                    <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
                    ขายเชิงพาณิชย์
                  </span>
                  <span className="font-['Be_Vietnam_Pro'] font-semibold text-[#334155]">
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
      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 font-['Be_Vietnam_Pro'] text-xl font-bold text-[#1E293B]">
          <span className="h-[6px] w-[7px] rounded-full bg-[#266955]" />
          ต้นทุนโครงการ
        </h2>

        <div className="flex flex-col gap-5 rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <form onSubmit={handleAddCost} className="flex items-end gap-4">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-[#475569]">ชื่อรายการต้นทุน</label>
              <input
                value={costName}
                onChange={(e) => setCostName(e.target.value)}
                placeholder="เช่น ค่าตรวจประเมิน VVB, ค่ากล้าไม้"
                className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs text-[#334155] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#266955]"
              />
            </div>
            <div className="flex w-[180px] flex-col gap-1">
              <label className="text-xs text-[#475569]">ราคา (บาท)</label>
              <input
                type="number"
                min={0}
                step="any"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
                className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs text-[#334155] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#266955]"
              />
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
                <span className="font-['Be_Vietnam_Pro'] text-sm font-semibold text-[#346556]">
                  {netPreview.toFixed(2)}
                </span>
                <span className="text-[10px] text-[#64748B]">บาท</span>
              </div>
            </div>
            <button
              type="submit"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-[#266955] text-white shadow-sm hover:bg-[#1f5747]"
              aria-label="เพิ่มรายการต้นทุน"
            >
              <PlusIcon className="h-3 w-3" />
            </button>
          </form>

          <div className="border-t border-[#F1F5F9] pt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#94A3B8]">
                  <th className="px-3 py-2 text-left font-normal">รายการต้นทุน</th>
                  <th className="px-3 py-2 text-right font-normal">ราคาฐาน (บาท)</th>
                  <th className="px-3 py-2 text-center font-normal">VAT</th>
                  <th className="px-3 py-2 text-right font-normal">ราคาสุทธิ (บาท)</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => {
                  const net = c.basePrice * (1 + (c.vatPct ?? 0) / 100);
                  return (
                    <tr key={c.id} className="border-t border-[#F1F5F9]">
                      <td className="px-3 py-3 text-[#1E293B]">{c.name}</td>
                      <td className="px-3 py-3 text-right text-[#475569]">
                        {c.basePrice.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-center text-[#64748B]">
                        {c.vatPct !== null ? `${c.vatPct}%` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-[#346556]">
                        {net.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteCost(c.id)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {costs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[#94A3B8]">
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
      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 font-['Be_Vietnam_Pro'] text-xl font-bold text-[#1E293B]">
          <span className="h-[6px] w-[7px] rounded-full bg-[#266955]" />
          เอกสารโครงการ
        </h2>

        <div className="flex gap-6">
          {/* Left: name + upload zone */}
          <div className="flex w-[320px] shrink-0 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#475569]">ชื่อเอกสาร</label>
              <input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="เช่น รายงานการตรวจสอบความใช้ได้"
                className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs text-[#334155] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#266955]"
              />
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
                className="hidden"
                onChange={(e) => onFileChosen(e.target.files?.[0])}
              />
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0F9F6]">
                <UploadCloudIcon className="h-4 w-4 text-[#549C83]" />
              </span>
              <span className="font-['Be_Vietnam_Pro'] text-xs font-bold text-[#334155]">
                คลิกหรือลากไฟล์มาวางที่นี่
              </span>
              <span className="text-[11px] text-[#94A3B8]">
                {pendingFile ? pendingFile.name : 'รองรับ PDF, DOCX, XLSX (สูงสุด 25MB)'}
              </span>
            </div>

            <button
              type="button"
              disabled={uploading}
              onClick={handleAddDocument}
              className="flex items-center justify-center gap-1.5 self-start rounded-lg border border-[#BCE2D4]/60 bg-[#3C6E5C] px-3 py-2 text-xs text-white shadow-sm hover:bg-[#33604F] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlusIcon className="h-2.5 w-2.5" />
              {uploading ? 'กำลังอัปโหลด...' : 'เพิ่มเอกสาร'}
            </button>
          </div>

          {/* Right: documents list */}
          <div className="flex flex-1 flex-col gap-2.5">
            {documents.length === 0 && (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-xs text-[#94A3B8]">
                ยังไม่มีเอกสารที่อัปโหลด
              </div>
            )}

            {documents.map((doc) => (
              <div
                key={doc.document_id}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#64748B]">
                    <FileIcon className="h-3.5 w-4" />
                  </span>
                  <div className="flex flex-col">
                    <span className="font-['Be_Vietnam_Pro'] text-[11px] font-bold text-[#1E293B]">
                      {doc.document_name ?? 'ไม่มีชื่อเอกสาร'}
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">
                      {doc.file_path && !/^https?:\/\//i.test(doc.file_path)
                        ? `${extOf(doc.file_path) || 'FILE'} • ไฟล์ในระบบ`
                        : 'ลิงก์เอกสาร'}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDownloadDocument(doc)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                    aria-label="ดาวน์โหลด"
                  >
                    <DownloadIcon className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDocument(doc)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-red-500"
                    aria-label="ลบ"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}