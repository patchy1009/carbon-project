'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Building2, Camera, LogOut, CheckCircle2 } from 'lucide-react';

export default function AccountUserPage() {
  const [email, setEmail] = useState('name@company.co.th');
  const [companyName, setCompanyName] = useState('บริษัท ตัวอย่าง จำกัด');
  const [industry, setIndustry] = useState('อุตสาหกรรมการผลิต');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    alert('บันทึกข้อมูลองค์กรเรียบร้อยแล้ว');
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    alert('เปลี่ยนรหัสผ่านสำเร็จ');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ตั้งค่าข้อมูลองค์กร</h1>
          <p className="text-sm text-gray-500">จัดการรายละเอียดองค์กรและตั้งค่าความปลอดภัยบัญชี</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          <LogOut className="w-4 h-4 text-gray-500" /> ออกจากระบบ
        </button>
      </div>

      {/* Profile Card Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center gap-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden relative border-2 border-emerald-600">
            <Image 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces" 
              alt="Profile" 
              fill 
              className="object-cover"
            />
          </div>
          <button className="absolute bottom-0 right-0 p-2 bg-emerald-700 text-white rounded-full shadow hover:bg-emerald-800 transition">
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" /> ยืนยันตัวตนแล้ว
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xl font-bold text-gray-900 mt-1">
            <Building2 className="w-5 h-5 text-emerald-700" />
            <span>{companyName}</span>
          </div>
        </div>
      </div>

      {/* Grid Configuration Forms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* รายละเอียดองค์กร */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-base font-bold text-gray-800 border-b pb-3">รายละเอียดองค์กร</h2>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">อีเมล (email)</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">ชื่อองค์กร / บริษัท</label>
              <input 
                type="text" 
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">ประเภทอุตสาหกรรม</label>
              <select 
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              >
                <option>อุตสาหกรรมการผลิต</option>
                <option>บริการและการท่องเที่ยว</option>
                <option>พลังงานและสาธารณูปโภค</option>
                <option>เกษตรกรรมและอุตสาหกรรมเกษตร</option>
              </select>
            </div>

            <button 
              type="submit" 
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-sm transition shadow-sm"
            >
              ยืนยันการเปลี่ยนแปลง
            </button>
          </form>
        </div>

        {/* ตั้งค่าความปลอดภัย */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-base font-bold text-gray-800 border-b pb-3">ตั้งค่าความปลอดภัย</h2>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">รหัสผ่านใหม่ (new password)</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">ยืนยันรหัสผ่านใหม่ (confirm-password)</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">รหัสผ่านเดิม (old-password)</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="flex justify-end">
              <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('ระบบส่งลิงก์รีเซ็ตกรอกรหัสผ่านไปที่อีเมลของคุณแล้ว'); }} className="text-xs text-emerald-700 hover:underline">
                ลืมรหัสผ่านเดิม?
              </a>
            </div>

            <button 
              type="submit" 
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-sm transition shadow-sm"
            >
              ยืนยันการเปลี่ยนแปลง
            </button>
          </form>
        </div>
      </div>

      {/* Account Deletion */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">การจัดการบัญชี</h3>
          <p className="text-xs text-gray-500">หากต้องการเลิกใช้งานระบบและลบข้อมูลทั้งหมดถาวร</p>
        </div>
        <button 
          onClick={() => { if(confirm('คุณต้องการปิดบัญชีผู้ใช้นี้ถาวรใช่หรือไม่?')) alert('ส่งคำขอปิดบัญชีเรียบร้อยแล้ว'); }}
          className="px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 text-xs font-medium rounded-xl transition"
        >
          ปิดบัญชีถาวร
        </button>
      </div>
    </div>
  );
}