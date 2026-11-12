// หน้าลงทะเบียนองค์กร: ฝั่ง server
// - เช็กบน server ว่าล็อกอินอยู่แล้วหรือยัง ถ้าใช่ให้ไปแดชบอร์ดเลย
// - ถ้ายังไม่ล็อกอิน แสดง RegisterClient (ฟอร์มสมัคร + ยืนยัน OTP ฝั่ง browser)
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import RegisterClient from './RegisterClient';

export default async function RegisterPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ล็อกอินอยู่แล้ว -> ไปแดชบอร์ด
  if (user) redirect('/organization/dashboard');

  return <RegisterClient />;
}
