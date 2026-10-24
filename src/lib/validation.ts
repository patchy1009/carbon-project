import {normalizeText, normalizeTextArea, normalizeNumberString, normalizeToArabicNumber, normalizeForCompare} from './normalization';

export type validationResult = 
| { ok : true }
| { ok : false, message : string };

const ok : validationResult = { ok : true };  //เก็บผลที่ผ่านการตรวจสอบ
const fail = (message : string) : validationResult => ({ ok : false, message });  //เก็บผลที่ไม่ผ่านการตรวจสอบ 
/*const fail = (message : string) : validationResult => {
    return {
        ok : false,
        message : message
    };
};*/

export type fieldRule = (value : string) => validationResult;

/* บังคับกรอกข้อมูล */ /*func return func 'closure'*/
export const required = (label : string) : fieldRule => {
    return (value : string) : validationResult => {
        if (value.trim() === ''){
            return fail('กรุณากรอก ' + label);
        }
        return ok;
    };
};
// เขียนแบบย่อ
/*export const required = 
    (label : string) : fieldRule => 
    (value) => 
        value.trim() === ''? fail('กรุณากรอก' + label) : ok;
*/    


/* ห้ามเป็นตัวเลขล้วน */
export const notNumericOnly = (label : string) : fieldRule => {
    return (value : string) : validationResult => {
        if (value.trim() === '') return ok;
        if (/[^\d\s.,\-]{5,}$/.test(value.trim())) return fail(label+'ห้ามเป็นตัวเลขล้วน')
        else return ok;
    };
};

/* ภาษาอังกฤษเท่านั้น */
export const englishOnly = (label : string) : fieldRule => {
    return (value : string) : validationResult => {
        if (value.trim() === '') return ok;
        if (/^[A-Za-z0-9/]+$/.test(value.trim())) return ok;
        else return fail(label+'กรุณากรอกเป็นภาษาอังกฤษเท่านั้น');
    };
};

/* ได้ทั้งภาษาอังกฤษและภาษาไทย */
export const thaiOrEnglishOnly = (label : string) : fieldRule => {
    return (value : string) : validationResult => {
        if (value.trim() === '') return ok;
        if (/^[\u0E00-\u0E7FA-Za-z0-9\s/]+$/.test(value.trim())) return ok;
        else return fail(label+'กรุณากรอกเป็นภาษาอังกฤษหรือภาษาไทยเท่านั้น');  
    };
};

/* จำกัดหลักทศนิยม + ห้ามติดลบ */
export const isDecimal = (label : string, opts : { allowNegative?: boolean, maxDecimals?: number }={} ) : fieldRule => {
    return (value : string) : validationResult => { 
        if (value.trim() === '') return ok;
        const num = normalizeToArabicNumber(value);
        const numstring = normalizeNumberString(value);
        if ( num === null ) return fail(label+'ต้องเป็นตัวเลข');
        // ตรวจว่าไม่ติดลบ
        if ( opts.allowNegative !== true && num < 0 ) return fail(label+'ห้ามติดลบ');
        // ตรวจว่ามีทศนิยมเกินกำหนดหรือไม่
        if ( opts.maxDecimals !== undefined ) {
            const decimalPart = numstring.split('.')[1]??'';
            if ( decimalPart.length > opts.maxDecimals ) {
                return fail(label+'จำนวนทศนิยมต้องไม่เกิน '+opts.maxDecimals+' หลัก');
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
        if ( num === null || Number.isNaN(num) ) return fail(label+'ต้องเป็นตัวเลข');
        if ( !Number.isInteger(num) || num <= 0) return fail(label+'ห้ามเป็นทศนิยมและต้องมีค่ามากกว่าศูนย์');
        return ok;
    };
};

/* -- เรียก normalizeและvalidate ทีเดียว -- */
/* ฟอร์ม 1 ช่องต้อง normalized + validate */
export type fieldSchema = {
    normalize? : (value : string) => string,  // ไม่ระบุจะ normalizeText
    rules : fieldRule[]   // รายการกฎ ตรวจตามลำดับ ไม่ผ่านข้อไหนจะหยุดตรวจ
};

export type formSchema<K extends string> = Record<K, fieldSchema>;  // กติกาที่ใช้ตรวจสอบ
export type formError<K extends string> = Partial<Record<K, string>>;  // แบบแผนของ error

// ผลลัฑธ์ของการตรวจสอบฟอร์ม 1 ช่อง
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
