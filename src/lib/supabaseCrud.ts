
import {supabase} from "./supabaseClient";
import { showConfirm, showError } from "./dialog"; // [แก้ไข] ใช้กล่องแจ้งเตือนกลางแทน alert/confirm ของเบราว์เซอร์

type Values = Record<string, unknown>;

/* แปลง error จาก Postgres เป็นข้อความที่ผู้ใช้อ่านเข้าใจ [เพิ่มใหม่]
 * เป็นด่านสุดท้ายของการตรวจ "ข้อมูลซ้ำ" และ "ความสัมพันธ์ระหว่างตาราง" ระดับฐานข้อมูล
 * (เผื่อมีคนบันทึกพร้อมกัน หรือหน้าจอยังไม่รีเฟรชข้อมูลล่าสุด)
 * รหัส error ดูได้ที่ https://www.postgresql.org/docs/current/errcodes-appendix.html */
export function dbErrorMessage(error : { code?: string, message : string }) : string {
    switch (error.code) {
        case '23505': return 'มีข้อมูลนี้อยู่แล้ว (ข้อมูลซ้ำ)';                         // unique_violation
        case '23503': return 'ข้อมูลนี้ถูกใช้อ้างอิงอยู่ หรือข้อมูลที่อ้างถึงไม่มีอยู่แล้ว';     // foreign_key_violation
        case '23502': return 'กรอกข้อมูลไม่ครบ';                                     // not_null_violation
        case '23514': return 'ข้อมูลไม่ผ่านเงื่อนไขของตาราง';                          // check_violation
        case '22P02': return 'รูปแบบข้อมูลไม่ถูกต้อง';                                // invalid_text_representation
        case '42501': return 'ไม่มีสิทธิ์ทำรายการนี้';                                  // RLS ไม่อนุญาต
        default: return error.message;
    }
}

/* เพิ่ม 1 แถวในตาราง supabase ถ้าล้มเหลวจะแจ้งเด้งเตือนและ return null */
export async function insertRecord<T>(
    tableName : string,
    values : Values,
    selectQuery : string = '*',
    errorLabel : string = 'บันทึกข้อมูล',
    duplicateCol? : string,
    duplicateMessage : string = 'มีข้อมูลแล้ว'
) : Promise<T | null> {
    // ตรวจสอบข้อมูลซ้ำก่อน
    if ( duplicateCol ) {
        const duplicateVal = values[duplicateCol];
        // [แก้ไข] เดิมใช้ .eq ซึ่งแยกตัวพิมพ์เล็ก/ใหญ่ ("Diesel" กับ "diesel" ไม่ถือว่าซ้ำ)
        //   ข้อความใช้ .ilike (ไม่สนตัวพิมพ์) โดย escape % และ _ ไม่ให้กลายเป็น wildcard
        let query = supabase.from(tableName).select(duplicateCol).limit(1);
        query = typeof duplicateVal === 'string'
            ? query.ilike(duplicateCol, duplicateVal.replace(/[\\%_]/g, (c) => '\\' + c))
            : query.eq(duplicateCol, duplicateVal);
        const { data: existingData, error: checkError } = await query;
        if (checkError) {
            showError('ตรวจสอบข้อมูลซ้ำไม่สำเร็จ: '+dbErrorMessage(checkError));
            return null;
        }
        if (existingData && existingData.length > 0) {
            showError(duplicateMessage, { title: 'ข้อมูลซ้ำ' });
            return null;
        }
    }

    // เพิ่มข้อมูลใหม่ ไม่เจอข้อมูลซ้ำ
    const { data, error } = await supabase
    .from(tableName)
    .insert(values)
    .select(selectQuery)
    .single();

    if ( error ) {
        showError(errorLabel+'ไม่สำเร็จ: '+dbErrorMessage(error)); // [แก้ไข] ใช้ข้อความที่อ่านเข้าใจ
        return null;
    }
    return data as unknown as T;
}

/* แก้ไข 1 แถวตาม id แล้วคืนค่าแถวที่แก้แล้ว */
export async function updateRecord<T>(
    tableName : string,
    idCol : string,
    idVal : string,
    values : Values,
    selectQuery : string = '*',
    errorLable : string = 'แก้ไขข้อมูล'
) : Promise<T | null> {
    const { data, error } = await supabase
    .from(tableName)
    .update(values)
    .eq(idCol, idVal)
    .select(selectQuery)
    .maybeSingle(); // [แก้ไข] .single() -> .maybeSingle() เพื่อแยกกรณี "ไม่พบ/ไม่มีสิทธิ์" ออกมาแจ้งให้ชัด

    if ( error ) {
        showError(errorLable+'ไม่สำเร็จ: '+dbErrorMessage(error));
        return null;
    }
    if ( !data ) {
        // RLS ไม่อนุญาต หรือแถวถูกลบไปแล้ว: update สำเร็จแต่ไม่มีแถวไหนถูกแก้
        showError(errorLable+'ไม่สำเร็จ: ไม่พบข้อมูล หรือไม่มีสิทธิ์แก้ไข');
        return null;
    }
    return data as unknown as T;
}

/* ลบ 1 แถวตาม id+ถามยืนยันก่อน ลบแล้วคืนค่า true */
export async function deleteRecord(
    tableName : string,
    idCol : string,
    idVal : string,
    confirmMessage : string = 'ยืนยันการลบข้อมูล?',
) : Promise<boolean> {
    if ( !(await showConfirm(confirmMessage, { danger: true })) ) return false;

    const { error } = await supabase
        .from(tableName)
        .delete()
        .eq(idCol, idVal);

    if ( error ) {
        // [แก้ไข] 23503 ตอนลบ = มีตารางอื่นอ้างถึงแถวนี้อยู่ แจ้งให้ชัดกว่าข้อความภาษาอังกฤษของ DB
        showError('ลบข้อมูลไม่สำเร็จ: '+(error.code === '23503'
            ? 'ข้อมูลนี้ถูกใช้งานอยู่ในส่วนอื่น ต้องลบข้อมูลที่อ้างถึงก่อน'
            : dbErrorMessage(error)));
        return false;
    }
    return true;
}
