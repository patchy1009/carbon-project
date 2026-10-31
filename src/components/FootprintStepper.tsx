/* [แก้ไข] แถบแสดงขั้นตอนอย่างเดียว กดไม่ได้ทุกขั้น (บอกสถานะด้วยสี)
 *   เดิมเป็นลิงก์ไปหน้าเปล่า กดเลข 1 จากขั้นที่ 2 แล้วค่าที่กรอกถูกล้างและหลุดจากโหมดแก้ไข
 *   เปลี่ยนหน้าด้วยปุ่ม "ถัดไป" / "กลับ" เท่านั้น
 *   - ขั้นที่ผ่านมาแล้ว/ขั้นปัจจุบัน: วงกลมสีเขียว
 *   - ขั้นปัจจุบัน: ชื่อขั้นตัวดำ
 *   - ขั้นที่ยังไม่ถึง: สีเทา */
export default function FootprintStepper({ current }: { current: 1 | 2 }) {
  const steps = [
    { n: 1, label: 'ข้อมูลสำนักงาน' },
    { n: 2, label: 'ข้อมูลการดำเนินกิจกรรม' },
  ];

  return (
    <ol className="mb-6 flex items-center gap-4" aria-label="ขั้นตอนการบันทึก">
      {steps.map((s, i) => {
        const active = s.n <= current; // ขั้นที่ถึงแล้วเป็นสีเขียว
        return (
          <li
            key={s.n}
            className="flex cursor-default select-none items-center gap-4"
            aria-current={s.n === current ? 'step' : undefined}
          >
            <span className="flex items-center gap-3">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${
                  active ? 'bg-[#6FB898] text-white' : 'bg-[#E2E8F0] text-[#94A3B8]'
                }`}
              >
                {s.n}
              </span>
              <span
                className={`text-lg font-semibold ${
                  s.n === current ? 'text-black' : 'text-[#94A3B8]'
                }`}
              >
                {s.label}
              </span>
            </span>
            {i < steps.length - 1 && <span className="h-px w-24 bg-[#BDC9C1]" />}
          </li>
        );
      })}
    </ol>
  );
}
