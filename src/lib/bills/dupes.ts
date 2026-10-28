// lib/bills/dupes.ts
import { supabase } from '@/lib/supabaseClient';
import type { BillType, Check } from './types';

export async function findDuplicate(
  orgId: string,
  billType: BillType,
  fileHash: string,
  dedupKey: string | null,
): Promise<Check | null> {
  const byHash = await supabase
    .from('org_bill_file')
    .select('bill_id, original_name')
    .eq('org_id', orgId)
    .eq('file_hash', fileHash)
    .limit(1);
  if (byHash.data?.length) {
    return { level: 'fail', code: 'DUP_FILE', message: `ไฟล์นี้เคยแนบแล้ว (${byHash.data[0].original_name})` };
  }

  if (dedupKey) {
    const byKey = await supabase
      .from('org_bill_file')
      .select('bill_id, original_name')
      .eq('org_id', orgId)
      .eq('bill_type', billType)
      .eq('dedup_key', dedupKey)
      .limit(1);
    if (byKey.data?.length) {
      return { level: 'fail', code: 'DUP_BILL', message: `บิลใบนี้เคยแนบแล้วในชื่อไฟล์ ${byKey.data[0].original_name}` };
    }
  }
  return null;
}