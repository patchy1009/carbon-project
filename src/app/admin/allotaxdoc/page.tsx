export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabaseClient';
import AlloTaxDocClient from './allotaxdocClient';
import type { AlloTaxDoc } from '@/types/allotaxdoc';

export default async function AlloTaxDocPage() {
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