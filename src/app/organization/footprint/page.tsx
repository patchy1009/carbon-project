export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireOrgId } from '@/lib/auth';
import OfficeInfoClient, { type OfficeInfoType, type SavedInfo } from './OfficeInfoClient';

export default async function FootprintOfficePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const orgId = await requireOrgId(); // org_id = auth.uid() ของบัญชีที่ล็อกอิน
  const supabase = await createSupabaseServer();
  const { edit } = await searchParams; // มีค่า = กำลังแก้ไขรายการเดิม ต้องส่งต่อไปขั้นที่ 2

  const [typesRes, savedRes] = await Promise.all([
    // หัวข้อที่แอดมินกำหนดไว้ (เรียงตามเวลาที่เพิ่ม)
    supabase
      .from('office_info_type')
      .select('info_id, info_name, unit, info_detail')
      .order('updated_at', { ascending: true }),
    // ค่าที่บริษัทนี้เคยกรอกไว้
    supabase
      .from('org_office_info')
      .select('orginfo_id, info_id, amount')
      .eq('org_id', orgId),
  ]);

  if (typesRes.error) console.error('office_info_type error:', typesRes.error.message);
  if (savedRes.error) console.error('org_office_info error:', savedRes.error.message);

  return (
    <OfficeInfoClient
      orgId={orgId}
      editId={edit ?? null}
      types={(typesRes.data ?? []) as OfficeInfoType[]}
      saved={(savedRes.data ?? []) as SavedInfo[]}
    />
  );
}