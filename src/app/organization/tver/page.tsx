// หน้าเลือกวิธีจำลองโครงการ T-VER (เมนู "จำลองโครงการ T-VER" พามาที่นี่)
//   แบบเดิม : กรอกจำนวนต้นไม้ -> ประมาณคาร์บอนเครดิต 3 ปี -> จัดสรรเครดิต -> ประเมินภาษี (หน้า tver-simulation ไม่ได้แก้)
//   แบบใหม่ : กรอกเป้าหมายการกักเก็บ -> ต้องปลูกกี่ต้น ที่ดินพอไหม ต้องเพิ่มพื้นที่เท่าไหร่ (หน้า tver-target)
//   สองแบบแยกกัน แบบใหม่ใช้วางแผนก่อนปลูก ไม่ส่งผลไปหน้าจัดสรรเครดิตและภาษี
import Link from 'next/link';
import { requireOrgId } from '@/lib/auth';

const MODES = [
  {
    href: '/organization/tver-simulation',
    title: 'คำนวณจากจำนวนต้นไม้',
    badge: 'แบบเดิม',
    description: 'กรอกจำนวนต้นไม้ที่ปลูก ระบบประมาณคาร์บอนเครดิต 3 ปี แล้วนำไปจัดสรรคาร์บอนเครดิตและประเมินสิทธิประโยชน์ทางภาษีต่อได้',
  },
  {
    href: '/organization/tver-target',
    title: 'คำนวณจากเป้าหมายการกักเก็บคาร์บอน',
    badge: 'แบบใหม่',
    description: 'กรอกปริมาณคาร์บอนที่ต้องการกักเก็บ ระบบคำนวณว่าต้องปลูกกี่ต้น ที่ดินที่มีพอหรือไม่ และถ้าไม่พอต้องเพิ่มพื้นที่อีกเท่าไหร่',
  },
];

export default async function TverModePage() {
  await requireOrgId(); // ต้องล็อกอินเป็นองค์กร (ไม่ได้ล็อกอิน -> หน้า login)

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      <div className="mb-6">
        <h1 className="text-[32px] font-medium text-black">จำลองโครงการ T-VER</h1>
        <p className="text-base font-medium text-[#6B7280]">เลือกวิธีคำนวณที่ต้องการ</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {MODES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group flex flex-col bg-white border border-[#F3F4F6] shadow-sm rounded-2xl p-8 transition hover:-translate-y-0.5 hover:border-[#75b898] hover:shadow-md"
          >
            <span className="mb-3 w-fit rounded-full bg-[#F2F8F5] px-3 py-1 text-xs font-semibold text-[#18794a]">{m.badge}</span>
            <h2 className="text-xl font-bold text-[#1F2937]">{m.title}</h2>
            <p className="mt-2 flex-1 text-base text-[#6B7280]">{m.description}</p>
            <span className="mt-6 text-base font-semibold text-[#18794a]">
              เลือกวิธีนี้ <span className="inline-block transition group-hover:translate-x-1">›</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
