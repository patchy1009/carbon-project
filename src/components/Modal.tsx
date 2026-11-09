// กล่อง popup ที่ใช้ร่วมกันหลายหน้า
"use client";

import type { ReactNode } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

// กล่อง popup แบบมีหัวข้อ ถ้า isOpen เป็น false จะไม่แสดง
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      // พื้นหลังมืดลงน้อยกว่าเดิม (50% -> 40%) และกล่องมุมมนขึ้น เงานุ่มขึ้น ให้เข้าชุดกับกล่องแจ้งเตือนกลาง
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-[0_20px_50px_rgba(15,23,42,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-2xl leading-none text-gray-400 hover:bg-[#F1F5F9] hover:text-gray-600"
            aria-label="ปิด"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/* กรอบ popup ของฟอร์มฝั่ง admin (คลิกพื้นหลัง = ปิด)
 * เพิ่ม title (หัวข้อ popup) และ wide (popup กว้าง) แทน Dialog ที่หน้าสำนักงาน&คำแนะนำเขียนซ้ำไว้เอง
 *   และให้เลื่อนดูได้เมื่อเนื้อหายาวเกินจอ */
export function ModalShell({
  children,
  onClose,
  title,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-[#0F172A]/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        // มุมมนขึ้น + เงานุ่ม (เดิมไม่มีเงา กล่องดูแบนติดพื้นหลัง)
        className={`bg-white rounded-2xl p-6 shadow-[0_20px_50px_rgba(15,23,42,0.2)] max-w-full max-h-[90vh] overflow-y-auto ${wide ? 'w-[860px]' : 'w-[440px]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="mb-4 text-lg font-semibold text-[#0F172A]">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

/* ปุ่มยกเลิก/บันทึกท้าย popup ฟอร์มแอดมิน: สูงเท่ากัน (h-10), ปุ่มยกเลิกมีสีเส้นขอบ+hover
 * ปุ่มบันทึกใช้สีเขียวหลักของเว็บ (เดิม #059669 ไม่ตรงกับปุ่มอื่น) */
export function ModalActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-3">
      <button
        type="button"
        onClick={onCancel}
        className="btn btn-outline h-10 px-4 text-sm rounded-lg"
      >
        ยกเลิก
      </button>
      <button type="submit" className="btn btn-primary h-10 px-5 text-sm font-medium rounded-lg">
        บันทึก
      </button>
    </div>
  );
}
