'use client';

import React, { useState, useEffect } from 'react';
import { X, Building2, Mail, Lock, ChevronDown, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function RegisterModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // ขั้นตอนของฟอร์ม: 'form' (กรอกข้อมูล) -> 'otp' (ยืนยันรหัส) -> 'success' (สำเร็จ)
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');
  
  // ฟอร์มข้อมูล
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('สำนักงานและบริการทั่วไป');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // OTP State
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [countdown, setCountdown] = useState(60);
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

  // นับเวลาถอยหลัง OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'otp' && countdown > 0) {
      timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  if (!isOpen) return null;

  // 1. ตรวจสอบอีเมลซ้ำ และส่ง OTP
  const handleCheckAndSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      // เช็คว่าอีเมลนี้มีใน Supabase หรือยัง
      const { data: existingUser, error: checkError } = await supabase
        .from('organizations')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingUser) {
        setErrorMessage('อีเมลนี้เคยลงทะเบียนในระบบแล้ว กรุณาเข้าสู่ระบบ');
        setLoading(false);
        return;
      }

      // จำลองการสร้างและส่ง OTP (ในระบบจริงสามารถใช้ Supabase Auth หรือบริการส่งเมล API เช่น Resend / SendGrid)
      const fakeOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(fakeOtp);
      console.log('รหัส OTP ของคุณ (จำลองส่งไปที่อีเมล):', fakeOtp); // ดูใน Console ของเบราว์เซอร์

      // เปลี่ยนไปหน้ากรอก OTP
      setStep('otp');
      setCountdown(60);
    } catch (err: any) {
      setErrorMessage('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. ยืนยัน OTP และบันทึกข้อมูลลง Supabase (พร้อมจำลองการ Hash Password)
  const handleVerifyOtpAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (otpInput !== generatedOtp) {
      setErrorMessage('รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      return;
    }

    setLoading(true);
    try {
      // จำลองการ Hash Password เบื้องต้น (ในโปรดักชันแนะนำให้ใช้ bcrypt ฝั่ง Server หรือ Supabase Auth)
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // บันทึกข้อมูลลงตาราง organizations ใน Supabase
      const { error: insertError } = await supabase.from('organizations').insert([
        {
          email,
          password_hash: passwordHash,
          company_name: companyName,
          industry
        }
      ]);

      if (insertError) throw insertError;

      setStep('success');
    } catch (err: any) {
      setErrorMessage('บันทึกข้อมูลไม่สำเร็จ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl relative border border-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* ปุ่มปิด Modal */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ================= STEP 1: ฟอร์มลงทะเบียน ================= */}
        {step === 'form' && (
          <form onSubmit={handleCheckAndSendOtp} className="space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-extrabold text-[#11221C]">ลงทะเบียนองค์กร</h2>
              <p className="text-xs text-slate-500">สร้างบัญชีองค์กรเพื่อเริ่มบริหารจัดการการปล่อยก๊าซเรือนกระจก</p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl text-center font-medium">
                {errorMessage}
              </div>
            )}

            <div className="space-y-4">
              {/* อีเมล */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">อีเมล (email)</label>
                <div className="relative">
                  <input 
                    type="email" 
                    required
                    placeholder="name@company.co.th"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50"
                  />
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* รหัสผ่าน */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">รหัสผ่าน (password)</label>
                <div className="relative">
                  <input 
                    type="password" 
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50"
                  />
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* ชื่อองค์กร */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">ชื่อองค์กร / บริษัท</label>
                <div className="relative">
                  <input 
                    type="text" 
                    required
                    placeholder="บริษัท ตัวอย่าง จำกัด"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50"
                  />
                  <Building2 className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* ประเภทอุตสาหกรรม (Dropdown ตามภาพดีไซน์) */}
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold text-slate-700">ประเภทอุตสาหกรรม</label>
                <div 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm bg-slate-50/50 flex items-center justify-between cursor-pointer"
                >
                  <span className="text-slate-800">{industry}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>

                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg z-30 overflow-hidden">
                    {industries.map((item, idx) => (
                      <div 
                        key={idx}
                        onClick={() => { setIndustry(item); setIsDropdownOpen(false); }}
                        className={`px-4 py-2.5 text-xs font-medium cursor-pointer transition ${industry === item ? 'bg-emerald-700 text-white' : 'hover:bg-slate-50 text-slate-700'}`}
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
              <span>{loading ? 'กำลังตรวจสอบข้อมูล...' : 'ลงทะเบียนองค์กร'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* ================= STEP 2: ยืนยันรหัส OTP ================= */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtpAndRegister} className="space-y-6 text-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">ยืนยันรหัส OTP</h3>
              <p className="text-xs text-slate-500">
                ระบบได้ส่งรหัสยืนยัน 6 หลักไปที่อีเมล <br />
                <strong className="text-slate-800">{email}</strong>
              </p>
              <p className="text-[11px] text-amber-600 bg-amber-50 py-1 px-2 rounded-lg inline-block">
                *(พิมพ์จำลอง OTP ใน Console F12 หรือใช้รหัส: {generatedOtp})*
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
                className="w-full text-center tracking-[1em] text-xl font-bold py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50"
              />
            </div>

            <div className="text-xs text-slate-500">
              {countdown > 0 ? (
                <span>ขอรหัส OTP ใหม่ได้ใน {countdown} วินาที</span>
              ) : (
                <button type="button" onClick={() => setCountdown(60)} className="text-emerald-700 font-semibold hover:underline">
                  ส่งรหัส OTP อีกครั้ง
                </button>
              )}
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#1F3E35] hover:bg-[#152C25] text-white font-semibold rounded-2xl text-sm transition shadow-md"
            >
              {loading ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันและสมัครสมาชิก'}
            </button>
          </form>
        )}

        {/* ================= STEP 3: สำเร็จ ================= */}
        {step === 'success' && (
          <div className="text-center space-y-6 py-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">ลงทะเบียนสำเร็จ!</h3>
              <p className="text-xs text-slate-500">บัญชีองค์กรของคุณถูกบันทึกและเข้าระบบความปลอดภัยเรียบร้อยแล้ว</p>
            </div>

            <button 
              onClick={() => { onClose(); setStep('form'); }}
              className="w-full py-3.5 bg-[#1F3E35] text-white font-semibold rounded-2xl text-sm hover:bg-[#152C25] transition shadow-md"
            >
              เข้าสู่ระบบทันที
            </button>
          </div>
        )}

      </div>
    </div>
  );
}