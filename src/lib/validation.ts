import {
  normalizeText,
  normalizeNumberString,
  normalizeToArabicNumber,
  normalizeForCompare,
  fileExtension,
  type ConditionOperator,
} from './normalization';

export type validationResult =
| { ok : true }
| { ok : false, message : string };

const ok : validationResult = { ok : true };  //เก็บผลที่ผ่านการตรวจสอบ
const fail = (message : string) : validationResult => ({ ok : false, message });  //เก็บผลที่ไม่ผ่านการตรวจสอบ

export type fieldRule = (value : string) => validationResult;

/* =====================================================================
 * กฎตรวจ 1 ช่อง (fieldRule)
 * - ทุกกฎ (ยกเว้น required) "ปล่อยผ่าน" ค่าว่าง เพื่อให้ช่องไม่บังคับกรอกเว้นว่างได้
 *   ช่องไหนบังคับกรอกให้ใส่ required(...) เป็นกฎแรก
 * - value ที่เข้ามาถูก normalize แล้ว (validateForm ทำให้ก่อน)
 * ===================================================================== */

/* บังคับกรอกข้อมูล */ /*func return func 'closure'*/
export const required = (label : string) : fieldRule => {
    return (value : string) : validationResult => {
        if (value.trim() === ''){
            return fail('กรุณากรอก' + label);
        }
        return ok;
    };
};

/* บังคับเลือก (ใช้กับ dropdown ให้ข้อความเหมาะกว่า "กรุณากรอก") [เพิ่มใหม่] */
export const requiredSelect = (label : string) : fieldRule => {
    return (value : string) : validationResult =>
        value.trim() === '' ? fail('กรุณาเลือก' + label) : ok;
};

/* ห้ามเป็นตัวเลขล้วน
 * [แก้ไข] เดิม regex /[^\d\s.,\-]{5,}$/ หมายถึง "ลงท้ายด้วยตัวอักษรที่ไม่ใช่ตัวเลข 5 ตัวขึ้นไป"
 *   ทำให้ชื่อปกติอย่าง "Diesel" หรือ "น้ำมันดีเซล" ไม่ผ่าน แต่ "12345" กลับผ่าน (กลับด้าน)
 *   ตอนนี้: ไม่ผ่านเมื่อประกอบด้วยตัวเลข/ช่องว่าง/จุด/comma/ขีด อย่างเดียว เช่น "123", "1,000.5", "12-34" */
export const notNumericOnly = (label : string) : fieldRule => {
    return (value : string) : validationResult => {
        const v = normalizeNumberString(value); // แปลงเลขไทยด้วย กัน "๑๒๓" หลุดรอด
        if (value.trim() === '') return ok;
        if (/^[\d.\-]+$/.test(v)) return fail(label + ' ห้ามเป็นตัวเลขล้วน');
        return ok;
    };
};

/* ภาษาอังกฤษเท่านั้น (ใช้กับหน่วย/ชื่อประเภท เช่น kWh, kgCO2e/L, Stationary Combustion)
 * [แก้ไข] เดิมรับแค่ A-Z 0-9 และ / ทำให้ "Stationary Combustion" (มี space), "m³", "kgCO2e/kWh.",
 *   "Litre (L)" ไม่ผ่าน ตอนนี้รับ space และเครื่องหมายที่ใช้ในหน่วยได้ด้วย */
