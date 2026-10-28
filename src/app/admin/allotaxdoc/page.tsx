export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireAdminId } from '@/lib/auth';
import AlloTaxDocClient from './allotaxdocClient';
import type { AlloTaxDoc } from '@/types/allotaxdoc';

export default async function AlloTaxDocPage() {
  await requireAdminId(); // ไม่ใช่แอดมิน -> เด้งไปหน้า login
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('upload_date');

  if (error) {
    console.error(error);
  }

  return (
    <AlloTaxDocClient
      initialDocuments={(data ?? []) as AlloTaxDoc[]}
    />
  );
}