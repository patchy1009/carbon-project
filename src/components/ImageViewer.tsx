'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* หน้าต่างดูรูปเต็มจอ + ซูม (ใช้ดูรูปบิลที่แนบ เพื่อตรวจทานค่าที่ OCR อ่านได้)
 * ใช้: {open && <ImageViewer src={url} title="w1.jpg" onClose={() => setOpen(false)} />}
 * วิธีใช้งานของผู้ใช้:
 *   - ปุ่ม + / − หรือหมุนลูกกลิ้งเมาส์ = ซูมเข้า/ออก (ซูมเข้าหาตำแหน่งเมาส์)
 *   - ดับเบิลคลิกที่รูป = สลับระหว่างพอดีจอ กับขยาย 2.5 เท่า
 *   - ซูมแล้วลากรูปเพื่อเลื่อนดูส่วนอื่น
 *   - ปุ่มหมุน = หมุนรูปทีละ 90° (รูปที่ถ่ายมาตะแคง)
 *   - คีย์บอร์ด: + / - ซูม, 0 รีเซ็ต, R หมุน, Esc ปิด
 * วาดผ่าน portal ไว้บนสุดของหน้า จึงไม่ถูกกล่องที่มี overflow-hidden ตัด */

const MIN = 1;
const MAX = 6;
const STEP = 1.25;

type View = { scale: number; x: number; y: number; rotate: number };
const FIT: View = { scale: 1, x: 0, y: 0, rotate: 0 };

