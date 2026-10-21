import {supabase} from "./supabaseClient";

type Values = Record<string, unknown>;

/* เพิ่ม 1 แถวในตาราง supabase ถ้าล้มเหลงจะแจ้งเด้งเตือนและ return null */
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
        const { data: existingData, error: checkError } = await supabase
            .from(tableName)
            .select(duplicateCol)
            .eq(duplicateCol, duplicateVal)
            .limit(1)
        if (checkError) {
            alert('ตรวจสอบข้อมูลซ้ำไม่สำเร็จ: '+checkError.message);
            return null;
        }
        if (existingData && existingData.length > 0) {
            alert(duplicateMessage);
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
        alert(errorLabel+'ไม่สำเร็จ: '+error.message);
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
    .single();

    if ( error ) {
        alert(errorLable+'ไม่สำเร็จ: '+error.message);
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
    if ( !confirm(confirmMessage) ) return false;
    
    const { error } = await supabase
        .from(tableName)
        .delete()
        .eq(idCol, idVal);

    if ( error ) {
        alert('ลบข้อมูลไม่สำเร็จ: '+error.message);
        return false;
    }
    return true;
}
