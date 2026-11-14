// แปลง error ที่จับได้ใน catch ให้เป็นข้อความภาษาไทยที่แสดงให้ผู้ใช้ได้
// รองรับทั้ง Error ปกติ และ error ของ Supabase (เป็น object ที่มี message แต่ไม่ใช่ Error)
//
// ปัญหาที่แก้: Supabase ส่งข้อความ error เป็นภาษาอังกฤษ
//   เช่น "New password should be different from the old password."
//   ถ้านำ error.message ไปแสดงตรง ๆ ผู้ใช้จะเห็นภาษาอังกฤษปนในระบบที่เป็นภาษาไทย
// วิธีแก้: ทุกหน้าเรียก getErrorMessage() ที่เดียว แล้วแปลตามลำดับนี้
//   1) ข้อความที่เป็นภาษาไทยอยู่แล้ว (เราเขียนเองเช่น throw new Error("...")) -> ใช้ตามเดิม
//   2) แปลตาม code ของ Supabase Auth / Postgres
//   3) แปลตามรูปแบบข้อความ (กรณีไม่มี code เช่น error ฝั่ง client)
//   4) ไม่รู้จักเลย -> ข้อความกลางภาษาไทย (ข้อความจริงยังดูได้ใน console สำหรับนักพัฒนา)

const GENERIC_MESSAGE = "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ กรุณาลองใหม่อีกครั้ง";

const HAS_THAI = /[฀-๿]/;

// code ของ Supabase Auth ดูรายการได้ที่ https://supabase.com/docs/guides/auth/debugging/error-codes
const AUTH_CODE_MESSAGES: Record<string, string> = {
  same_password: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม",
  weak_password: "รหัสผ่านคาดเดาง่ายเกินไป กรุณาตั้งรหัสผ่านที่ปลอดภัยกว่านี้",
  otp_expired: "รหัส OTP หรือลิงก์หมดอายุแล้ว หรือไม่ถูกต้อง กรุณาขอใหม่อีกครั้ง",
  invalid_credentials: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  email_not_confirmed: "ยังไม่ได้ยืนยันอีเมล กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ",
  email_exists: "อีเมลนี้ถูกลงทะเบียนใช้งานไปแล้ว กรุณาเข้าสู่ระบบ",
  user_already_exists: "อีเมลนี้ถูกลงทะเบียนใช้งานไปแล้ว กรุณาเข้าสู่ระบบ",
  email_address_invalid: "รูปแบบอีเมลไม่ถูกต้อง",
  validation_failed: "ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
  user_not_found: "ไม่พบบัญชีผู้ใช้นี้",
  session_expired: "การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  session_not_found: "การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  bad_jwt: "การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  flow_state_expired: "ลิงก์หมดอายุแล้ว กรุณาขอลิงก์ใหม่อีกครั้ง",
  flow_state_not_found: "ลิงก์ไม่ถูกต้องหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่อีกครั้ง",
  bad_code_verifier: "กรุณาเปิดลิงก์ในเบราว์เซอร์เดียวกับที่ขอ หรือขอลิงก์ใหม่อีกครั้ง",
  over_request_rate_limit: "ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
  over_email_send_rate_limit: "ขอส่งอีเมลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
  signup_disabled: "ขณะนี้ปิดรับสมัครสมาชิกใหม่",
  user_banned: "บัญชีนี้ถูกระงับการใช้งาน",
};

// code ของ Postgres (ใช้ชุดเดียวกับ dbErrorMessage ใน supabaseCrud.ts)
const DB_CODE_MESSAGES: Record<string, string> = {
  "23505": "มีข้อมูลนี้อยู่แล้ว (ข้อมูลซ้ำ)",
  "23503": "ข้อมูลนี้ถูกใช้อ้างอิงอยู่ หรือข้อมูลที่อ้างถึงไม่มีอยู่แล้ว",
  "23502": "กรอกข้อมูลไม่ครบ",
  "23514": "ข้อมูลไม่ผ่านเงื่อนไขของตาราง",
  "22P02": "รูปแบบข้อมูลไม่ถูกต้อง",
  "42501": "ไม่มีสิทธิ์ทำรายการนี้",
};

// แปลตามรูปแบบข้อความ เผื่อ error ที่ไม่มี code (เช่น error ฝั่ง client ของ supabase-js)
const MESSAGE_PATTERNS: Array<[RegExp, string]> = [
  [/new password should be different/i, AUTH_CODE_MESSAGES.same_password],
  [/password should be at least|password is known to be weak|weak password/i, AUTH_CODE_MESSAGES.weak_password],
  [/token has expired|otp.*expired|invalid or has expired|expired or is invalid/i, AUTH_CODE_MESSAGES.otp_expired],
  [/invalid login credentials/i, AUTH_CODE_MESSAGES.invalid_credentials],
  [/email not confirmed/i, AUTH_CODE_MESSAGES.email_not_confirmed],
  [/user already registered|already been registered/i, AUTH_CODE_MESSAGES.user_already_exists],
  [/unable to validate email|invalid format|email address .* is invalid/i, AUTH_CODE_MESSAGES.email_address_invalid],
  [/email rate limit exceeded/i, "ระบบส่งอีเมลถึงขีดจำกัดชั่วคราว กรุณารอสักครู่แล้วลองใหม่"],
  [/auth session missing|session.*(missing|expired|not found)/i, AUTH_CODE_MESSAGES.session_expired],
  [/code verifier/i, AUTH_CODE_MESSAGES.bad_code_verifier],
  [/failed to fetch|fetch failed|network ?error|network request failed|load failed/i,
    "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"],
  [/row-level security|permission denied/i, DB_CODE_MESSAGES["42501"]],
  [/duplicate key/i, DB_CODE_MESSAGES["23505"]],
];

function readString(error: unknown, key: "message" | "code"): string {
  if (typeof error !== "object" || error === null) return "";
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

export function getErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message.trim() : readString(error, "message");
  const code = readString(error, "code");

  // 1) เป็นภาษาไทยอยู่แล้ว (ข้อความที่เราเขียนเอง) ใช้ตามเดิม
  if (message && HAS_THAI.test(message)) return message;

  // Supabase บอกให้รอกี่วินาทีมาในข้อความ: "For security purposes, you can only request this after 49 seconds."
  const waitSeconds = message.match(/after (\d+) seconds?/i)?.[1];
  if (waitSeconds) return `ขอถี่เกินไป กรุณารอ ${waitSeconds} วินาทีแล้วลองใหม่อีกครั้ง`;

  // 2) แปลตาม code
  if (code && (AUTH_CODE_MESSAGES[code] || DB_CODE_MESSAGES[code])) {
    return AUTH_CODE_MESSAGES[code] ?? DB_CODE_MESSAGES[code];
  }

  // 3) แปลตามรูปแบบข้อความ
  for (const [pattern, thai] of MESSAGE_PATTERNS) {
    if (pattern.test(message)) return thai;
  }

  // 4) ไม่รู้จัก: แสดงข้อความกลางเป็นภาษาไทย ส่วนข้อความจริงเก็บไว้ดูใน console
  if (message) console.warn("[getErrorMessage] ข้อความ error ที่ยังไม่ได้แปล:", code, message);
  return GENERIC_MESSAGE;
}
