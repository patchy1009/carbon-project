import type { fieldRule, validationResult } from './validation';

/* =====================================================================
 * ตรวจ Syntax ป้องกัน SQL Injection (TOR ข้อ 1.5, 2.2, 3.4, 4.3, 5.6, 6.3, 9.4, 10.3, 12.5)
 *
 * หลักการ: เป็นด่านตรวจ "ก่อนส่งข้อมูล" ว่าข้อความที่กรอกมีรูปแบบคำสั่ง SQL หรือไม่
 *   เช่น ' OR 1=1 --   '; DROP TABLE x; --   UNION SELECT ... ถ้ามี -> ไม่ผ่าน ไม่ส่งไปฐานข้อมูล
 * เป็นชั้นเสริม ชั้นหลักคือ query ทุกตัวส่งค่าแบบ parameter (supabase-js / RPC ที่กำหนดชนิด)
 *   ไม่มีการต่อข้อความ SQL เอง จึงไม่ถูกตีความเป็นคำสั่งอยู่แล้ว
 *
 * ใช้กับช่อง "ข้อความ" เท่านั้น (ชื่อ, หมายเหตุ ฯลฯ) ช่องตัวเลขมี isDecimal ตรวจอยู่แล้ว
 * วางหลัง maxLength เสมอ เพื่อให้ตรวจเฉพาะข้อความที่ความยาวผ่านแล้ว
 *
 * ใช้: rules: [required('ชื่อ'), maxLength('ชื่อ', 100), noSqlSyntax('ชื่อ')]
 *   ช่องรหัสผ่าน: noSqlSyntax('รหัสผ่าน', { lenient: true })
 *   (รหัสผ่านไม่เคยถูกต่อเป็น SQL (ส่งให้ Supabase Auth เข้ารหัส) และอาจมี ; -- ได้ตามปกติ
 *    จึงบล็อกเฉพาะรูปแบบที่เป็นคำสั่ง SQL ชัดเจน ไม่บล็อกอักขระเดี่ยว)
 * ===================================================================== */

// รูปแบบที่เป็นคำสั่ง SQL ชัดเจน (ใช้ทั้งโหมดปกติและ lenient)
const STRONG: RegExp[] = [
    /\bunion\b(\s+all)?\s+select\b/,
    /\bselect\b[^;]{0,200}?\bfrom\b\s+[\w."]+/,
    /\binsert\s+into\b/,
    /\bupdate\b\s+[\w."]+\s+set\b/,
    /\bdelete\s+from\b/,
    /\b(drop|alter|truncate|create)\s+(table|database|schema|view|function|role|user|index|policy|extension)\b/,
    /\bxp_\w+|\bsp_executesql\b/,
    /\b(pg_sleep|benchmark|sleep)\s*\(\s*\d/,
    /\bwaitfor\s+delay\b/,
    /\b(information_schema|pg_catalog|pg_shadow|pg_user|pg_read_file|sqlite_master)\b/,
    /\bauth\.users\b/,
    // เงื่อนไขเป็นจริงเสมอ: OR 1=1, AND 'a'='a, OR x<>y
    /\b(or|and)\s+['"`]?[\w.]+['"`]?\s*(=|<>|!=|<=|>=|<|>|\blike\b)\s*['"`]?[\w.]+/,
    // OR (1=1 / ) OR (1=1  (เงื่อนไขในวงเล็บ)
    /\b(or|and)\s*\(\s*['"`]?[\w.]+['"`]?\s*(=|<>|!=|<|>)/,
    // ปิดเครื่องหมายคำพูดแล้วต่อ OR/AND: ' OR '..., " OR 1
    /['"`]\s*(or|and)\s*['"`(\d]/,
    // ปิดเครื่องหมายคำพูดแล้วตามด้วย ; หรือคอมเมนต์: admin'--  x';
    /['"`]\s*(;|--|\/\*)/,
];

// อักขระ/โทเคนเดี่ยวที่ใช้ตัดต่อคำสั่ง (โหมดปกติเท่านั้น)
const WEAK: RegExp[] = [/--/, /\/\*/, /\*\//, /;/];

// แปลงให้ตรวจง่าย: อักขระเต็มความกว้าง (＇ ＯＲ －－) เป็นปกติ, ตัดตัวอักษรล่องหน, ยุบช่องว่าง/แท็บ/ขึ้นบรรทัดใหม่, ตัวพิมพ์เล็ก
const prepare = (value : string) : string =>
    value
        .normalize('NFKC')
        .replace(/[​-‍⁠﻿­]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();

/* คืน true ถ้าข้อความมีรูปแบบคำสั่ง SQL (ใช้ตรวจนอกฟอร์มได้ เช่น ค่าจาก URL) */
export function containsSqlSyntax(value : string, opts : { lenient? : boolean } = {}) : boolean {
    const s = prepare(value);
    if (s === '') return false;
    if (STRONG.some((re) => re.test(s))) return true;
    return opts.lenient === true ? false : WEAK.some((re) => re.test(s));
}

/* กฎของ validateForm: ไม่ผ่านถ้าข้อความมีรูปแบบคำสั่ง SQL (ค่าว่างปล่อยผ่าน ให้ required จัดการ) */
export const noSqlSyntax = (label : string, opts : { lenient? : boolean } = {}) : fieldRule => {
    return (value : string) : validationResult =>
        containsSqlSyntax(value, opts)
            ? { ok : false, message : label + ' มีรูปแบบที่ไม่อนุญาต (คล้ายคำสั่ง SQL) กรุณากรอกใหม่' }
            : { ok : true };
};
