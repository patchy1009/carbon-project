"use client";

import type { ReactNode, MouseEvent } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

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
        {/* Header: แสดงเฉพาะเมื่อมี title */}
        {title && (
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">
              {title}
            </h2>
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
