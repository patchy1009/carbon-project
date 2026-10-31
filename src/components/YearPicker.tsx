'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* [เพิ่ม] ช่องเลือกปี พ.ศ. แบบพิมพ์ค้นหาได้ (ใช้แทน <select> ที่มีให้เลือกแค่ไม่กี่ปี)
 * - คลิกช่อง = เปิดรายการปีทั้งหมดในช่วง min..max (ใหม่สุดอยู่บน)
 * - พิมพ์ตัวเลข (รับเลขไทย ๐-๙ ได้) = กรองรายการเหลือปีที่มีเลขนั้น เช่น พิมพ์ "65" เห็น 2565, 2556 ...
 * - พิมพ์ครบ 4 หลักและอยู่ในช่วง = เลือกปีนั้นทันที / นอกช่วง = แจ้งข้อความใต้ช่อง
 * - ลูกศรขึ้น/ลง เลื่อนรายการ, Enter เลือก, Esc ปิด
 * value = 0 หมายถึงยังไม่ได้เลือก
 * [แก้ไข] รายการปีวาดผ่าน portal ลอยเหนือทั้งหน้า (position: fixed)
 *   เดิมอยู่ในกล่องที่มี overflow-hidden เลยถูกตัด มองไม่เห็นรายการ */

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const toArabic = (s: string) => s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d))).replace(/\D/g, '');

export default function YearPicker({
  value,
  onChange,
  min,
  max,
  hasError = false,
  placeholder = 'ปี พ.ศ.',
  className = '',
}: {
  value: number;
  onChange: (year: number) => void;
  min: number;
  max: number;
  hasError?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [text, setText] = useState(value ? String(value) : '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rangeError, setRangeError] = useState('');
  // ตำแหน่งของรายการบนจอ (คำนวณจากกรอบของช่องกรอก)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // ค่าจากภายนอกเปลี่ยน (เช่น รีเซ็ตฟอร์ม) -> แสดงตาม
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setText(value ? String(value) : '');
  }

  const years: number[] = [];
  for (let y = max; y >= min; y--) years.push(y);
  // ปีที่บันทึกไว้เดิมอยู่นอกช่วง ก็ยังต้องแสดงให้เลือกได้
  if (value && (value > max || value < min)) years.unshift(value);

  const query = toArabic(text);
  // ช่องแสดงปีที่เลือกอยู่แล้ว = ยังไม่ได้พิมพ์ค้นหา -> แสดงทุกปี
  const filtered = query && query !== String(value) ? years.filter((y) => String(y).includes(query)) : years;

  // ปิดรายการเมื่อคลิกนอกช่อง แล้วคืนข้อความเป็นปีที่เลือกอยู่
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!boxRef.current?.contains(t) && !listRef.current?.contains(t)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  });

  // วางรายการใต้ช่องกรอก และตามไปเมื่อเลื่อนหน้า/ย่อขยายจอ
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = boxRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  // เลื่อนเฉพาะภายในรายการให้เห็นตัวที่ไฮไลต์อยู่ (ไม่ใช้ scrollIntoView เพราะจะเลื่อนกล่อง/หน้าด้วย)
  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!list || !item) return;
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
  }, [active, open, pos]);

  function close() {
    setOpen(false);
    setText(value ? String(value) : '');
  }

  function pick(y: number) {
    setRangeError('');
    setText(String(y));
    setOpen(false);
    if (y !== value) onChange(y);
  }

  function openList() {
    setOpen(true);
    const i = years.indexOf(value);
    setActive(i >= 0 ? i : 0);
  }

  function handleType(raw: string) {
    const digits = toArabic(raw).slice(0, 4);
    setText(digits);
    setOpen(true);
    setActive(0);
    setRangeError('');
    if (digits.length === 4) {
      const y = Number(digits);
      if (y >= min && y <= max) {
        if (y !== value) onChange(y);
      } else {
        setRangeError(`เลือกได้ตั้งแต่ พ.ศ. ${min} ถึง ${max}`);
      }
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openList();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => Math.min(Math.max(i + step, 0), Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'Enter') {
      if (open && filtered[active] !== undefined) {
        e.preventDefault();
        pick(filtered[active]);
      }
    } else if (e.key === 'Escape') {
      close();
    }
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div
        className={`flex h-11 items-center rounded-[20px] border bg-[#F7F9FB] pl-4 pr-2 text-sm ${
          hasError || rangeError ? 'border-red-500' : 'border-[#BDC9C1]'
        }`}
      >
        <input
          type="text"
          inputMode="numeric"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={text}
          placeholder={placeholder}
          onFocus={(e) => {
            e.target.select();
            openList();
          }}
          onClick={() => !open && openList()}
          onChange={(e) => handleType(e.target.value)}
          onKeyDown={handleKey}
          className="w-full min-w-0 bg-transparent outline-none placeholder:text-[#6B7280]"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="เปิดรายการปี"
          onClick={() => (open ? close() : openList())}
          className="p-1 text-[#6B7280]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {open && pos && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 140) }}
          className="scroll-list fixed z-[90] max-h-60 rounded-xl border border-[#E2E8F0] bg-white py-1 font-sans shadow-lg"
        >
          {filtered.length === 0 && <li className="px-4 py-2 text-sm text-[#94A3B8]">ไม่พบปีที่ค้นหา</li>}
          {filtered.map((y, i) => (
            <li
              key={y}
              data-index={i}
              role="option"
              aria-selected={y === value}
              onMouseDown={(e) => e.preventDefault()} // ไม่ให้ input เสียโฟกัสก่อนเลือก
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(y)}
              className={`cursor-pointer px-4 py-2 text-sm ${
                i === active ? 'bg-[#F0FDF4]' : ''
              } ${y === value ? 'font-semibold text-[#32885F]' : 'text-[#191C1E]'}`}
            >
              {y}
            </li>
          ))}
        </ul>,
        document.body
      )}

      {rangeError && <p className="mt-1 text-xs text-red-600">{rangeError}</p>}
    </div>
  );
}
