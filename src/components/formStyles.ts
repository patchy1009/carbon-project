/* [กลาง] class ของช่องกรอกในฟอร์ม popup ฝั่ง admin (เดิมเขียนซ้ำไว้ 4 หน้า)
 * ใช้: <input className={inputClass(!!errors.name)} />  — true = กรอบแดง */
export const inputClass = (hasError?: boolean) =>
  `w-full border rounded-lg px-3 py-2 text-sm ${hasError ? 'border-red-500' : ''}`;
