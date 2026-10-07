'use client';

import React from 'react';
import { FileText, Download } from 'lucide-react';

interface DocumentItem {
  title: string;
  type: 'PDF' | 'DOCX';
  dateInfo: string;
  fileUrl: string; // ลิงก์ดาวน์โหลดจริงจากระบบ อบก. หรือไฟล์ตัวอย่าง
  fileName: string;
}

export default function DocumentsPage() {
  const cfoDocuments: DocumentItem[] = [
    {
      title: 'EF CFO (AR5) — ค่าการปล่อยก๊าซเรือนกระจกสำหรับคำนวณคาร์บอนฟุตพริ้นท์องค์กร (ก.พ. 2569)',
      type: 'PDF',
      dateInfo: '📅 04/02/2569',
      fileUrl: 'https://www.tgo.or.th/upload/download/file/EF_CFO_AR5_Feb2026.pdf', // ตัวอย่าง URL อบก.
      fileName: 'EF_CFO_AR5_Feb2026.pdf'
    },
    {
      title: 'แบบรายงานการปล่อยและดูดกลับก๊าซเรือนกระจกขององค์กร (AR5) ฉบับปรับปรุง',
      type: 'DOCX',
      dateInfo: '📅 06/01/2569',
      fileUrl: 'https://www.tgo.or.th/upload/download/file/GHG_Report_Template_AR5.docx',
      fileName: 'GHG_Report_Template_AR5.docx'
    },
    {
      title: 'ข้อกำหนดในการคำนวณและรายงานคาร์บอนฟุตพริ้นท์ขององค์กร (ฉบับปรับปรุง)',
      type: 'PDF',
      dateInfo: '📅 09/08/2565',
      fileUrl: 'https://www.tgo.or.th/upload/download/file/CFO_Guideline_Update.pdf',
      fileName: 'CFO_Guideline_Update.pdf'
    },
    {
      title: 'แนวทางในการพิจารณา scope 3',
      type: 'PDF',
      dateInfo: '📅 09/01/2566',
      fileUrl: 'https://www.tgo.or.th/upload/download/file/Scope3_Guideline.pdf',
      fileName: 'Scope3_Guideline.pdf'
    }
  ];

  const tverDocuments: DocumentItem[] = [
    {
      title: 'เอกสารข้อเสนอโครงการแบบแผนงาน (T-VER Programme of Activities Design Document: T-VER-PoA-DD)',
      type: 'DOCX',
      dateInfo: '📌 บังคับใช้ 1 พ.ย. 2566',
      fileUrl: 'https://tver.tgo.or.th/upload/download/file/T-VER-PoA-DD.docx',
      fileName: 'T-VER-PoA-DD.docx'
    },
    {
      title: 'แบบฟอร์มแจ้งความประสงค์ในการพัฒนาโครงการ Premium T-VER (Modality of Communication: MoC)',
      type: 'DOCX',
      dateInfo: '📌 อัปเดตล่าสุด',
      fileUrl: 'https://tver.tgo.or.th/upload/download/file/Premium_T-VER_MoC.docx',
      fileName: 'Premium_T-VER_MoC.docx'
    },
    {
      title: 'แบบฟอร์มรายงานการตรวจสอบความใช้ได้และการทวนสอบโครงการ (Validation/Verification Report)',
      type: 'DOCX',
      dateInfo: '📌 อัปเดตล่าสุด',
      fileUrl: 'https://tver.tgo.or.th/upload/download/file/Validation_Verification_Report.docx',
      fileName: 'Validation_Verification_Report.docx'
    }
  ];

  const handleDownload = (fileUrl: string, fileName: string) => {
    // สร้างแท็ก <a> จำลองเพื่อดาวน์โหลดไฟล์ลงเครื่องทันทีโดยตรง
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">เอกสารที่เกี่ยวข้อง</h1>
        <p className="text-sm text-gray-500">รวมแบบฟอร์มเอกสารที่เกี่ยวข้องกับการปล่อยก๊าซเรือนกระจก (Emission Factor) สำหรับคาร์บอนฟุตพริ้นท์และคาร์บอนเครดิต</p>
      </div>

      {/* Section 1: CFO */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">คาร์บอนฟุตพริ้นท์ขององค์กร (CFO)</h2>
            <p className="text-xs text-gray-400">5 เอกสาร</p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {cfoDocuments.map((doc, index) => (
            <div key={index} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 px-2 rounded-xl transition">
              <div className="flex items-start gap-3">
                <span className={`px-2.5 py-1 text-xs font-bold rounded-md shrink-0 ${doc.type === 'PDF' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                  {doc.type}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">{doc.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{doc.dateInfo}</p>
                </div>
              </div>
              <button 
                onClick={() => handleDownload(doc.fileUrl, doc.fileName)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition shadow-sm shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> ดาวน์โหลด
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: T-VER */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">โครงการลดก๊าซเรือนกระจก (T-VER)</h2>
            <p className="text-xs text-gray-400">3 เอกสาร</p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {tverDocuments.map((doc, index) => (
            <div key={index} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 px-2 rounded-xl transition">
              <div className="flex items-start gap-3">
                <span className="px-2.5 py-1 text-xs font-bold rounded-md shrink-0 bg-blue-100 text-blue-600">
                  {doc.type}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">{doc.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{doc.dateInfo}</p>
                </div>
              </div>
              <button 
                onClick={() => handleDownload(doc.fileUrl, doc.fileName)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition shadow-sm shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> ดาวน์โหลด
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}