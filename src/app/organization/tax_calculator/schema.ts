// กฎตรวจข้อมูลของฟอร์มประเมินภาษี (TOR ข้อ 12.2, 12.5) ใช้กับ validateForm กลางของระบบ (lib/validation.ts)
import { required, notNumericOnly, maxLength, isDecimal, notDuplicate, type formSchema } from '@/lib/validation';
import { normalizeNumberString } from '@/lib/normalization';
import { noSqlSyntax } from '@/lib/sqlSyntax'; // ตรวจ Syntax ป้องกัน SQL Injection (TOR 12.5)

/* schema ของหน้าประเมินการยกเว้นภาษี (TOR ข้อ 12.2)
 * ตรวจ 2 อย่างที่ผู้ใช้กรอก: ราคาขายต่อหน่วย และค่าใช้จ่ายของโครงการ (กี่รายการก็ได้)
 * ช่องของค่าใช้จ่ายมีจำนวนไม่แน่นอน จึงสร้าง schema ตามรายการที่มีอยู่ตอนกดคำนวณ
 *   - ราคา: ห้ามว่าง / ต้องเป็นตัวเลข (รับเลขไทยและ comma) / ทศนิยมไม่เกิน 2 ตำแหน่ง / มากกว่า 0 (ตรวจใน checkTaxRanges)
 *   - ชื่อรายการ (เฉพาะรายการที่ผู้ใช้เพิ่มเอง): ห้ามว่าง / ตัวเลขล้วน / ยาวเกิน 150 / ซ้ำกับรายการอื่น
 *   - จำนวนเงิน: ห้ามว่าง / ตัวเลขไม่ติดลบ (0 ได้) / ทศนิยมไม่เกิน 2 ตำแหน่ง
 *   - ค่าสูงสุดตามขนาดช่องในฐานข้อมูล (ราคา numeric(12,2), จำนวนเงิน numeric(16,2)) กัน error "numeric overflow"
 *     (ตรวจใน checkTaxRanges) */

export const MAX_PRICE = 10_000_000_000; // ราคาต่อหน่วยต้องน้อยกว่านี้ (numeric(12,2))
export const MAX_AMOUNT = 100_000_000_000_000; // จำนวนเงินต้องน้อยกว่านี้ (numeric(16,2))

export type CostRowShape = { key: string; name: string; custom: boolean }; // custom = ผู้ใช้เพิ่มเอง (แก้ชื่อได้)

export const priceKey = 'price';
export const nameKey = (rowKey: string) => `name_${rowKey}`;
export const amountKey = (rowKey: string) => `amount_${rowKey}`;

export function buildTaxSchema(rows: CostRowShape[]): formSchema<string> {
  const schema: formSchema<string> = {
    [priceKey]: {
      normalize: normalizeNumberString,
      rules: [
        required('ราคาขายต่อหน่วย'),
        isDecimal('ราคาขายต่อหน่วย', { allowNegative: false, maxDecimals: 2 }),
      ],
    },
  };

  for (const row of rows) {
    if (row.custom) {
      const others = rows.filter((r) => r.key !== row.key).map((r) => r.name);
      schema[nameKey(row.key)] = {
        rules: [
          required('ชื่อรายการค่าใช้จ่าย'),
          notNumericOnly('ชื่อรายการค่าใช้จ่าย'),
          maxLength('ชื่อรายการค่าใช้จ่าย', 150),
          noSqlSyntax('ชื่อรายการค่าใช้จ่าย'),
          notDuplicate('ชื่อรายการค่าใช้จ่าย', others),
        ],
      };
    }
    schema[amountKey(row.key)] = {
      normalize: normalizeNumberString,
      rules: [
        required('จำนวนเงิน'),
        isDecimal('จำนวนเงิน', { allowNegative: false, maxDecimals: 2 }),
      ],
    };
  }

  return schema;
}

// ตรวจช่วงของค่า "หลัง" ผ่านกฎรูปแบบแล้ว (ใช้ค่าที่ normalize แล้วจาก validateForm)
//   ราคาต้องมากกว่า 0 และไม่เกินขนาดช่องในฐานข้อมูล / จำนวนเงินไม่เกินขนาดช่องในฐานข้อมูล
const isNumber = (v: string | undefined): v is string => !!v && /^-?\d+(\.\d+)?$/.test(v);

export function checkTaxRanges(clean: Record<string, string>, rowKeys: string[]): Record<string, string> {
  const errors: Record<string, string> = {};

  const price = clean[priceKey];
  if (isNumber(price)) {
    if (Number(price) <= 0) errors[priceKey] = 'ราคาขายต่อหน่วยต้องมากกว่า 0';
    else if (Number(price) >= MAX_PRICE) errors[priceKey] = 'ราคาขายต่อหน่วยสูงเกินไป';
  }

  for (const key of rowKeys) {
    const amount = clean[amountKey(key)];
    if (isNumber(amount) && Number(amount) >= MAX_AMOUNT) errors[amountKey(key)] = 'จำนวนเงินสูงเกินไป';
  }

  return errors;
}