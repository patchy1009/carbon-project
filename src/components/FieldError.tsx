/* [กลาง] ข้อความ error สีแดงใต้ช่องกรอก (ใช้คู่กับกรอบแดงของช่อง)
 * ใช้: <FieldError message={errors.name} />  — ไม่มีข้อความ = ไม่แสดงอะไร
 * [แก้ไข] เดิม export ชื่อ fieldError (ตัวเล็ก) และหน้าสำนักงาน&คำแนะนำมีตัวซ้ำชื่อ Err -> รวมเป็นตัวเดียว */
export default function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}
