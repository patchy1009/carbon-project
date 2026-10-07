'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingUp, Bell, FileText, Trees } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">การแสดงผลการคำนวณองค์กร</h1>
          <p className="text-sm text-gray-500">ภาพรวมข้อมูลการปล่อยก๊าซเรือนกระจกขององค์กร</p>
        </div>
      </div>

      {/* Top Cards: Emission & T-VER Credits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* การปล่อยก๊าซสุทธิ */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-medium">การปล่อยก๊าซสุทธิ (ล่าสุด)</span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-extrabold text-gray-900">1,750</h2>
              <span className="text-sm text-gray-500 font-semibold">tCO₂e</span>
            </div>
            <p className="text-xs text-emerald-600 font-medium">-4.2% เทียบกับช่วงก่อนหน้า</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* เครดิต T-VER ที่ใช้งานอยู่ */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-medium">เครดิต T-VER ที่ใช้งานอยู่</span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-extrabold text-gray-900">790</h2>
              <span className="text-sm text-gray-500 font-semibold">tCO₂e</span>
            </div>
            <p className="text-xs text-gray-400 font-medium">จาก 2 โครงการ</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Bell className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Section 1: GHG Records */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600" /> บันทึกการปล่อยก๊าซเรือนกระจกขององค์กร
          </h3>
          <Link href="/organization/footprint" className="text-xs text-emerald-700 hover:underline flex items-center gap-1 font-semibold">
            ดูทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-gray-100">
          {[
            { title: 'การดำเนินงานสำนักงานใหญ่ — ไตรมาส 2 2569', scope: 'สโคป 1-3 • 30 มิ.ย. 2569', value: '1,750 tCO₂e' },
            { title: 'โรงงานผลิตระยอง — ไตรมาส 1 2569', scope: 'สโคป 1-3 • 31 มี.ค. 2569', value: '3,420 tCO₂e' },
            { title: 'กองยานพาหนะขนส่ง — ปีงบประมาณ 2568', scope: 'สโคป 1 • 31 ธ.ค. 2568', value: '980 tCO₂e' },
          ].map((item, index) => (
            <div key={index} className="py-3.5 flex items-center justify-between hover:bg-gray-50/50 px-2 rounded-lg transition">
              <div>
                <h4 className="text-sm font-semibold text-gray-800">{item.title}</h4>
                <p className="text-xs text-gray-400">{item.scope}</p>
              </div>
              <span className="text-sm font-bold text-gray-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: T-VER Simulation Projects */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Trees className="w-5 h-5 text-emerald-600" /> โครงการจำลองป่า T-VER
          </h3>
          <Link href="/organization/tver-simulation" className="text-xs text-emerald-700 hover:underline flex items-center gap-1 font-semibold">
            ดูทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'โครงการปลูกป่าชุมชนเชียงใหม่', detail: 'สัก (Tectona grandis) • 120 ไร่', credit: '210 tCO₂e' },
            { name: 'โครงการฟื้นฟูกุ่มน้ำน่าน', detail: 'พะยูง • 85 ไร่', credit: '540 tCO₂e' },
          ].map((proj, index) => (
            <div key={index} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-800">{proj.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{proj.detail}</p>
                </div>
                <span className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 rounded-full">
                  ดำเนินการอยู่
                </span>
              </div>
              <div className="flex justify-between items-end pt-2 border-t border-gray-200/60">
                <span className="text-xs text-gray-400">เครดิตสะสม</span>
                <span className="text-sm font-extrabold text-emerald-700">{proj.credit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}