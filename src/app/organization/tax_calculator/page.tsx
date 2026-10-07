'use client';

import React, { useState } from 'react';
import { Calculator, FileSpreadsheet, CheckCircle } from 'lucide-react';

export default function TaxCalculatorPage() {
  const [revenue, setRevenue] = useState('50000000');
  const [carbonCreditsUsed, setCarbonCreditsUsed] = useState('862.5');
  const [calculatedTax, setCalculatedTax] = useState<number | null>(null);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    // ตัวอย่างสูตรคำนวณจำลองภาษีเงินได้นิติบุคคลหักลดหย่อนคาร์บอนเครดิต
    const revNum = parseFloat(revenue) || 0;
    const creditNum = parseFloat(carbonCreditsUsed) || 0;
    
    // สมมติฐาน: หักค่าใช้จ่าย/ลดหย่อนจากเครดิต T-VER (เครดิตละ 300 บาท เป็นต้น)
    const taxBefore = revNum * 0.20; // 20% ภาษีนิติบุคคล
    const deduction = creditNum * 300; 
    const final = Math.max(0, taxBefore - deduction);
    
    setCalculatedTax(final);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">คำนวณภาษีและสิทธิประโยชน์ทางคาร์บอน</h1>
        <p className="text-sm text-gray-500">ประเมินภาระภาษีนิติบุคคลและการหักลดหย่อนจากการใช้เครดิต T-VER</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form Inputs */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-700" /> ข้อมูลทางการเงินและเครดิต
          </h2>

          <form onSubmit={handleCalculate} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">รายได้รวมประจำปี (บาท)</label>
              <input 
                type="number" 
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">ปริมาณคาร์บอนเครดิต T-VER ที่นำมาหักลดหย่อน (tCO₂e)</label>
              <input 
                type="number" 
                value={carbonCreditsUsed}
                onChange={(e) => setCarbonCreditsUsed(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <button 
              type="submit"
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-sm transition shadow-sm"
            >
              คำนวณภาษีและสิทธิประโยชน์
            </button>
          </form>
        </div>

        {/* Results Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-800 pb-2 border-b">ผลการคำนวณภาษี</h2>
            {calculatedTax !== null ? (
              <div className="mt-6 space-y-4">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-xs text-emerald-700 font-semibold">ประมาณการภาษีสุทธิที่ต้องชำระ</span>
                    <h3 className="text-2xl font-extrabold text-emerald-900">{calculatedTax.toLocaleString()} บาท</h3>
                  </div>
                </div>
                <p className="text-xs text-gray-500">*คำนวณตามอัตราภาษีนิติบุคคล 20% พร้อมสิทธิหักลดหย่อนโครงการลดก๊าซเรือนกระจกภาคสมัครใจ (T-VER)</p>
              </div>
            ) : (
              <div className="py-16 text-center text-gray-400 text-sm">
                กรุณากรอกข้อมูลและกดปุ่มคำนวณเพื่อดูผลลัพธ์
              </div>
            )}
          </div>

          {calculatedTax !== null && (
            <button 
              onClick={() => alert('ดาวน์โหลดรายงานภาษีเป็นไฟล์ Excel สำเร็จ')}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" /> ดาวน์โหลดรายงานภาษี (.xlsx)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}