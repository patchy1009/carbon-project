import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const identifier = email.trim().toLowerCase();
    const now = new Date();

    // 1. ตรวจสอบ Rate Limit (Brute-force protection)
    const { data: attemptData } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('identifier', identifier)
      .single();

    if (attemptData && attemptData.locked_until && new Date(attemptData.locked_until) > now) {
      const minutesLeft = Math.ceil((new Date(attemptData.locked_until).getTime() - now.getTime()) / 60000);
      return NextResponse.json({ error: `บัญชีถูกระงับชั่วคราว กรุณาลองใหม่ในอีก ${minutesLeft} นาที` }, { status: 429 });
    }

    // 2. ยืนยันตัวตนกับ Supabase Auth (ปลอดภัยจาก SQL Injection)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: identifier,
      password,
    });

    if (authError || !authData.user) {
      const currentAttempts = (attemptData?.attempts || 0) + 1;
      const updateData: any = { attempts: currentAttempts, updated_at: now };
      if (currentAttempts >= 5) {
        updateData.locked_until = new Date(now.getTime() + 15 * 60000);
      }
      await supabase.from('login_attempts').upsert({ identifier, ...updateData });
      return NextResponse.json({ error: `อีเมลหรือรหัสผ่านไม่ถูกต้อง (ครั้งที่ ${currentAttempts}/5)` }, { status: 401 });
    }

    // 3. ล้างค่าความผิดพลาดเมื่อล็อกอินสำเร็จ
    await supabase.from('login_attempts').delete().eq('identifier', identifier);

    // 4. ดึงสิทธิ์ Role ของผู้ใช้
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    return NextResponse.json({ success: true, role: profileData?.role, session: authData.session }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 });
  }
}