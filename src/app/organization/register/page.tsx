'use client';

import React, { useState } from 'react';
import { 
  Building2, Mail, Lock, ChevronDown, CheckCircle2, 
  ShieldCheck, ArrowRight, UserCheck 
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function RegisterPage() {
  // ควบคุมขั้นตอนการสมัคร: 'form' (กรอกข้อมูล) -> 'otp' (กรอกรหัส 6 หลัก) -> 'success' (สำเร็จ)
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');
  
  // ข้อมูลฟอร์ม
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('สำนักงานและบริการทั่วไป');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // OTP State
  const [otpInput, setOtpInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const industries = [
    'สำนักงานและบริการทั่วไป',
    'การผลิต อุตสาหกรรม และแปรรูป',
    'การขนส่ง โลจิสติกส์ และคลังสินค้า',
    'โรงแรม การท่องเที่ยว งานบริการ',
    'ค้าปลีก ค้าส่ง และการจัดการสินค้า',
    'ก่อสร้าง อสังหาริมทรัพย์ และโครงสร้างพื้นฐาน'
  ];

  // 1. ฟังก์ชันส่ง OTP ไปยังอีเมลจริงผ่าน Supabase Auth
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      // เช็คในตาราง organizations ของเราก่อนว่าอีเมลนี้เคยลงทะเบียนไว้หรือยัง
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (existingOrg) {
        setErrorMessage('อีเมลนี้เคยลงทะเบียนในระบบองค์กรแล้ว กรุณาเข้าสู่ระบบ');
        setLoading(false);
        return;
      }

      // ส่ง OTP จริงไปที่อีเมลผ่าน Supabase Auth พร้อมแนบข้อมูลองค์กรเก็บไว้ใน user_metadata
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          data: {
            company_name: companyName,
            industry: industry,
          }
        }
      });

      if (error) throw error;

      // ส่งสำเร็จ เปลี่ยนหน้าไปให้ผู้ใช้กรอก OTP
      setStep('otp');
    } catch (err: any) {
      setErrorMessage('ไม่สามารถส่งอีเมล OTP ได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. ฟังก์ชันตรวจสอบรหัส OTP ที่ผู้ใช้กรอกเข้ามา
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      // ตรวจสอบความถูกต้องของ OTP กับ Supabase Auth
      const { data, error } = await supabase.auth.verifyOtp({
        email: email,
        token: otpInput,
        type: 'email' // ระบุประเภทเป็น email otp
      });

      if (error) throw error;

      // หาก OTP ถูกต้อง Supabase จะสร้าง User สำเร็จ เราดึง Metadata ที่แนบไว้ตอนแรกออกมา
      const metadata = data.user?.user_metadata;

      // ทำการ Hash รหัสผ่านด้วย SHA-256 เพื่อความปลอดภัยก่อนบันทึกลงตาราง organizations
      const encoder = new TextEncoder();
      const encodedPassword = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', encodedPassword);
      const passwordHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // บันทึกข้อมูลลงตาราง organizations ของเรา
      const { error: insertError } = await supabase.from('organizations').insert([
        {
          email: email,
          password_hash: passwordHash,
          company_name: metadata?.company_name || companyName,
          industry: metadata?.industry || industry
        }
      ]);

      if (insertError) throw insertError;

      // สำเร็จทั้งหมด เปลี่ยนไปหน้าสำเร็จ
      setStep('success');
    } catch (err: any) {
      setErrorMessage('รหัส OTP ไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-8 px-4">
      <div className="bg-white w-full max-w-lg rounded-3xl p-8 lg:p-10 shadow-xl border border-slate-200/85 relative">
        
        {/* ================= STEP 1: ฟอร์มกรอกข้อมูลลงทะเบียน ================= */}
        {step === 'form' && (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div className="text-center space-y-1.5">
              <h1 className="text-2xl lg:text-3xl font-extrabold text-[#11221C]">
                ลงทะเบียนองค์กร
              </h1>
              <p className="text-xs text-slate-500">
                สร้างบัญชีองค์กรเพื่อเริ่มบริหารจัดการการปล่อยก๊าซเรือนกระจก
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl text-center font-medium">
                {errorMessage}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">อีเมล (email)</label>
                <div className="relative">
                  <input 
                    type="email" 
                    required
                    placeholder="name@company.co.th"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 text-slate-800"
                  />
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">รหัสผ่าน (password)</label>
                <div className="relative">
                  <input 
                    type="password" 
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 text-slate-800"
                  />
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">ชื่อองค์กร / บริษัท</label>
                <div className="relative">
                  <input 
                    type="text" 
                    required
                    placeholder="บริษัท ตัวอย่าง จำกัด"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 text-slate-800"
                  />
                  <Building2 className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-slate-700">ประเภทอุตสาหกรรม</label>
                <div 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm bg-slate-50/50 flex items-center justify-between cursor-pointer text-slate-800"
                >
                  <span>{industry}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>

                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg z-30 overflow-hidden">
                    {industries.map((item, idx) => (
                      <div 
                        key={idx}
                        onClick={() => { setIndustry(item); setIsDropdownOpen(false); }}
                        className={`px-4 py-2.5 text-xs font-medium cursor-pointer transition ${industry === item ? 'bg-[#1F3E35] text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#1F3E35] hover:bg-[#152C25] text-white font-semibold rounded-2xl text-sm transition shadow-md flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'กำลังส่งรหัส OTP ไปที่อีเมล...' : 'ถัดไป: ยืนยันอีเมล'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* ================= STEP 2: หน้ากรอกรหัส OTP จริง ================= */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-6 text-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">ตรวจสอบอีเมลของคุณ</h2>
              <p className="text-xs text-slate-500">
                ระบบได้ส่งรหัสยืนยัน 6 หลักไปที่อีเมลของคุณแล้ว <br />
                <strong className="text-slate-800">{email}</strong>
              </p>
              <p className="text-[11px] text-amber-700 bg-amber-50 py-1.5 px-3 rounded-xl inline-block border border-amber-200">
                💡 กรุณาตรวจสอบกล่องข้อความ (Inbox / Spam) และนำรหัส 6 หลักมากรอกด้านล่าง
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium">
                {errorMessage}
              </div>
            )}

            <div className="max-w-xs mx-auto">
              <input 
                type="text"
                maxLength={6}
                required
                placeholder="• • • • • •"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                className="w-full text-center tracking-[0.8em] text-xl font-bold py-3.5 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50 text-slate-900"
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#1F3E35] hover:bg-[#152C25] text-white font-semibold rounded-2xl text-sm transition shadow-md"
            >
              {loading ? 'กำลังตรวจสอบรหัส OTP...' : 'ยืนยันและสมัครสมาชิก'}
            </button>
          </form>
        )}

        {/* ================= STEP 3: ลงทะเบียนสำเร็จ ================= */}
        {step === 'success' && (
          <div className="text-center space-y-6 py-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">ลงทะเบียนสำเร็จ!</h2>
              <p className="text-xs text-slate-500">บัญชีองค์กรของคุณถูกยืนยันผ่านอีเมลและบันทึกเรียบร้อยแล้ว</p>
            </div>

            <button 
              onClick={() => window.location.href = '/organization/dashboard'}
              className="w-full py-3.5 bg-[#1F3E35] text-white font-semibold rounded-2xl text-sm hover:bg-[#152C25] transition shadow-md flex items-center justify-center space-x-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>เข้าสู่หน้า Dashboard</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}