/*import { normalizeText, normalizeTextArea, normalizeNumberString, normalizeToArabicNumber, normalizeForCompare } from './normalization';
console.log(normalizeText('  CO2   emission \u200B ')); // Output: "สวัสดี โลก"atch
console.log(normalizeTextArea('  CO2   emission \n\n\n\n  ')); // Output: "สวัสดี โลก"
console.log(normalizeNumberString('  ๑,๒๓๔.๕๖  '));
console.log(normalizeToArabicNumber('  ๑,๒๓๔.๕๖  '));
console.log(normalizeToArabicNumber('abc')); // Output: null
console.log(normalizeForCompare('  Methane')); // Output: "สวัสดี โลก"
*/


import {
    required,
    notNumericOnly,
    englishOnly,
    thaiOrEnglishOnly,
    isDecimal,
    isPositiveInteger,
} from './validation';

import type { validationResult } from './validation';

// ==========================================
// ฟังก์ชันช่วยทดสอบ
// ==========================================

let total = 0;
let passed = 0;
let failed = 0;

function test(
    name: string,
    validator: (value: string) => validationResult,
    value: string,
    expectedOk: boolean,
    expectedMessage?: string
): void {
    total++;

    const result = validator(value);

    const okMatches = result.ok === expectedOk;

    const messageMatches =
        expectedMessage === undefined ||
        (
            result.ok === false &&
            result.message.includes(expectedMessage)
        );

    const success = okMatches && messageMatches;

    if (success) {
        passed++;
    } else {
        failed++;
    }

    console.log(
        `${success ? '✅ PASS' : '❌ FAIL'} | ${name}`
    );

    console.log('   ค่าที่ทดสอบ:', JSON.stringify(value));
    console.log('   ผลลัพธ์จริง:', result);
    console.log('   ผลที่คาดหวัง:', expectedOk ? 'ผ่าน' : 'ไม่ผ่าน');

    if (!success) {
        console.log('   ⚠️ ตรวจสอบเงื่อนไขหรือข้อความแจ้งเตือน');
    }

    console.log('------------------------------');
}

// ==========================================
// 1. required()
// ==========================================

console.log('\n========== 1. REQUIRED ==========');

const checkRequired = required('ชื่อ');

test(
    'กรอกชื่อปกติ',
    checkRequired,
    'สมชาย',
    true
);

test(
    'ไม่กรอกข้อมูล',
    checkRequired,
    '',
    false,
    'กรุณากรอกชื่อ'
);

test(
    'กรอกช่องว่างอย่างเดียว',
    checkRequired,
    '   ',
    false,
    'กรุณากรอกชื่อ'
);

test(
    'มีช่องว่างก่อนและหลังชื่อ',
    checkRequired,
    '  สมชาย  ',
    true
);

// ==========================================
// 2. notNumericOnly()
// ==========================================

console.log('\n========== 2. NOT NUMERIC ONLY ==========');

const checkNotNumeric = notNumericOnly('ชื่อ');

test(
    'ข้อความภาษาอังกฤษ',
    checkNotNumeric,
    'Somchai',
    true
);

test(
    'ข้อความภาษาไทย',
    checkNotNumeric,
    'สมชาย',
    true
);

test(
    'ตัวเลขล้วน',
    checkNotNumeric,
    '12345',
    false,
    'ห้ามเป็นตัวเลขล้วน'
);

test(
    'ตัวเลขและช่องว่าง',
    checkNotNumeric,
    '123 456',
    false,
    'ห้ามเป็นตัวเลขล้วน'
);

test(
    'ข้อความสั้น',
    checkNotNumeric,
    'ABC',
    true
);

test(
    'ค่าว่าง',
    checkNotNumeric,
    '',
    true
);

// ==========================================
// 3. englishOnly()
// ==========================================

console.log('\n========== 3. ENGLISH ONLY ==========');

const checkEnglish = englishOnly('ชื่อ');

test(
    'ภาษาอังกฤษ',
    checkEnglish,
    'Somchai',
    true
);

test(
    'ภาษาอังกฤษผสมตัวเลข',
    checkEnglish,
    'Somchai123',
    true
);

test(
    'ตัวเลขล้วน',
    checkEnglish,
    '12345',
    true
);

test(
    'เครื่องหมาย /',
    checkEnglish,
    'ABC/DEF',
    true
);

test(
    'ภาษาไทย',
    checkEnglish,
    'สมชาย',
    false,
    'กรุณากรอกเป็นภาษาอังกฤษเท่านั้น'
);

test(
    'ภาษาอังกฤษมีช่องว่าง',
    checkEnglish,
    'Somchai Jaidee',
    false
);

test(
    'อักขระพิเศษ',
    checkEnglish,
    'ABC@123',
    false
);

test(
    'ค่าว่าง',
    checkEnglish,
    '',
    true
);

