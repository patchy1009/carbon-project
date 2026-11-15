// แปลง error ที่จับได้ใน catch ให้เป็นข้อความที่แสดงให้ผู้ใช้ได้
// รองรับทั้ง Error ปกติ และ error ของ Supabase (เป็น object ที่มี message แต่ไม่ใช่ Error)
// ถ้าไม่มีข้อความให้ใช้ข้อความกลาง ๆ แทน
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ กรุณาลองใหม่อีกครั้ง";
}
