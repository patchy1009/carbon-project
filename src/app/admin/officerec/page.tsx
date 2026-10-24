export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabaseClient';
import OfficeRecommendationClient from './OfficeRecommendationClient';
import type {
  OfficeInfoType,
  CarbonReductionRecommendation,
} from '@/types/office-recommendations';

export default async function OfficeRecommendationPage() {
  const [infoRes, recRes] = await Promise.all([
    supabase.from('office_info_type').select('*').order('updated_at'),
    supabase.from('carbon_reduction_recommendation').select('*').order('updated_at'),
  ]);

  return (
    <OfficeRecommendationClient
      initialInfo={(infoRes.data ?? []) as OfficeInfoType[]}
      initialRecs={(recRes.data ?? []) as CarbonReductionRecommendation[]}
    />
  );
}