import { required, notNumericOnly, englishOnly, isDecimal, type formSchema } from "@/lib/validation";
import { normalizeNumberString } from "@/lib/normalization";

/* ค่า EF */
export type EfField = 'eftype_id'| 'ef_name' | 'ef_value' | 'real_unit';

export const efSchema : formSchema<EfField> = {
    eftype_id: {
        rules: [required('ประเภท EF')],
    },
    ef_name: {
        rules: [required('ชื่อ EF'), notNumericOnly('ชื่อ EF')],
    },
    ef_value: {
        normalize: normalizeNumberString, //แปลงเลขไทย + ลบ,ก่อนตรวจ
        rules: [required('ค่า EF'), isDecimal('ค่า EF', { allowNegative: false, maxDecimals: 6 })],
    },
    real_unit: {
        rules: [required('หน่วย'), englishOnly('หน่วย')],
    },
};

/* ประเภท EF */
export type EfTypeField = 'type_name' ;

export const efTypeSchema : formSchema<EfTypeField> = {
    type_name: {
        rules: [required('ประเภท EF'), englishOnly('ประเภท EF'), notNumericOnly('ประเภท EF')],
    },
};

/* ค่า GWP */
export type GwpField = 'gas_name' | 'gwp_value' ;

export const gwpSchema : formSchema<GwpField> = {
    gas_name: {
        rules: [required('ชื่อก๊าซ'), notNumericOnly('ชื่อก๊าซ')],
    },
    gwp_value: {
        normalize: normalizeNumberString, //แปลงเลขไทย + ลบ,ก่อนตรวจ
        rules: [required('ค่า GWP'), isDecimal('ค่า GWP', { allowNegative: false, maxDecimals: 6 })],
    },
};
