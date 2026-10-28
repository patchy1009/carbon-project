export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import DocumentsClient from './DocumentsClient';
import type { DocumentItem } from '@/types/documents';

export default async function DocumentsPage() {
  await requireOrgId(); // ไม่ใช่องค์กร -> เด้งไปหน้า login
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from('documents')
    .select('*')
    .order('upload_date', { ascending: false });

  return <DocumentsClient documents={(data ?? []) as DocumentItem[]} />;
}