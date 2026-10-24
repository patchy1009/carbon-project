export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabaseClient';
import DocumentsClient from './DocumentsClient';
import type { DocumentItem } from '@/types/documents';

export default async function DocumentsPage() {
  const { data } = await supabase
    .from('documents')
    .select('*')
    .order('upload_date', { ascending: false });

  return <DocumentsClient documents={(data ?? []) as DocumentItem[]} />;
}