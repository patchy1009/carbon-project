"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

const activities = [
  ["การเผาไหม้เชื้อเพลิงดีเซล (เครื่องกำเนิดไฟฟ้า)", "Scope 1", "ลิตร", "2.7060", "พลังงานเชื้อเพลิง"],
  ["การใช้ไฟฟ้าจากระบบสายส่ง", "Scope 2", "kWh", "0.4999", "พลังงานไฟฟ้า"],
  ["การเดินทางโดยรถยนต์ส่วนบุคคล (น้ำมันเบนซิน)", "Scope 3", "กม.", "0.1782", "การเดินทาง/ขนส่ง"],
  ["ปริมาณของเสียฝังกลบ", "Scope 3", "ตัน", "0.5871", "ของเสีย"],
];

export default function ActivitiesPage() {

    const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#152420]">ข้อมูลกิจกรรมการปล่อยคาร์บอน</h1>
          <p className="mt-1 text-sm text-[#67766F]">รูปแบบตาราง/ฟอร์มสำหรับจัดการกิจกรรมและ Emission Factor</p>
        </div>
        <button onClick={() => setIsModalOpen(true)}className="rounded-lg bg-[#158C69] px-4 py-2 text-white hover:bg-[#117056]">+ เพิ่มกิจกรรม</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E7ECE9] bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E7ECE9] p-4">
          <input placeholder="ค้นหาชื่อกิจกรรม" className="min-w-[220px] flex-1 rounded-xl border border-[#E7ECE9] px-4 py-2.5 text-sm outline-none focus:border-[#22AD82]" />
          <select className="rounded-xl border border-[#E7ECE9] px-3 py-2.5 text-sm"><option>Scope: ทั้งหมด</option><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select>
          <select className="rounded-xl border border-[#E7ECE9] px-3 py-2.5 text-sm"><option>หมวดหมู่: ทั้งหมด</option><option>พลังงาน</option><option>การขนส่ง</option><option>ของเสีย</option></select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#E7ECE9]/40 text-xs text-[#67766F]">
              {["ชื่อกิจกรรม","Scope","หน่วย","Emission Factor","หมวดหมู่","การดำเนินการ"].map(h => <th key={h} className={`px-6 py-3 font-medium ${h==="การดำเนินการ"?"text-right":"text-left"}`}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#E7ECE9]">
              {activities.map((row) => (
                <tr key={row[0]} className="hover:bg-[#F0FBF7]">
                  <td className="px-6 py-3.5 font-medium text-[#152420]">{row[0]}</td>
                  <td className="px-6 py-3.5"><span className="rounded-full bg-[#E7ECE9] px-2.5 py-1 text-xs">{row[1]}</span></td>
                  <td className="px-6 py-3.5 font-mono text-[#67766F]">{row[2]}</td>
                  <td className="px-6 py-3.5 font-mono text-[#67766F]">{row[3]}</td>
                  <td className="px-6 py-3.5 text-[#67766F]">{row[4]}</td>
                  <td className="px-6 py-3.5 text-right whitespace-nowrap">
                    <button className="px-2.5 py-1.5 text-xs font-medium text-[#117056] hover:bg-[#F0FBF7]">แก้ไข</button>
                    <button className="px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[#E7ECE9] px-6 py-4 text-sm text-[#67766F]">
          <p>แสดง 1–4 จาก 46 รายการ</p>
          <div className="flex gap-1"><button className="h-8 w-8 rounded-lg border border-[#E7ECE9]">‹</button><button className="h-8 w-8 rounded-lg bg-[#158C69] text-white">1</button><button className="h-8 w-8 rounded-lg border border-[#E7ECE9]">2</button><button className="h-8 w-8 rounded-lg border border-[#E7ECE9]">›</button></div>
        </div>
      </div>

        <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="เพิ่มข้อมูลกิจกรรม"
        >
            <div className="space-y-4">
                <div>
                    <label className="mb-1 block text-sm font-medium">
                    ชื่อกิจกรรม
                    </label>

                    <input
                    type="text"
                    placeholder="กรอกชื่อกิจกรรม"
                    className="w-full rounded-lg border px-3 py-2"
                    />
                </div>

                <div className="flex justify-end gap-2">
                    <button
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg border px-4 py-2"
                    >
                    ยกเลิก
                    </button>

                    <button className="rounded-lg bg-[#158C69] px-4 py-2 text-white">
                    บันทึก
                    </button>
                </div>
            </div>
        </Modal>

    </section>
  );
}
