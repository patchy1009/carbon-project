'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

export type Measure = { name: string; amount: number };
type ReportData = {
  name: string | null;
  createdAt: string;
  total: number;
  s1: number;
  s2: number;
  s3: number;
};

const fmt = (n: number) =>
  n.toLocaleString('th-TH', { maximumFractionDigits: n < 10 ? 2 : 0 });

const pct = (part: number, total: number) =>
  total > 0 ? ((part / total) * 100).toFixed(1) : '0.0';

const thaiDate = (s: string) =>
  new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(s));

// เลือกช่วงแกน Y ให้ดูสวย (1, 2, 5 × 10^n) แบ่ง 4 ช่อง
function niceStep(max: number) {
  if (max <= 0) return 1;
  const target = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(target)));
  const n = target / mag;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return m * mag;
}

function Co2e({ className = '' }: { className?: string }) {
  return (
    <span className={className}>
      tCO<sub>2</sub>e
    </span>
  );
}

function Icon({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export default function ReportClient({
  report,
  measures,
  logId,
}: {
  report: ReportData;
  measures: Measure[];
  logId: string;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const { total, s1, s2, s3 } = report;
  const hasBreakdown = s1 + s2 + s3 > 0;
  const totalReduction = measures.reduce((sum, m) => sum + m.amount, 0);

  const step = niceStep(Math.max(s1, s2, s3));
  const yMax = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);

  // ดาวน์โหลดรายงานเป็นไฟล์ PDF
  async function handleDownload() {
    const el = reportRef.current;
    if (!el) return;
    setDownloading(true);

    try {
      // โหลดไลบรารีเมื่อกดปุ่มเท่านั้น (ไม่ทำให้หน้าเว็บโหลดช้าลง)
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      // จับภาพหน้ารายงาน โดยข้ามส่วนที่ใส่ data-no-export (ปุ่มต่างๆ)
      const dataUrl = await toPng(el, {
        pixelRatio: 2, // ความคมชัด
        backgroundColor: '#ffffff',
        filter: (node) =>
          !(node instanceof HTMLElement && node.hasAttribute('data-no-export')),
      });

      // อ่านขนาดภาพ เพื่อเลือกแนวกระดาษ (แนวนอนถ้าภาพกว้างกว่าสูง)
      const probe = new jsPDF();
      const props = probe.getImageProperties(dataUrl);
      const orientation = props.width >= props.height ? 'l' : 'p';

      const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;

      // ย่อภาพให้พอดีกับหน้ากระดาษ รักษาสัดส่วน
      const ratio = Math.min(
        (pageW - margin * 2) / props.width,
        (pageH - margin * 2) / props.height
      );
      const w = props.width * ratio;
      const h = props.height * ratio;

      pdf.addImage(dataUrl, 'PNG', (pageW - w) / 2, margin, w, h);

      const date = new Date().toISOString().slice(0, 10);
      pdf.save(`carbon-footprint-report-${date}.pdf`);
    } catch (err) {
      console.error('Download report error:', err);
      alert('ดาวน์โหลดรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setDownloading(false);
    }
  }

  const cards = [
    {
      title: 'ก๊าซเรือนกระจกรวม',
      value: total,
      note: null as string | null,
      bg: '#F0FDF4',
      icon: (
        <Icon color="#16A34A">
          <path d="M3 3v18h18" />
          <path d="M7 15l4-4 3 3 5-6" />
        </Icon>
      ),
    },
    {
      title: 'scope 1 (ทางตรง)',
      value: s1,
      note: `คิดเป็น ${pct(s1, total)}% ของทั้งหมด`,
      bg: '#F0FDFA',
      icon: (
        <Icon color="#0D9488">
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </Icon>
      ),
    },
    {
      title: 'scope 2 (ทางอ้อม)',
      value: s2,
      note: `คิดเป็น ${pct(s2, total)}% ของทั้งหมด`,
      bg: '#EFF6FF',
      icon: (
        <Icon color="#2563EB">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" />
        </Icon>
      ),
    },
    {
      title: 'scope 3 (ห่วงโซ่คุณค่า)',
      value: s3,
      note: `คิดเป็น ${pct(s3, total)}% ของทั้งหมด`,
      bg: '#FFF7ED',
      icon: (
        <Icon color="#FB923C">
          <path d="M21 8v13H3V8" />
          <path d="M1 3h22v5H1z" />
          <path d="M10 12h4" />
        </Icon>
      ),
    },
  ];

  const bars = [
    { label: 'scope 1', value: s1 },
    { label: 'scope 2', value: s2 },
    { label: 'scope 3', value: s3 },
  ];

  return (
    // ref ชี้ที่กรอบนอกสุด = ส่วนที่จะถูกจับภาพเป็น PDF (พื้นหลังขาวเพื่อให้ PDF ไม่โปร่งใส)
    <div ref={reportRef} className="max-w-[1150px] mx-auto bg-white px-6 py-8 space-y-6">
      {/* หัวรายงาน */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-medium text-black">
            ผลการวิเคราะห์การปล่อยก๊าซเรือนกระจก
          </h1>
          <p className="text-base font-medium text-[#6B7280]">
            ระบบคำนวณและวิเคราะห์ผลการปล่อยก๊าซเรือนกระจก พร้อมแนวทางการลดการปล่อยก๊าซเรือนกระจก
          </p>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {report.name ?? 'รายงาน'} • จัดทำเมื่อ {thaiDate(report.createdAt)}
          </p>
        </div>

        {/* ปุ่มต่างๆ ไม่ถูกรวมใน PDF (data-no-export) */}
        <div className="flex gap-2" data-no-export="true">
          <Link
            href="/organization/dashboard"
            className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#64748B]"
          >
            กลับแดชบอร์ด
          </Link>
          <Link
            href={`/organization/footprint?edit=${logId}`}
            className="rounded-lg border border-[#32885F] bg-white px-4 py-2 text-sm font-semibold text-[#32885F]"
          >
            แก้ไขข้อมูล
          </Link>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-60"
          >
            {downloading ? 'กำลังสร้างไฟล์...' : 'ดาวน์โหลดรายงาน'}
          </button>
        </div>
      </div>

      {/* การ์ดสรุป */}
      <div className="grid grid-cols-4 gap-6">
        {cards.map((c) => (
          <div key={c.title} className="rounded-2xl bg-white p-6 shadow-md">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-[#6B7280]">{c.title}</p>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: c.bg }}
              >
                {c.icon}
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-[32px] font-bold leading-none text-[#1E293B]">
                {fmt(c.value)}
              </span>
              <Co2e className="text-sm text-[#94A3B8]" />
            </div>
            {c.note && <p className="mt-2 text-xs text-[#64748B]">{c.note}</p>}
          </div>
        ))}
      </div>

      {/* กราฟ + มาตรการ */}
      <div className="grid grid-cols-[1fr_420px] gap-6">
        {/* กราฟแท่งแยกตาม scope */}
        <div className="rounded-2xl bg-white p-8 shadow-md">
          <h2 className="text-lg font-bold text-[#1E293B]">การปล่อยก๊าซแยกตาม scope</h2>

          {!hasBreakdown ? (
            <p className="py-24 text-center text-sm text-[#94A3B8]">
              รายการนี้ไม่มีข้อมูลแยกตาม scope
              <br />
              บันทึกข้อมูลใหม่เพื่อดูกราฟ
            </p>
          ) : (
            <div className="mt-8 flex">
              {/* แกน Y */}
              <div className="relative mr-3 h-[300px] w-12 text-right text-[10px] text-[#94A3B8]">
                {ticks.map((t, i) => (
                  <span
                    key={t}
                    className="absolute right-0 -translate-y-1/2"
                    style={{ bottom: `${(i / 4) * 100}%` }}
                  >
                    {fmt(t)}
                  </span>
                ))}
              </div>

              <div className="flex-1">
                <div className="relative h-[300px] border-b border-[#F1F5F9]">
                  {ticks.map((t, i) => (
                    <div
                      key={t}
                      className="absolute left-0 right-0 border-t border-[#F1F5F9]"
                      style={{ bottom: `${(i / 4) * 100}%` }}
                    />
                  ))}
                  <div className="relative flex h-full items-end justify-around px-6">
                    {bars.map((b) => (
                      <div
                        key={b.label}
                        className="w-20 rounded-t-sm bg-[#FF7C57]"
                        style={{ height: `${(b.value / yMax) * 100}%` }}
                        title={`${b.label}: ${fmt(b.value)} tCO2e`}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-around px-6 pt-3">
                  {bars.map((b) => (
                    <span key={b.label} className="w-20 text-center text-xs text-[#64748B]">
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* มาตรการลดการปล่อยก๊าซ */}
        <div className="rounded-2xl bg-white p-8 shadow-md">
          <h2 className="text-lg font-bold text-[#1E293B]">มาตรการลดการปล่อยก๊าซที่แนะนำ</h2>

          <div className="mt-6 space-y-4">
            {measures.length === 0 && (
              <p className="py-6 text-center text-sm text-[#94A3B8]">ยังไม่มีมาตรการที่แนะนำ</p>
            )}
            {measures.map((m, i) => (
              <div key={i} className="rounded-xl border-b-2 border-[#F7F9FB] p-4">
                <p className="text-sm font-semibold text-[#1E293B]">{m.name}</p>
                <p className="mt-2 text-sm font-bold text-[#16A34A]">
                  -{fmt(m.amount)} <Co2e />/ปี
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-[#DCFCE7] bg-[#FAFAFA] p-6">
            <p className="text-xs font-semibold text-[#166534]">ผลลัพธ์การลดโดยรวม</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-[#16A34A]">-{fmt(totalReduction)}</span>
              <Co2e className="text-lg font-bold text-[#16A34A]" />
              <span className="text-lg font-bold text-[#16A34A]">/ปี</span>
            </div>
          </div>

          {/* ปุ่มนี้ไม่ถูกรวมใน PDF */}
          <div className="mt-6 flex justify-center" data-no-export="true">
            <Link
              href="/organization/tver-simulation"
              className="rounded-[20px] bg-[#32885F] px-8 py-4 text-base font-semibold text-white"
            >
              เริ่มจำลองโครงการ T-VER
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}