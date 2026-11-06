export const dynamic = 'force-dynamic';

import { createSupabaseServer } from '@/lib/supabaseServer';
import { requireAdminId } from '@/lib/auth';
import ActivityBasedClient from './ActivityBasedClient';

export interface GeneralCategoryActivity {
  categoryact_id: string;
  admin_id?: string;
  category_name: string;
  sub_category: string;
  unit?: string;
  updated_at?: string;
}

export default async function ActivityBasedPage() {
  await requireAdminId(); // ตรวจสอบสิทธิ์แอดมิน
  const supabase = await createSupabaseServer();

  // ดึงข้อมูลจากตาราง general_category_activity โดยตรง
  const { data, error } = await supabase
    .from('general_category_activity')
    .select('*')
    .order('category_name', { ascending: true });

  if (error) {
    console.error("Error fetching general_category_activity:", error.message);
  }

  return (
    <ActivityBasedClient
      initialActivities={(data ?? []) as GeneralCategoryActivity[]}
    />
  );
}