// หน้าต่างดูรูปเต็มจอ เก็บระยะซูม ตำแหน่ง และมุมหมุนไว้ใน state ชื่อ view
export default function ImageViewer({
  src,
  title,
  onClose,
}: {
  src: string;
  title?: string;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>(FIT);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false); // ใช้ปิดแอนิเมชันระหว่างลาก (ไม่อ่าน ref ตอนวาดหน้าจอ)

  // ซูมโดยให้จุด (cx, cy) บนจอ (เทียบกับกึ่งกลางพื้นที่ดูรูป) อยู่ที่เดิม
  function zoomTo(next: number, cx = 0, cy = 0) {
    setView((v) => {
      const scale = Math.min(MAX, Math.max(MIN, next));
      if (scale === MIN) return { ...v, scale, x: 0, y: 0 };
      const k = scale / v.scale;
      return { ...v, scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }
  // ซูมเข้า 1 ขั้น
  const zoomIn = () => zoomTo(view.scale * STEP);
  // ซูมออก 1 ขั้น
  const zoomOut = () => zoomTo(view.scale / STEP);
  // กลับไปขนาดพอดีจอ แต่คงมุมหมุนเดิมไว้
  const reset = () => setView((v) => ({ ...FIT, rotate: v.rotate }));
  // หมุนรูปทีละ 90 องศา
  const rotate = () => setView((v) => ({ ...v, rotate: (v.rotate + 90) % 360, x: 0, y: 0 }));

  // ตำแหน่งเมาส์เทียบกับกึ่งกลางพื้นที่ดูรูป
  function fromCenter(clientX: number, clientY: number) {
    const r = stageRef.current!.getBoundingClientRect();
    return { cx: clientX - (r.left + r.width / 2), cy: clientY - (r.top + r.height / 2) };
  }

  // คีย์บอร์ด + ล็อกการเลื่อนหน้าด้านหลังขณะเปิด
  useEffect(() => {
    // ปุ่มลัดบนคีย์บอร์ด
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') setView((v) => ({ ...v, scale: Math.min(MAX, v.scale * STEP) }));
      else if (e.key === '-') setView((v) => (v.scale / STEP <= MIN ? { ...FIT, rotate: v.rotate } : { ...v, scale: v.scale / STEP }));
      else if (e.key === '0') setView((v) => ({ ...FIT, rotate: v.rotate }));
      else if (e.key === 'r' || e.key === 'R') setView((v) => ({ ...v, rotate: (v.rotate + 90) % 360, x: 0, y: 0 }));
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // ลูกกลิ้งเมาส์ = ซูม (ต้องผูกเองแบบ passive: false จึงกันหน้าเลื่อนได้)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    // หมุนลูกกลิ้งเมาส์เพื่อซูม โดยให้จุดที่เมาส์ชี้อยู่ที่เดิม
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - (r.left + r.width / 2);
      const cy = e.clientY - (r.top + r.height / 2);
      setView((v) => {
        const scale = Math.min(MAX, Math.max(MIN, e.deltaY < 0 ? v.scale * 1.15 : v.scale / 1.15));
        if (scale === MIN) return { ...v, scale, x: 0, y: 0 };
        const k = scale / v.scale;
        return { ...v, scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomed = view.scale > MIN;
  const btn =
    'flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-transparent';

  // createPortal: วาดหน้าต่างนี้ไว้ที่ document.body เพื่อไม่ให้ถูกกล่องที่อยู่รอบ ๆ ตัดขอบ
  return createPortal(
    <div className="fixed inset-0 z-[95] flex flex-col bg-[#0B1220]/90 font-sans" role="dialog" aria-modal="true" aria-label={title ? `ดูรูป ${title}` : 'ดูรูป'}>
      {/* แถบเครื่องมือ */}
      <div className="flex items-center gap-2 px-4 py-3 text-white">
        <p className="min-w-0 flex-1 truncate text-sm text-white/80">{title}</p>
        <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1">
          <button type="button" className={btn} onClick={zoomOut} disabled={!zoomed} aria-label="ซูมออก" title="ซูมออก (-)">−</button>
          <span className="w-14 text-center text-xs tabular-nums text-white/80">{Math.round(view.scale * 100)}%</span>
          <button type="button" className={btn} onClick={zoomIn} disabled={view.scale >= MAX} aria-label="ซูมเข้า" title="ซูมเข้า (+)">+</button>
          <button type="button" className={btn} onClick={reset} disabled={!zoomed} title="พอดีจอ (0)">พอดีจอ</button>
          <button type="button" className={btn} onClick={rotate} aria-label="หมุนรูป" title="หมุน 90° (R)">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        </div>
        <button type="button" className={`${btn} ml-1`} onClick={onClose} aria-label="ปิด" title="ปิด (Esc)">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* พื้นที่ดูรูป: คลิกพื้นที่ว่าง (ตอนไม่ได้ซูม) = ปิด */}
      <div
        ref={stageRef}
        className={`relative flex-1 overflow-hidden select-none ${zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
        onClick={(e) => { if (e.target === e.currentTarget && !zoomed) onClose(); }}
        onPointerDown={(e) => {
          if (!zoomed) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setView((v) => ({ ...v, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }));
        }}
        onPointerUp={() => { drag.current = null; setDragging(false); }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
        onDoubleClick={(e) => {
          const { cx, cy } = fromCenter(e.clientX, e.clientY);
          if (zoomed) reset();
          else zoomTo(2.5, cx, cy);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- รูปจากไฟล์ในเครื่อง (blob:) ใช้ next/image ไม่ได้ */}
        <img
          src={src}
          alt={title ?? 'รูปที่แนบ'}
          draggable={false}
          className="absolute left-1/2 top-1/2 max-h-[calc(100%-32px)] max-w-[calc(100%-32px)] rounded-md shadow-2xl"
          style={{
            transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale}) rotate(${view.rotate}deg)`,
            transition: dragging ? 'none' : 'transform 0.12s ease-out',
          }}
        />
      </div>

      <p className="px-4 pb-3 text-center text-xs text-white/50">
        หมุนลูกกลิ้งเมาส์หรือกด + / − เพื่อซูม · ดับเบิลคลิกเพื่อขยาย · ซูมแล้วลากเพื่อเลื่อนดู · Esc เพื่อปิด
      </p>
    </div>,
    document.body
  );
}
