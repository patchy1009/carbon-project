// src/app/admin/ef-gwp/page.tsx
export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabaseClient';
import EfGwpClient from './EfGwpClient';
import type { EfType, EmissionFactor, GwpValue } from '@/types/ef-gwp';

export default async function EfGwpPage() {
  const [efTypesRes, efListRes, gwpListRes] = await Promise.all([
    supabase.from('ef_type').select('*').order('updated_date'),
    supabase
      .from('emission_factor')
      .select('*, ef_type(eftype_id, type_name)')
      .order('updated_date'),
    supabase.from('global_warming_potential').select('*').order('created_at'),
  ]);

  // ชั่วคราว debug — ดูผลลัพธ์ใน terminal
  console.log('efTypes:', efTypesRes.data, efTypesRes.error);
  console.log('efList:', efListRes.data, efListRes.error);
  console.log('gwpList:', gwpListRes.data, gwpListRes.error);

  return (
    <EfGwpClient
      initialEfTypes={(efTypesRes.data ?? []) as EfType[]}
      initialEf={(efListRes.data ?? []) as EmissionFactor[]}
      initialGwp={(gwpListRes.data ?? []) as GwpValue[]}
    />
  );
}