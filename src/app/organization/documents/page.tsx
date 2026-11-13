// ส่วนที่ทำงานฝั่ง server ของหน้าเอกสาร: ตรวจสิทธิ์องค์กรแล้วดึงรายการเอกสาร
export const dynamic = 'force-dynamic'; // ไม่ cache หน้าเอกสาร เพราะอัปโหลด/ลบเอกสารแล้วต้องรีเฟรชหน้า

import { createSupabaseServer } from '@/lib/supabaseServer'; // สร้าง client ของ Supabase ฝั่ง server (ผูกกับ cookie ของผู้ใช้ที่ล็อกอินอยู่)
import { requireOrgId } from '@/lib/auth'; // ตรวจสิทธิ์องค์กร: ไม่ใช่องค์กร -> เด้งไปหน้า login
import DocumentsClient from './DocumentsClient'; // ส่วนที่ทำงานฝั่ง client ของหน้าเอกสาร: แสดงรายการเอกสาร + ปุ่มอัปโหลด/ลบ
import type { DocumentItem } from '@/types/documents'; // type ของรายการเอกสาร (id, ชื่อไฟล์, วันที่อัปโหลด, ผู้ใช้ที่อัปโหลด, ขนาดไฟล์, ประเภทไฟล์)

// ดึงรายการเอกสารจากตาราง documents แล้วส่งให้หน้าจอ
export default async function DocumentsPage() {
  await requireOrgId(); // ตรวจสิทธิ์องค์กร: ไม่ใช่องค์กร -> เด้งไปหน้า login
  const supabase = await createSupabaseServer();    
  const { data } = await supabase
    .from('documents')
    .select('*')
    .order('upload_date', { ascending: false });
  return <DocumentsClient documents={(data ?? []) as DocumentItem[]} />;
}

