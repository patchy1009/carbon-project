'use client';

import { useEffect, useRef, useState } from 'react';

/* dropdown กลางของระบบ (ใช้แทน <select> ของ browser ทั้งฝั่งแอดมินและองค์กร)
 * กดที่ช่อง = เปิดรายการ / กดตัวเลือก = เลือกแล้วปิด / กดที่อื่น = ปิด
 * className = คลาสของช่อง (เหมือนที่เคยใส่ให้ <select>) ขนาด/ขอบ/สีของช่องจึงเหมือนเดิม
 * onChange ได้ค่าเป็น string (ค่าตัวเลขให้ Number() เอง) */

// placeholder: true = ข้อความ "เลือก..." แสดงในช่องตอนยังไม่ได้เลือก แต่ไม่อยู่ในรายการ
export type SelectOption = { value: string | number; label: React.ReactNode; disabled?: boolean; placeholder?: boolean };

// คลาสของรายการ ใช้ร่วมกับช่องชื่อโครงการ T-VER ให้หน้าตาเหมือนกัน
export const DROPDOWN_LIST =
  'scroll-list max-h-60 overflow-auto rounded-xl border border-[#E5E7EB] bg-white py-1 font-sans shadow-lg';

// ไอคอนลูกศรลง
export function ChevronDown({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function Select({
  value,
  defaultValue,
  onChange,
  options,
  className = '',
  disabled = false,
}: {
  value?: string | number; // ไม่ส่ง = ให้ component จำค่าเอง (ใช้ defaultValue)
  defaultValue?: string | number;
  onChange?: (value: string) => void;
  options: SelectOption[];
  className?: string;
  disabled?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? '');
  const current = String(value ?? inner);

  const selected = options.find((o) => String(o.value) === current);
  const items = options.filter((o) => !o.placeholder); // รายการมีแต่ตัวเลือกจริง
  const isEmpty = current === '' || current === '0'; // ยังไม่ได้เลือก -> ตัวอักษรสีจาง

  // กดที่อื่นนอกช่อง -> ปิดรายการ
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function pick(o: SelectOption) {
    if (o.disabled) return;
    setOpen(false);
    if (String(o.value) === current) return;
    if (value === undefined) setInner(o.value);
    if (onChange) onChange(String(o.value));
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`${className} inline-flex items-center gap-2 text-left disabled:cursor-not-allowed`}
      >
        <span className={`min-w-0 flex-1 truncate ${isEmpty ? 'text-[#94A3B8]' : ''}`}>{selected?.label ?? ''}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#6B7280]" />
      </button>

      {open && (
        <ul className={`${DROPDOWN_LIST} absolute left-0 z-50 mt-1 w-max min-w-full max-w-[480px]`}>
          {items.map((o) => (
            <li
              key={String(o.value)}
              onClick={() => pick(o)}
              className={`cursor-pointer px-3 py-2 hover:bg-[#F3F4F6] ${
                o.disabled ? 'cursor-not-allowed text-[#CBD5E1]' : String(o.value) === current ? 'font-semibold text-[#1F2937]' : 'text-[#374151]'
              }`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
