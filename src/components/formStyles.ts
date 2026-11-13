/* class ของช่องกรอกในฟอร์ม popup ฝั่ง admin (เดิมเขียนซ้ำไว้ 4 หน้า)
 * ใช้: <input className={inputClass(!!errors.name)} />  — true = กรอบแดง
 * เพิ่มสีเส้นขอบที่ชัดเจน (เดิมใช้สีเริ่มต้นของเบราว์เซอร์) และเส้นสีเขียวตอนกำลังพิมพ์ (focus)
 *   ให้รู้ว่ากำลังกรอกช่องไหนอยู่ ช่องที่ผิดยังเป็นกรอบแดงเหมือนเดิม */
export const inputClass = (hasError?: boolean) =>
  `w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:ring-2 ${
    hasError
      ? 'border-red-500 focus:ring-red-100'
      : 'border-[#CBD5E1] focus:border-[#32885F] focus:ring-[#32885F]/15'
  }`;
