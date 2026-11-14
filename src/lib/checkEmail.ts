// ใช้ฝั่งหน้าเว็บ: ถามระบบว่าอีเมลนี้มีบัญชีหรือยัง ก่อนขอลิงก์รีเซ็ตรหัสผ่าน (เรียก /api/auth/check-email)
// คืนข้อความภาษาไทยบอกเหตุผลถ้าส่งลิงก์ต่อไม่ได้ หรือ "" ถ้าส่งต่อได้
export async function checkEmailBeforeReset(email: string): Promise<string> {
  try {
    const response = await fetch("/api/auth/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (response.ok) return "";

    const data = await response.json().catch(() => ({}));
    return typeof data.error === "string" && data.error
      ? data.error
      : "ไม่สามารถตรวจสอบอีเมลได้ กรุณาลองใหม่อีกครั้ง";
  } catch {
    return "ไม่สามารถเชื่อมต่อระบบเพื่อตรวจสอบอีเมลได้ กรุณาลองใหม่อีกครั้ง";
  }
}
