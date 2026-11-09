/* ไอคอนเส้น (SVG) ที่ใช้ซ้ำหลายหน้า — แก้หน้าตาไอคอนที่ไฟล์นี้ที่เดียว ทุกหน้าเปลี่ยนตาม
 * - สีตาม currentColor ของปุ่ม/ข้อความที่ครอบอยู่ (เปลี่ยนสีด้วย class text-* ของตัวครอบ)
 * - ขนาดเริ่มต้น h-4 w-4 เปลี่ยนได้ด้วย className เช่น <TrashIcon className="h-5 w-5" />
 * รวมไอคอนที่เดิมเขียนซ้ำไว้ในหลายไฟล์ (allotaxdoc, dashboard, footprint) มาไว้ที่นี่ */

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

/* ไอคอนสถานะและไอคอนทั่วไป ใช้แทนสัญลักษณ์/อิโมจิ (✓ ✕ ⚠ 👁 📅 📄) ที่เคยพิมพ์ไว้ในข้อความ */

// เครื่องหมายถูก = สำเร็จ/ยืนยันแล้ว
export function CheckIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// กากบาท = ผิด/ไม่ผ่าน/ปิด
export function XIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// สามเหลี่ยมตกใจ = คำเตือน
export function AlertIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

// ดวงตา = ดู/เปิดดู
export function EyeIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ปฏิทิน = วันที่
export function CalendarIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}