const ENGLISH_CHARS = /^[A-Za-z0-9\s/.\-_()%²³·,+*^']+$/;
export const englishOnly = (label : string) : fieldRule => {
    return (value : string) : validationResult => {
        if (value.trim() === '') return ok;
        if (!/[A-Za-z]/.test(value)) return fail(label + ' ต้องมีตัวอักษรภาษาอังกฤษ'); // กัน "123" หรือ "///"
        if (ENGLISH_CHARS.test(value.trim())) return ok;
        return fail(label + ' กรุณากรอกเป็นภาษาอังกฤษเท่านั้น');
    };
};

/* ได้ทั้งภาษาอังกฤษและภาษาไทย (ใช้กับหน่วยที่เป็นภาษาไทยได้ เช่น คน, ไร่, ตร.ม., kWh/ปี)
 * [แก้ไข] เพิ่มเครื่องหมายแบบเดียวกับ englishOnly เพราะ "ตร.ม." หรือ "ครั้ง/ปี" เดิมไม่ผ่าน */
const THAI_ENGLISH_CHARS = /^[฀-๿A-Za-z0-9\s/.\-_()%²³·,+*^']+$/;
export const thaiOrEnglishOnly = (label : string) : fieldRule => {
    return (value : string) : validationResult => {
        if (value.trim() === '') return ok;
        if (THAI_ENGLISH_CHARS.test(value.trim())) return ok;
        return fail(label + ' กรุณากรอกเป็นภาษาไทยหรือภาษาอังกฤษเท่านั้น');
    };
};

/* จำกัดความยาวข้อความ [เพิ่มใหม่]
 * ใช้คู่กับ maxLength ของ <input> แต่ต้องตรวจซ้ำที่นี่ด้วย เพราะการวาง (paste) / แก้ HTML ข้ามได้ */
export const maxLength = (label : string, max : number) : fieldRule => {
    return (value : string) : validationResult =>
        [...value].length > max  // นับตามตัวอักษรจริง (สระ/วรรณยุกต์ไทยนับแยก ตามที่ DB นับ)
            ? fail(label + ' ต้องไม่เกิน ' + max + ' ตัวอักษร')
            : ok;
};

/* ตัวเลขทศนิยม: จำกัดหลักทศนิยม + ห้ามติดลบ + ช่วงค่า
 * [แก้ไข] เพิ่ม min / max (เช่น เปอร์เซ็นต์ 0-100) และ allowZero
 *   เดิมเช็กติดลบไม่ได้จริง เพราะ normalizeToArabicNumber คืน null กับเลขติดลบ (แก้ที่ normalization แล้ว) */
export const isDecimal = (
    label : string,
    opts : { allowNegative?: boolean, allowZero?: boolean, maxDecimals?: number, min?: number, max?: number } = {}
) : fieldRule => {
    return (value : string) : validationResult => {
        if (value.trim() === '') return ok;
        const num = normalizeToArabicNumber(value);
        const numstring = normalizeNumberString(value);
        if ( num === null ) return fail(label + ' ต้องเป็นตัวเลข');
        // ตรวจว่าไม่ติดลบ
        if ( opts.allowNegative !== true && num < 0 ) return fail(label + ' ห้ามติดลบ');
        // ตรวจค่าศูนย์ (เช่น ค่า EF / GWP เป็น 0 ไม่มีความหมาย)
        if ( opts.allowZero === false && num === 0 ) return fail(label + ' ต้องมากกว่า 0');
        // ตรวจช่วงค่า
        if ( opts.min !== undefined && num < opts.min ) return fail(label + ' ต้องไม่น้อยกว่า ' + opts.min);
        if ( opts.max !== undefined && num > opts.max ) return fail(label + ' ต้องไม่เกิน ' + opts.max);
        // ตรวจว่ามีทศนิยมเกินกำหนดหรือไม่
        if ( opts.maxDecimals !== undefined ) {
            const decimalPart = numstring.split('.')[1] ?? '';
            if ( decimalPart.length > opts.maxDecimals ) {
                return opts.maxDecimals === 0
                    ? fail(label + ' ต้องเป็นจำนวนเต็ม')
                    : fail(label + ' จำนวนทศนิยมต้องไม่เกิน ' + opts.maxDecimals + ' หลัก');
            }
        }
        return ok;
    };
};

/* จำนวนเต็มบวกเท่านั้น */
export const isPositiveInteger = (label : string) : fieldRule => {
    return (value : string) : validationResult => {
        if (value.trim() === '') return ok;
        const num = normalizeToArabicNumber(value);
        if ( num === null ) return fail(label + ' ต้องเป็นตัวเลข');
        if ( !Number.isInteger(num) || num <= 0) return fail(label + ' ต้องเป็นจำนวนเต็มที่มากกว่าศูนย์');
        return ok;
    };
};

/* ห้ามซ้ำกับข้อมูลที่มีอยู่ [เพิ่มใหม่]
 * existing = ค่าเดิมในตาราง "ไม่รวม" แถวที่กำลังแก้ไข (ไม่งั้นแก้แถวเดิมแล้วจะซ้ำกับตัวเอง)
 * เทียบแบบไม่สนตัวพิมพ์เล็ก/ใหญ่และช่องว่าง: "Diesel" = "diesel" = " DIESEL " */
export const notDuplicate = (
    label : string,
    existing : ReadonlyArray<string | number | null | undefined>
) : fieldRule => {
    const seen = new Set(existing.map((e) => normalizeForCompare(e == null ? '' : String(e))));
    return (value : string) : validationResult => {
        if (value.trim() === '') return ok;
        return seen.has(normalizeForCompare(value)) ? fail(label + ' นี้มีอยู่แล้ว') : ok;
    };
};

/* ค่าที่เลือกต้องมีอยู่จริงในตารางที่อ้างถึง (ตรวจความสัมพันธ์ระหว่างตาราง) [เพิ่มใหม่]
 * เช่น scope_id ที่เลือกต้องอยู่ใน carbon_scope จริง กันกรณีข้อมูลถูกลบไปแล้วแต่ dropdown ยังค้าง */
export const existsIn = (label : string, ids : ReadonlyArray<string>) : fieldRule => {
    const set = new Set(ids);
    return (value : string) : validationResult => {
        if (value.trim() === '') return ok;
        return set.has(value) ? ok : fail(label + ' ที่เลือกไม่มีอยู่ในระบบแล้ว กรุณาเลือกใหม่');
    };
};

/* ช่องที่ต้องกรอก "คู่กัน" [เพิ่มใหม่] เช่น เลือกตัวดำเนินการแล้วต้องกรอกตัวเลขด้วย
 * otherValue = ค่าของอีกช่อง (ส่งเข้ามาตอน submit เพราะ fieldRule เห็นแค่ค่าของช่องตัวเอง)
 * ช่องนี้ว่าง แต่อีกช่องมีค่า -> ไม่ผ่าน / ว่างทั้งคู่ = ไม่มีเงื่อนไข ผ่าน */
export const requiredWith = (label : string, otherValue : string) : fieldRule => {
    return (value : string) : validationResult =>
        value.trim() === '' && otherValue.trim() !== '' ? fail('กรุณาระบุ' + label + 'ด้วย') : ok;
};

/* วันที่รูปแบบ YYYY-MM-DD (ค่าจาก <input type="date">) และอยู่ในช่วงปี ค.ศ. ที่กำหนด [เพิ่มใหม่] */
export const isDate = (label : string, opts : { minYear?: number, maxYear?: number } = {}) : fieldRule => {
    return (value : string) : validationResult => {
        if (value.trim() === '') return ok;
        const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return fail(label + ' ไม่ถูกต้อง');
        const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const dt = new Date(Date.UTC(y, mo - 1, d));
        // new Date รับ 2025-02-31 แล้วเลื่อนเป็น มี.ค. ให้เอง จึงต้องเทียบกลับว่ายังเป็นวันเดิม
        if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
            return fail(label + ' ไม่มีอยู่จริง');
        }
        if (opts.minYear !== undefined && y < opts.minYear) return fail(label + ' ต้องไม่ก่อนปี ' + (opts.minYear + 543));
        if (opts.maxYear !== undefined && y > opts.maxYear) return fail(label + ' ต้องไม่เกินปี ' + (opts.maxYear + 543));
        return ok;
    };
};

/* =====================================================================
 * ตรวจไฟล์ที่แนบ [เพิ่มใหม่] (ขนาด + นามสกุล) ใช้ก่อนอัปโหลดขึ้น Storage
 * ===================================================================== */
export function validateFile(
    file : File,
    opts : { label?: string, maxBytes : number, extensions : string[] }
) : validationResult {
    const label = opts.label ?? 'ไฟล์';
    const ext = fileExtension(file.name);
    if (!opts.extensions.includes(ext)) {
        return fail(label + ' ต้องเป็นนามสกุล ' + opts.extensions.map((e) => e.toUpperCase()).join(', ') + ' เท่านั้น');
    }
    if (file.size === 0) return fail(label + ' ว่างเปล่า');
    if (file.size > opts.maxBytes) {
        return fail(label + ' ต้องมีขนาดไม่เกิน ' + Math.round(opts.maxBytes / 1024 / 1024) + ' MB');
    }
    return ok;
}

/* เทียบตัวเลขกับเงื่อนไข เช่น meetsCondition(1200, '<=', 1000) -> false [เพิ่มใหม่] */
export function meetsCondition(value : number, operator : ConditionOperator, target : number) : boolean {
    switch (operator) {
        case '>': return value > target;
        case '>=': return value >= target;
        case '<': return value < target;
        case '<=': return value <= target;
        case '=': return value === target;
    }
}

/* =====================================================================
 * เรียก normalize และ validate ทีเดียวทั้งฟอร์ม
 * ===================================================================== */
/* ฟอร์ม 1 ช่องต้อง normalized + validate */
export type fieldSchema = {
    normalize? : (value : string) => string,  // ไม่ระบุจะ normalizeText
    rules : fieldRule[]   // รายการกฎ ตรวจตามลำดับ ไม่ผ่านข้อไหนจะหยุดตรวจ
};

export type formSchema<K extends string> = Record<K, fieldSchema>;  // กติกาที่ใช้ตรวจสอบ
export type formError<K extends string> = Partial<Record<K, string>>;  // แบบแผนของ error

// ผลลัพธ์ของการตรวจสอบทั้งฟอร์ม
export type formResult<K extends string> =
    | { ok : true, clean : Record<K, string> }
    | { ok : false, errors : formError<K>, clean : Record<K, string> };  //เก็บค่าที่ normalize แล้วของแต่ละ field

export function validateForm<K extends string>(
    formData : Record<K, string>,
    schema : formSchema<K>
) : formResult<K> {
    const clean = {} as Record<K, string>;
    const errors : formError<K> = {};

    for ( const key of Object.keys(schema) as K[] ) {
        const { normalize = normalizeText, rules } = schema[key];
        const value = normalize(formData[key] ?? '');  // normalize
        clean[key] = value;

        for ( const rule of rules ) {       // validate ตามลำดับ ถ้าไม่ผ่านข้อไหนจะหยุดตรวจ
            const result = rule(value);
            if ( !result.ok ) {
                errors[key] = result.message;     // เก็บ error ที่เจอ
                break;  //หยุดตรวจข้ออื่นๆ ของ field นี้
            }
        }
    }

    return Object.keys(errors).length === 0
        ? { ok : true, clean }
        : { ok : false, clean, errors };
}

/* เพิ่มกฎตอน runtime ต่อท้าย schema เดิม [เพิ่มใหม่]
 * schema ในไฟล์ schema.ts เป็นค่าคงที่ จึงใส่กฎที่ต้องใช้ข้อมูลจากหน้าจอ (เช่น ห้ามซ้ำ / ต้องมีอยู่จริง) ไม่ได้
 * ใช้: validateForm(form, extendSchema(efSchema, { ef_name: [notDuplicate('ชื่อ EF', names)] })) */
export function extendSchema<K extends string>(
    schema : formSchema<K>,
    extra : Partial<Record<K, fieldRule[]>>
) : formSchema<K> {
    const out = { ...schema };
    for ( const key of Object.keys(extra) as K[] ) {
        out[key] = { ...schema[key], rules: [...schema[key].rules, ...(extra[key] ?? [])] };
    }
    return out;
}
