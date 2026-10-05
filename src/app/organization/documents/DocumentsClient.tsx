'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { DocumentItem } from '@/types/documents';

function getFileType(filePath: string | null): { label: string; color: string } {
  const ext = filePath?.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
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

function formatThaiDate(dateStr: string): string {
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export default function DocumentsClient({ documents }: { documents: DocumentItem[] }) {
  // เก็บว่าแถวไหนกำลังโหลดดาวน์โหลดอยู่ (กันกดซ้ำ + โชว์สถานะ)
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // ----- เปิดดูไฟล์ (preview ในแท็บใหม่) -----
  function handleView(doc: DocumentItem) {
    if (!doc.file_path) {
      alert('ไม่พบไฟล์สำหรับเอกสารนี้');
      return;
    }
    const { data } = supabase.storage.from('documents').getPublicUrl(doc.file_path);
    if (!data?.publicUrl) {
      alert('ไม่สามารถเปิดไฟล์ได้ในขณะนี้');
      return;
    }
    window.open(data.publicUrl, '_blank', 'noopener,noreferrer');

    // ถ้า bucket เป็น private ให้ใช้โค้ดนี้แทนด้านบน:
    // const { data, error } = await supabase.storage
    //   .from('documents')
    //   .createSignedUrl(doc.file_path, 60);
    // if (error || !data?.signedUrl) return alert('เปิดไฟล์ไม่สำเร็จ: ' + error?.message);
    // window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  // ----- บังคับดาวน์โหลดไฟล์จริง -----
  async function handleDownload(doc: DocumentItem) {
    if (!doc.file_path) {
      alert('ไม่พบไฟล์สำหรับเอกสารนี้');
      return;
    }

    setDownloadingId(doc.document_id);

    const { data, error } = await supabase.storage
      .from('documents')
      .download(doc.file_path); // ดึงไฟล์มาเป็น Blob จริงๆ ไม่ใช่แค่ลิงก์

    setDownloadingId(null);

    if (error || !data) {
      alert('ดาวน์โหลดไม่สำเร็จ: ' + (error?.message ?? 'ไม่ทราบสาเหตุ'));
      return;
    }

    // สร้างลิงก์ชั่วคราวในหน่วยความจำเบราว์เซอร์ แล้วสั่งคลิกเพื่อเซฟไฟล์
    const blobUrl = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = doc.document_name ?? doc.file_path.split('/').pop() ?? 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl); // คืนหน่วยความจำ
  }

  return (
    <div className="max-w-[1104px] mx-auto px-8 py-8">
      <div className="mb-8">
        <h1 className="text-[32px] font-medium text-black">เอกสารที่เกี่ยวข้อง</h1>
        <p className="text-base font-medium text-[#6B7280]">
          รวมแบบฟอร์มเอกสารที่เกี่ยวข้องกับการปล่อยก๊าซเรือนกระจก (Emission Factor)
          สำหรับคาร์บอนฟุตพรินต์และคาร์บอนเครดิต
        </p>
      </div>

      <div className="bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.05)] rounded-[24px] overflow-hidden">
        <div className="flex items-center gap-3 bg-[rgba(249,250,251,0.5)] border-b border-[#F3F4F6] px-6 py-6">
          <span className="w-8 h-8 rounded-full bg-[#E6F4EA] flex items-center justify-center">
            📄
          </span>
          <div>
            <h2 className="text-base font-bold text-[#111827]">เอกสารทั้งหมด</h2>
            <p className="text-xs text-[#6B7280]">{documents.length} เอกสาร</p>
          </div>
        </div>

        <div>
          {documents.length === 0 && (
            <p className="px-6 py-8 text-center text-sm text-[#6B7280]">
              ยังไม่มีเอกสารในระบบ
            </p>
          )}
          {documents.map((doc, idx) => {
            const fileType = getFileType(doc.file_path);
            const isDownloading = downloadingId === doc.document_id;
            return (
              <div
                key={doc.document_id}
                className={`flex items-center justify-between px-6 py-4 ${
                  idx > 0 ? 'border-t border-[#F3F4F6]' : ''
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <span
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-semibold ${fileType.color}`}
                  >
                    {fileType.label}
                  </span>
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-[#1F2937]">
                      {doc.document_name}
                    </h4>
                    <div className="flex items-center gap-1 text-xs text-[#9CA3AF]">
                      📅 {formatThaiDate(doc.upload_date)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleView(doc)}
                    className="flex items-center gap-1.5 border border-[#21258f] rounded-full px-4 py-2 text-[#374151] text-xs font-medium hover:bg-[#e6e6ff] transition"
                  >
                    👁 ดูไฟล์
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={isDownloading}
                    className="flex items-center gap-1.5 bg-[#21258f] shadow-sm rounded-full px-4 py-2 text-white text-xs font-medium disabled:opacity-60"
                  >
                    {isDownloading ? 'กำลังโหลด...' : '⬇ ดาวน์โหลด'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}