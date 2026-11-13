// [MERGE aom + cyn2 รอบ 3] ไฟล์นี้ = โค้ด cyn2 ทั้งไฟล์ ไม่ได้แก้โค้ด — แยกเป็น page.tsx (server: requireOrgId ของ aom) + AccountUserClient.tsx
// ส่วนที่ทำงานฝั่ง server ของหน้าตั้งค่าข้อมูลองค์กร: เช็กล็อกอินและดึงข้อมูลผู้ใช้/องค์กร
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import AccountUserClient from './AccountUserClient';

export default async function AccountUserPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ไม่ได้ล็อกอิน -> กลับหน้าแรก (พฤติกรรมเดิม)
  if (!user) redirect('/organization/homepage');

  const [userRes, orgRes] = await Promise.all([
    supabase.from('user').select('username').eq('acc_id', user.id).maybeSingle(),
    supabase
      .from('organization')
      .select('org_name, business_type')
      .eq('acc_id', user.id)
      .maybeSingle(),
  ]);

  return (
    <AccountUserClient
      userId={user.id}
      email={user.email ?? ''}
      initialUsername={userRes.data?.username ?? user.user_metadata?.username ?? ''}
      initialCompanyName={orgRes.data?.org_name ?? user.user_metadata?.company_name ?? ''}
      initialIndustry={orgRes.data?.business_type ?? null}
      loadError={orgRes.error ? `โหลดข้อมูลไม่สำเร็จ: ${orgRes.error.message}` : null}
    />
  );
}
