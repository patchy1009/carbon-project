/* ===================== [MERGE aom + cyn2] =====================
 * โครงหลักของ component นี้ = โค้ด aom (แถบขั้นตอนแบบกดไม่ได้ บอกสถานะด้วยสี)
 * ส่วนที่รับมาจาก cyn2 = ขั้นที่ 3 "ข้อมูลการดำเนินกิจกรรมพื้นฐาน" (หน้า /organization/footprint/general_activity — cyn2 เปลี่ยนชื่อจาก activity_based)
 *   - cyn2 เดิมทำเป็นลิงก์ (กดข้ามขั้นได้) แต่ aom ตั้งใจให้กดไม่ได้ เพราะกดข้ามขั้นแล้วค่าที่กรอกค้างหาย
 *     จึงคงแบบของ aom และเข้าขั้นที่ 3 ผ่านปุ่มในกล่อง "บันทึกเสร็จสิ้น" ของขั้นที่ 2 แทน (ดู FootprintClient.tsx)
 * ============================================================== */

/* [aom] แถบแสดงขั้นตอนอย่างเดียว กดไม่ได้ทุกขั้น (บอกสถานะด้วยสี)
 *   เดิมเป็นลิงก์ไปหน้าเปล่า กดเลข 1 จากขั้นที่ 2 แล้วค่าที่กรอกถูกล้างและหลุดจากโหมดแก้ไข
 *   เปลี่ยนหน้าด้วยปุ่ม "ถัดไป" / "กลับ" เท่านั้น
 *   - ขั้นที่ผ่านมาแล้ว/ขั้นปัจจุบัน: วงกลมสีเขียว
 *   - ขั้นปัจจุบัน: ชื่อขั้นตัวดำ
 *   - ขั้นที่ยังไม่ถึง: สีเทา */
// [MERGE] current รับค่า 3 ได้ด้วย (cyn2 ใช้ <FootprintStepper current={3} /> ในหน้า general_activity)
export default function FootprintStepper({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'ข้อมูลสำนักงาน' }, // [aom]
    { n: 2, label: 'ข้อมูลการดำเนินกิจกรรม' }, // [aom]
    { n: 3, label: 'ข้อมูลการดำเนินกิจกรรมพื้นฐาน' }, // [cyn2] ขั้นที่ 3: กิจกรรมพิเศษ (ประชุม/อีเวนต์, การเดินทาง)
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
