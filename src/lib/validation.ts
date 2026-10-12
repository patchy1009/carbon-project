import { normalizeText, normalizeToArabicNumber, normalizeNumberString } from './normalization';

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

const OK: ValidationResult = { ok: true };
const fail = (message: string): ValidationResult => ({ ok: false, message });

/** ตัวตรวจ 1 ตัว = ฟังก์ชันที่รับข้อความ (ที่ normalize แล้ว) แล้วคืนผล */
export type FieldRule = (value: string) => ValidationResult;

export const required =
  (label: string): FieldRule =>
  (value) =>
    value === '' ? fail(`กรุณากรอก${label}`) : OK;

export const notNumericOnly =
  (label: string): FieldRule =>
  (value) => {
    if (value === '') return OK;
    return /^[\d\s.,\-]+$/.test(value)
      ? fail(`${label}ต้องไม่เป็นตัวเลขอย่างเดียว`)
      : OK;
  };

export const englishOnly =
  (label: string): FieldRule =>
  (value) => {
    if (value === '') return OK;
    return /^[A-Za-z0-9\s.,()\/%^_\-]+$/.test(value)
      ? OK
      : fail(`${label}ต้องเป็นภาษาอังกฤษ (ตัวเลขและสัญลักษณ์ . , ( ) / % ^ _ - ได้)`);
  };

export const thaiOrEnglish =
  (label: string): FieldRule =>
  (value) => {
    if (value === '') return OK;
    return /^[\u0E00-\u0E7FA-Za-z0-9\s.,()\/%^_\-]+$/.test(value)
      ? OK
      : fail(`${label}ต้องเป็นภาษาไทยหรืออังกฤษ`);
  };

export const isDecimal =
  (label: string, opts: { allowNegative?: boolean; maxDecimals?: number } = {}): FieldRule =>
  (value) => {
    if (value === '') return OK;

    const num = normalizeToArabicNumber(value);
    if (num === null) return fail(`${label}ต้องเป็นตัวเลข`);

    if (!opts.allowNegative && num < 0) {
      return fail(`${label}ต้องไม่เป็นค่าติดลบ`);
    }

    if (opts.maxDecimals !== undefined) {
      const decimals = normalizeNumberString(value).split('.')[1] ?? '';
      if (decimals.length > opts.maxDecimals) {
        return fail(`${label}ทศนิยมได้ไม่เกิน ${opts.maxDecimals} หลัก`);
      }
    }
    return OK;
  };

  export const isInteger =
  (label: string, opts: { min?: number; max?: number } = {}): FieldRule =>
  (value) => {
    if (value === '') return OK;
    if (!/^-?\d+$/.test(normalizeNumberString(value))) {
      return fail(`${label}ต้องเป็นเลขอารบิกจำนวนเต็ม`);
    }
    const n = Number(normalizeNumberString(value));
    if (opts.min !== undefined && n < opts.min) return fail(`${label}ต้องไม่น้อยกว่า ${opts.min}`);
    if (opts.max !== undefined && n > opts.max) return fail(`${label}ต้องไม่เกิน ${opts.max}`);
    return OK;
  };

  export type FieldSchema = {
  /** ฟังก์ชัน normalize ของช่องนี้ ถ้าไม่ระบุจะใช้ normalizeText */
  normalize?: (value: string) => string;
  /** กฎที่ตรวจเรียงตามลำดับ เจอข้อแรกที่ไม่ผ่านแล้วหยุด */
  rules: FieldRule[];
};

export type FormSchema<K extends string> = Record<K, FieldSchema>;
export type FormErrors<K extends string> = Partial<Record<K, string>>;

export type FormResult<K extends string> =
  | { ok: true; clean: Record<K, string> }
  | { ok: false; errors: FormErrors<K>; clean: Record<K, string> };

export function validateForm<K extends string>(
  values: Record<K, string>,
  schema: FormSchema<K>
): FormResult<K> {
  const clean = {} as Record<K, string>;
  const errors: FormErrors<K> = {};

  for (const key of Object.keys(schema) as K[]) {
    const { normalize = normalizeText, rules } = schema[key];
    const value = normalize(values[key] ?? '');   // (1) normalize ก่อน
    clean[key] = value;

    for (const rule of rules) {                   // (2) แล้วค่อย validate
      const r = rule(value);
      if (!r.ok) {
        errors[key] = r.message;                  // (3) เก็บ error แรกของช่องนี้
        break;
      }
    }
  }

  return Object.keys(errors).length === 0
    ? { ok: true, clean }
    : { ok: false, errors, clean };
}