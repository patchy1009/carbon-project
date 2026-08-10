"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

const documents = [
  ["แบบฟอร์มขึ้นทะเบียนโครงการ T-VER", "เอกสารสมัคร", "tver-form.docx", "v3", "ใช้งานอยู่", "success"],
  ["เอกสารรับรองสิทธิ์การใช้ที่ดิน", "เอกสารประกอบ", "land-right.pdf", "v1", "ใช้งานอยู่", "success"],
  ["แบบสรุปข้อมูลการปล่อยก๊าซเรือนกระจกรายปี", "แบบรายงาน", "emission-report.xlsx", "v2", "อัปเดตล่าสุด", "warning"],
];

export default function DocumentsPage() {

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section>
      <div className="mb-6 flex items-end justify-between">
        <div><h1 className="text-2xl font-semibold text-[#152420]">จัดการเอกสารที่ต้องใช้</h1><p className="mt-1 text-sm text-[#67766F]">แม่แบบเอกสารสำหรับโครงการคาร์บอนเครดิตและรายงานการปล่อยก๊าซเรือนกระจก</p></div>
        <button  onClick={() => setIsModalOpen(true)} className="rounded-xl bg-[#158C69] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#117056]">+ เพิ่มเอกสาร</button>
      </div>

      <div className="mb-5 flex gap-6 border-b border-[#E7ECE9] text-sm font-medium">
        <button className="relative pb-3 text-[#152420] after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[3px] after:bg-[#22AD82]">เอกสารโครงการคาร์บอนเครดิต</button>
        <button className="pb-3 text-[#67766F] hover:text-[#152420]">เอกสารจัดทำรายงานการปล่อย/ดูดกลับก๊าซเรือนกระจก</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E7ECE9] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#E7ECE9]/40 text-xs text-[#67766F]">
              {["ชื่อเอกสาร","ประเภท","Template File","เวอร์ชัน","สถานะ","การดำเนินการ"].map(h => <th key={h} className={`px-6 py-3 font-medium ${h==="การดำเนินการ"?"text-right":"text-left"}`}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#E7ECE9]">
              {documents.map(([name,type,file,version,status,kind]) => (
                <tr key={name} className="hover:bg-[#F0FBF7]">
                  <td className="px-6 py-3.5 font-medium text-[#152420]">{name}</td><td className="px-6 py-3.5 text-[#67766F]">{type}</td><td className="px-6 py-3.5 font-medium text-[#117056]">▧ {file}</td><td className="px-6 py-3.5 font-mono text-[#67766F]">{version}</td>
                  <td className="px-6 py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${kind==="success"?"bg-[#DEF7EC] text-[#0F4A3B]":"bg-amber-100 text-amber-800"}`}>{status}</span></td>
                  <td className="px-6 py-3.5 text-right whitespace-nowrap"><button className="px-2.5 py-1.5 text-xs font-medium text-[#117056]">แก้ไข</button><button className="px-2.5 py-1.5 text-xs font-medium text-red-600">ลบ</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="เพิ่มเอกสาร"
      >
        <p>ฟอร์มเพิ่มเอกสาร</p>
      </Modal>

    </section>
  );
}
