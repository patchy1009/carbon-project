'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* dropdown กลางของระบบ (ใช้แทน <select> ของ browser ทั้งฝั่งแอดมินและองค์กร)
 * หน้าตารายการเหมือนรายการ "โครงการที่บันทึกไว้" ในหน้าจำลอง T-VER:
 *   กล่องขาว มุมโค้ง เงา / แต่ละแถวไฮไลต์เทาอ่อนเมื่อชี้ / ตัวที่เลือกอยู่เป็นตัวหนา
 * - ตัวปุ่ม (ช่องที่เห็นก่อนกด) ใช้ className เดิมของแต่ละหน้า -> ขนาด/ขอบ/สีของช่องเหมือนเดิม
 * - รายการวาดผ่าน portal (position: fixed) ไม่ถูกการ์ดหรือ modal ที่มี overflow-hidden ตัด
 * - คีย์บอร์ด: ลูกศรขึ้น/ลง เลื่อน, Enter/Space เลือก, Esc/Tab ปิด
 * - value / onChange ใช้แบบเดียวกับ <select>: onChange ได้ค่าเป็น string (ค่าตัวเลขให้ Number() เอง) */

// placeholder: true = ข้อความ "เลือก..." แสดงในช่องตอนยังไม่ได้เลือก แต่ไม่อยู่ในรายการ (รายการมีแต่ตัวเลือกจริง)
export type SelectOption = { value: string | number; label: React.ReactNode; disabled?: boolean; placeholder?: boolean };

// คลาสของรายการ ใช้ร่วมกับ dropdown อื่นที่เขียนเอง (YearPicker, ช่องชื่อโครงการ T-VER)
export const DROPDOWN_LIST =
  'scroll-list max-h-60 overflow-auto rounded-xl border border-[#E5E7EB] bg-white py-1 font-sans shadow-lg';
export const dropdownItem = (active: boolean, selected: boolean, disabled = false) =>
  `block w-full cursor-pointer px-3 py-2 text-left ${active ? 'bg-[#F3F4F6]' : ''} ${
    disabled ? 'cursor-not-allowed text-[#CBD5E1]' : selected ? 'font-semibold text-[#1F2937]' : 'text-[#374151]'
  }`;

// ไอคอนลูกศรลง (ตัวเดียวกับ YearPicker)
export function ChevronDown({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
  ariaLabel,
}: {
  value?: string | number; // ไม่ส่ง = ให้ component จำค่าเอง (ใช้ defaultValue)
  defaultValue?: string | number;
  onChange?: (value: string) => void;
  options: SelectOption[];
  className?: string; // คลาสของช่อง (เหมือนที่เคยใส่ให้ <select>)
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const listId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? '');
  const current = String(value ?? inner);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // ตำแหน่งรายการบนจอ + ขนาดตัวอักษรของช่อง (ให้รายการตัวเท่ากับช่อง)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; fontSize: string } | null>(null);

  const selected = options.find((o) => String(o.value) === current);
  // ตัวเลือกที่แสดงในรายการ (ไม่รวม placeholder)
  const items = options.filter((o) => !o.placeholder);
  const selectedIndex = items.findIndex((o) => String(o.value) === current);
  // ค่าว่าง / 0 = ยังไม่ได้เลือก -> แสดงตัวอักษรสีจาง แบบ placeholder
  const isEmpty = current === '' || current === '0';

  // คลิกนอกช่องและนอกรายการ -> ปิด
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // วางรายการใต้ช่อง (ถ้าข้างล่างไม่พอ วางไว้ข้างบน) และตามไปเมื่อเลื่อนหน้า/ย่อขยายจอ
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const fontSize = getComputedStyle(el).fontSize;
      const below = window.innerHeight - r.bottom;
      if (below < 260 && r.top > below) {
        setPos({ bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width, fontSize });
      } else {
        setPos({ top: r.bottom + 4, left: r.left, width: r.width, fontSize });
      }
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  // เลื่อนเฉพาะภายในรายการให้เห็นตัวที่ไฮไลต์อยู่
  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!list || !item) return;
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
  }, [active, open, pos]);

  function openList() {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function pick(i: number) {
    const o = items[i];
    if (!o || o.disabled) return;
    setOpen(false);
    btnRef.current?.focus();
    if (String(o.value) === current) return;
    if (value === undefined) setInner(o.value);
    onChange?.(String(o.value));
  }

  // เลื่อนตัวไฮไลต์ ข้ามตัวที่เลือกไม่ได้
  function move(step: number) {
    let i = active;
    for (let n = 0; n < items.length; n++) {
      i = Math.min(Math.max(i + step, 0), items.length - 1);
      if (!items[i]?.disabled) break;
    }
    setActive(i);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openList();
      move(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) pick(active);
      else openList();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKey}
        className={`${className} inline-flex items-center gap-2 text-left disabled:cursor-not-allowed`}
      >
        <span className={`min-w-0 flex-1 truncate ${isEmpty ? 'text-[#94A3B8]' : ''}`}>
          {selected?.label ?? ''}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#6B7280]" />
      </button>

      {open && pos && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, minWidth: pos.width, fontSize: pos.fontSize }}
          className={`${DROPDOWN_LIST} fixed z-[90] w-max max-w-[min(480px,90vw)]`}
        >
          {items.map((o, i) => (
            <li
              key={String(o.value)}
              data-index={i}
              role="option"
              aria-selected={i === selectedIndex}
              aria-disabled={o.disabled}
              onMouseDown={(e) => e.preventDefault()} // ไม่ให้ช่องเสียโฟกัสก่อนเลือก
              onMouseEnter={() => !o.disabled && setActive(i)}
              onClick={() => pick(i)}
              className={dropdownItem(i === active, i === selectedIndex, o.disabled)}
            >
              {o.label}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </>
  );
}
