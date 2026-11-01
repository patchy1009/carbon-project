/* [กลาง] ไอคอนเส้น (SVG) ที่ใช้ซ้ำหลายหน้า — แก้หน้าตาไอคอนที่ไฟล์นี้ที่เดียว ทุกหน้าเปลี่ยนตาม
 * - สีตาม currentColor ของปุ่ม/ข้อความที่ครอบอยู่ (เปลี่ยนสีด้วย class text-* ของตัวครอบ)
 * - ขนาดเริ่มต้น h-4 w-4 เปลี่ยนได้ด้วย className เช่น <TrashIcon className="h-5 w-5" />
 * [แก้ไข] รวมไอคอนที่เดิมเขียนซ้ำไว้ในหลายไฟล์ (allotaxdoc, dashboard, footprint) มาไว้ที่นี่ */

type IconProps = { className?: string };

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

// ดินสอ = แก้ไข
export function PencilIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

// ถังขยะ = ลบ
export function TrashIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

// ลูกศรลง = ดาวน์โหลด
export function DownloadIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4.5 20h15" />
    </svg>
  );
}

// เครื่องหมายบวก = เพิ่ม
export function PlusIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// แผ่นเอกสาร
export function FileIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 2.5h8l5 5V21a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 21z" />
      <path d="M14 2.5V8h5" />
    </svg>
  );
}

// เมฆ + ลูกศรขึ้น = อัปโหลด
export function UploadCloudIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base} viewBox="0 0 24 18" strokeWidth={1.4} className={className}>
      <path d="M6.5 17A4.5 4.5 0 0 1 5.4 8.1 5.5 5.5 0 0 1 16.2 6.6 4 4 0 0 1 17.5 17H6.5Z" />
      <path d="M12 14V8m0 0-2.4 2.4M12 8l2.4 2.4" />
    </svg>
  );
}
