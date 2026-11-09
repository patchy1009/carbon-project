// ส่วนที่ทำงานฝั่ง server ของหน้าเอกสาร: ตรวจสิทธิ์องค์กรแล้วดึงรายการเอกสาร
export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import DocumentsClient from './DocumentsClient';
import type { DocumentItem } from '@/types/documents';

// ดึงรายการเอกสาร แล้วส่งให้หน้าจอ
export default async function DocumentsPage() {
  await requireOrgId(); // ไม่ใช่องค์กร -> เด้งไปหน้า login
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from('documents')
    .select('*')
    .order('upload_date', { ascending: false });

  return <DocumentsClient documents={(data ?? []) as DocumentItem[]} />;
}