import { required, requiredSelect, notNumericOnly, englishOnly, isDecimal, maxLength, type formSchema } from "@/lib/validation";
import { normalizeNumberString } from "@/lib/normalization";

/* กฎที่ "ต้องใช้ข้อมูลบนหน้าจอ" (ห้ามซ้ำ / ประเภทที่เลือกต้องมีอยู่จริง) ใส่เพิ่มตอน submit
 * ด้วย extendSchema(...) ใน EfGwpClient.tsx เพราะ schema ในไฟล์นี้เป็นค่าคงที่ */

/* ค่า EF */
export type EfField = 'eftype_id'| 'ef_name' | 'ef_value' | 'real_unit';

export const efSchema : formSchema<EfField> = {
    eftype_id: {
        rules: [requiredSelect('ประเภท EF')], // [แก้ไข] ข้อความ "กรุณาเลือก" แทน "กรุณากรอก" เพราะเป็น dropdown
    },
    ef_name: {
        rules: [required('ชื่อ EF'), notNumericOnly('ชื่อ EF'), maxLength('ชื่อ EF', 150)],
    },
    ef_value: {
        normalize: normalizeNumberString, //แปลงเลขไทย + ลบ,ก่อนตรวจ
        // [แก้ไข] เพิ่ม allowZero:false เพราะค่า EF = 0 ทำให้ผลคำนวณการปล่อยก๊าซเป็น 0 เสมอ
        rules: [required('ค่า EF'), isDecimal('ค่า EF', { allowNegative: false, allowZero: false, maxDecimals: 6 })],
    },
    real_unit: {
        rules: [required('หน่วย'), englishOnly('หน่วย'), maxLength('หน่วย', 50)],
    },
};

/* ประเภท EF */
export type EfTypeField = 'type_name' ;

export const efTypeSchema : formSchema<EfTypeField> = {
    type_name: {
        rules: [required('ประเภท EF'), englishOnly('ประเภท EF'), notNumericOnly('ประเภท EF'), maxLength('ประเภท EF', 100)],
    },
};

/* ค่า GWP */
export type GwpField = 'gas_name' | 'gwp_value' ;

export const gwpSchema : formSchema<GwpField> = {
    gas_name: {
        rules: [required('ชื่อก๊าซ'), notNumericOnly('ชื่อก๊าซ'), maxLength('ชื่อก๊าซ', 100)],
    },
    gwp_value: {
        normalize: normalizeNumberString, //แปลงเลขไทย + ลบ,ก่อนตรวจ
        // [แก้ไข] GWP = 0 ไม่มีความหมาย (CO2 = 1 คือค่าต่ำสุดตามนิยาม)
        rules: [required('ค่า GWP'), isDecimal('ค่า GWP', { allowNegative: false, allowZero: false, maxDecimals: 6 })],
    },
};