// ==========================================
// 4. thaiOrEnglishOnly()
// ==========================================

console.log('\n========== 4. THAI OR ENGLISH ONLY ==========');

const checkThaiEnglish = thaiOrEnglishOnly('ชื่อ');

test(
    'ภาษาไทย',
    checkThaiEnglish,
    'สมชาย',
    true
);

test(
    'ภาษาอังกฤษ',
    checkThaiEnglish,
    'Somchai',
    true
);

test(
    'ภาษาไทยผสมภาษาอังกฤษ',
    checkThaiEnglish,
    'สมชาย Somchai',
    true
);

test(
    'ภาษาไทยผสมตัวเลข',
    checkThaiEnglish,
    'สมชาย123',
    true
);

test(
    'ข้อความมีช่องว่าง',
    checkThaiEnglish,
    'Somchai Jaidee',
    true
);

test(
    'เครื่องหมาย /',
    checkThaiEnglish,
    'ABC/สมชาย',
    true
);

test(
    'อักขระ @',
    checkThaiEnglish,
    'Somchai@123',
    false,
    'กรุณากรอกเป็นภาษาอังกฤษหรือภาษาไทยเท่านั้น'
);

test(
    'เครื่องหมาย !',
    checkThaiEnglish,
    'สมชาย!',
    false
);

test(
    'ค่าว่าง',
    checkThaiEnglish,
    '',
    true
);

// ==========================================
// 5. isDecimal()
// ==========================================

console.log('\n========== 5. IS DECIMAL ==========');

const checkDecimal = isDecimal('น้ำหนัก', {
    allowNegative: false,
    maxDecimals: 2,
});

test(
    'จำนวนเต็ม',
    checkDecimal,
    '55',
    true
);

test(
    'ทศนิยม 1 ตำแหน่ง',
    checkDecimal,
    '55.5',
    true
);

test(
    'ทศนิยม 2 ตำแหน่ง',
    checkDecimal,
    '55.25',
    true
);

test(
    'ทศนิยมเกิน 2 ตำแหน่ง',
    checkDecimal,
    '55.123',
    false,
    'จำนวนทศนิยม'
);

test(
    'ข้อความที่ไม่ใช่ตัวเลข',
    checkDecimal,
    'abc',
    false,
    'ต้องเป็นตัวเลข'
);

test(
    'ค่าว่าง',
    checkDecimal,
    '',
    true
);

// ทดสอบเลขไทยและ comma ตามความสามารถของ normalization
test(
    'เลขไทยและ comma',
    checkDecimal,
    '๑,๒๓๔.๕๖',
    true
);

// ==========================================
// 6. isDecimal() อนุญาตค่าติดลบ
// ==========================================

console.log('\n========== 6. DECIMAL WITH NEGATIVE ==========');

const checkNegativeDecimal = isDecimal('อุณหภูมิ', {
    allowNegative: true,
    maxDecimals: 2,
});

test(
    'จำนวนติดลบ',
    checkNegativeDecimal,
    '-5',
    true
);

test(
    'ทศนิยมติดลบ',
    checkNegativeDecimal,
    '-5.25',
    true
);

test(
    'ทศนิยมติดลบเกิน 2 ตำแหน่ง',
    checkNegativeDecimal,
    '-5.123',
    false
);

// ==========================================
// 7. isPositiveInteger()
// ==========================================

console.log('\n========== 7. POSITIVE INTEGER ==========');

const checkInteger = isPositiveInteger('อายุ');

test(
    'จำนวนเต็มบวก',
    checkInteger,
    '18',
    true
);

test(
    'จำนวนเต็มบวกหลายหลัก',
    checkInteger,
    '100',
    true
);

test(
    'เลขศูนย์',
    checkInteger,
    '0',
    false
);

test(
    'จำนวนติดลบ',
    checkInteger,
    '-5',
    false
);

test(
    'จำนวนทศนิยม',
    checkInteger,
    '1.5',
    false
);

test(
    'ตัวอักษรแทนตัวเลข',
    checkInteger,
    'abc',
    false
);

test(
    'ค่าว่าง',
    checkInteger,
    '',
    true
);

test(
    'เลขไทย',
    checkInteger,
    '๑๘',
    true
);

// ==========================================
// สรุปผลการทดสอบทั้งหมด
// ==========================================

console.log('\n========== TEST SUMMARY ==========');
console.log('จำนวนที่ทดสอบทั้งหมด:', total);
console.log('ผ่าน:', passed);
console.log('ไม่ผ่าน:', failed);

if (failed === 0) {
    console.log('🎉 การทดสอบทั้งหมดผ่าน');
} else {
    console.log('⚠️ ยังมีการทดสอบที่ไม่ผ่าน กรุณาตรวจสอบด้านบน');
}


