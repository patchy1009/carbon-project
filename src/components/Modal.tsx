/* ===================== [MERGE aom + cyn2] =====================
 * Modal (default export)  = โครงของ cyn2 (title ไม่บังคับ, ปิดเมื่อคลิกพื้นหลังเท่านั้น)
 *                           + ปุ่ม × ของ aom ตอนมี title
 * ModalShell / ModalActions = โค้ด aom ทั้งหมด (ใช้ในหน้า admin) cyn2 ไม่ได้แก้ส่วนนี้
 * ============================================================== */
// กล่อง popup ที่ใช้ร่วมกันหลายหน้า
"use client";

import type { ReactNode, MouseEvent } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
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

  // ปิด Modal เมื่อคลิกพื้นหลังด้านนอกเท่านั้น
  const handleBackdropClick = (
    event: MouseEvent<HTMLDivElement>
  ) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    // [cyn2] กรอบ popup แบบใหม่ (พื้นหลังเบลอ, มุมมน 3xl) — ใช้กับกล่องเข้าสู่ระบบ/ลงทะเบียนของ cyn2 (AuthModal)
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || "Dialog"}
        className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden transition-all transform scale-100"
      >
        {/* [cyn2] Header: แสดงเฉพาะเมื่อมี title (AuthModal ไม่ส่ง title จึงไม่มีหัว) */}
        {title && (
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">
              {title}
            </h2>

            {/* [MERGE] ปุ่ม × ของ aom ยังคงไว้เมื่อมี title
                เพราะ popup ของ aom (เช่น "บันทึกเสร็จสิ้น" ใน FootprintClient.tsx) ส่ง title มาและใช้ปุ่มนี้ปิด */}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-2xl leading-none text-gray-400 hover:bg-[#F1F5F9] hover:text-gray-600"
              aria-label="ปิด"
            >
              ×
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-6 lg:px-8 lg:py-8">
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
