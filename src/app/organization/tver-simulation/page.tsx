'use client';

import React, { useState } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';

export default function TverSimulationPage() {
  const [step, setStep] = useState<1 | 2>(1);

  // Form states step 1
  const [projectName, setProjectName] = useState('โครงการปลูกป่าสัก ที่ราบสูงตอนเหนือ');
  const [treeType, setTreeType] = useState('สัก (Tectona grandis)');
  const [areaSize, setAreaSize] = useState('500');
  const [treesCount, setTreesCount] = useState('125');
  const [startDate, setStartDate] = useState('01/01/2024');

  // Form states step 2 (Logic strategy)
  const [strategy, setStrategy] = useState<'net_zero' | 'carbon_neutral' | 'credit_selling'>('carbon_neutral');
  const [selectedFootprints, setSelectedFootprints] = useState<string[]>(['FP-2024-001']);

  const handleToggleSelectFP = (id: string) => {
    if (selectedFootprints.includes(id)) {
      setSelectedFootprints(selectedFootprints.filter(item => item !== id));
    } else {
      setSelectedFootprints([...selectedFootprints, id]);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จำลองโครงการ T-VER</h1>
          <p className="text-sm text-gray-500">การจำลองโครงการปลูกป่าและการจัดสรรคาร์บอนเครดิต</p>
        </div>
        {step === 2 && (
          <button 
            onClick={() => alert('บันทึกข้อมูลจำลองสำเร็จ!')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
          >
            บันทึกข้อมูล
          </button>
        )}
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className={`flex items-center gap-2 ${step === 1 ? 'text-emerald-700 font-bold' : 'text-gray-400'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${step === 1 ? 'bg-emerald-700 text-white' : 'bg-gray-200 text-gray-600'}`}>1</div>
          <span>จำลองโครงการ</span>
        </div>
        <div className="w-12 h-0.5 bg-gray-200"></div>
        <div className={`flex items-center gap-2 ${step === 2 ? 'text-emerald-700 font-bold' : 'text-gray-400'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${step === 2 ? 'bg-emerald-700 text-white' : 'bg-gray-200 text-gray-600'}`}>2</div>
          <span>จัดสรรเครดิตและรายงาน</span>
        </div>
      </div>

      {/* STEP 1 CONTENT */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Form */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-base font-bold text-gray-800 pb-2 border-b">ตั้งค่าโครงการปลูกป่า</h2>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">ชื่อโครงการ</label>
              <input 
                type="text" 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">พันธุ์ไม้</label>
              <select 
                value={treeType}
                onChange={(e) => setTreeType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              >
                <option>สัก (Tectona grandis)</option>
                <option>ยางนา (Dipterocarpus alatus)</option>
                <option>พะยูง (Dalbergia cochinchinensis)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">พื้นที่ปลูก (ไร่)</label>
                <input 
                  type="number" 
                  value={areaSize}
                  onChange={(e) => setAreaSize(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">จำนวนต้นไม้ต่อไร่</label>
                <input 
                  type="number" 
                  value={treesCount}
                  onChange={(e) => setTreesCount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">วันที่เริ่มโครงการ</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <Calendar className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <button 
              onClick={() => setStep(2)}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              คำนวณและดูรายงาน <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right Chart Preview */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-base font-bold text-gray-800">การประมาณคาร์บอนเครดิต 3 ปี</h2>
            <p className="text-xs text-gray-400">tCO₂e ที่เกิดขึ้นในต่อรอบบัญชี</p>

            {/* Simulated Bar Chart */}
            <div className="h-64 flex items-end justify-around gap-6 pt-8 pb-4 border-b border-gray-100">
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="w-16 bg-emerald-500 rounded-t-lg h-36 flex items-center justify-center text-white text-xs font-bold">1,250</div>
                <span className="text-xs text-gray-500 font-medium">ช่วงที่ 1</span>
              </div>
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="w-16 bg-amber-500 rounded-t-lg h-44 flex items-center justify-center text-white text-xs font-bold">1,475</div>
                <span className="text-xs text-gray-500 font-medium">ช่วงที่ 2</span>
              </div>
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="w-16 bg-cyan-500 rounded-t-lg h-56 flex items-center justify-center text-white text-xs font-bold">1,725</div>
                <span className="text-xs text-gray-500 font-medium">ช่วงที่ 3</span>
              </div>
            </div>

            {/* Summary badges */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3 bg-gray-50 rounded-xl text-center">
                <span className="text-[11px] text-gray-400 block">ปีที่ 1</span>
                <span className="text-sm font-bold text-emerald-700">1,250</span>
                <span className="text-[10px] text-gray-400 block">tCO₂e</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl text-center">
                <span className="text-[11px] text-gray-400 block">ปีที่ 2</span>
                <span className="text-sm font-bold text-emerald-700">1,475</span>
                <span className="text-[10px] text-emerald-600 block font-semibold">+18% เติบโต</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl text-center">
                <span className="text-[11px] text-gray-400 block">ปีที่ 3</span>
                <span className="text-sm font-bold text-emerald-700">1,725</span>
                <span className="text-[10px] text-emerald-600 block font-semibold">+38% เติบโต</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 CONTENT */}
      {step === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strategy Form */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-5">
            <h2 className="text-base font-bold text-gray-800 pb-2 border-b">ตรรกะการจัดสรรเครดิต</h2>

            <div className="space-y-3">
              <label className="text-xs font-medium text-gray-600">เป้าหมายองค์กร</label>
              
              <div 
                onClick={() => setStrategy('net_zero')}
                className={`p-3.5 rounded-xl border cursor-pointer transition ${strategy === 'net_zero' ? 'border-emerald-600 bg-emerald-50/40' : 'border-gray-200'}`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-gray-800">
                  <input type="radio" checked={strategy === 'net_zero'} readOnly />
                  <span>เป้าหมายการปล่อยก๊าซสุทธิเป็นศูนย์ (Net Zero)</span>
                </div>
                <p className="text-xs text-gray-500 ml-5 mt-1">ชดเชยเต็มจำนวนตามลำดับ → ส่วนที่เหลือ นำไปขายได้</p>
              </div>

              <div 
                onClick={() => setStrategy('carbon_neutral')}
                className={`p-3.5 rounded-xl border cursor-pointer transition ${strategy === 'carbon_neutral' ? 'border-emerald-600 bg-emerald-50/40' : 'border-gray-200'}`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-gray-800">
                  <input type="radio" checked={strategy === 'carbon_neutral'} readOnly />
                  <span>ความเป็นกลางทางคาร์บอน (Carbon Neutral)</span>
                </div>
                <p className="text-xs text-gray-500 ml-5 mt-1">ชดเชย 50% - ขาย 50%</p>
              </div>

              <div 
                onClick={() => setStrategy('credit_selling')}
                className={`p-3.5 rounded-xl border cursor-pointer transition ${strategy === 'credit_selling' ? 'border-emerald-600 bg-emerald-50/40' : 'border-gray-200'}`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-gray-800">
                  <input type="radio" checked={strategy === 'credit_selling'} readOnly />
                  <span>การขายเครดิต (Credit Selling)</span>
                </div>
                <p className="text-xs text-gray-500 ml-5 mt-1">ชดเชย 20% - ขาย 80%</p>
              </div>
            </div>

            {/* Select footprint records */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-medium text-gray-600">เลือกบันทึกการปล่อยก๊าซที่ต้องการลด *</label>
              {[
                { id: 'FP-2024-001', name: 'การดำเนินงานไตรมาส 1 ปี 2024', val: '6,900 tCO₂e' },
                { id: 'FP-2024-002', name: 'การดำเนินงานไตรมาส 2 ปี 2024', val: '6,030 tCO₂e' },
                { id: 'FP-2024-003', name: 'การดำเนินงานไตรมาส 3 ปี 2024', val: '6,500 tCO₂e' },
              ].map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => handleToggleSelectFP(item.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${selectedFootprints.includes(item.id) ? 'border-emerald-600 bg-emerald-50/20' : 'border-gray-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selectedFootprints.includes(item.id)} readOnly />
                    <div>
                      <span className="text-xs font-bold text-gray-800">{item.id}</span>
                      <span className="text-xs text-gray-500 ml-2">{item.name}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-700">{item.val}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setStep(1)}
                className="w-1/3 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition"
              >
                ย้อนกลับ
              </button>
              <button 
                onClick={() => alert('คำนวณและสร้างรายงานเรียบร้อย')}
                className="w-2/3 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-sm transition shadow-sm"
              >
                คำนวณและดูรายงาน
              </button>
            </div>
          </div>

          {/* Allocation Report View */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-800">รายงานผลการจัดสรรคาร์บอนเครดิต</h2>
              <p className="text-xs text-gray-400">ความเป็นกลางทางคาร์บอน — ชดเชย 50% · ขาย 50%</p>
            </div>

            {/* Chart line simulation */}
            <div className="h-32 border-b border-gray-100 flex items-end justify-between px-4 pb-2 bg-gray-50/50 rounded-xl">
              <div className="text-[11px] text-gray-400">ปีที่ 1 (2567): 1,250 tCO₂e</div>
              <div className="text-[11px] text-gray-400">ปีที่ 3 (2569): 1,725 tCO₂e</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-gray-400 border-b">
                  <tr>
                    <th className="pb-2 font-medium">ช่วงเวลา</th>
                    <th className="pb-2 font-medium">จำนวนต้นไม้ (ประมาณ)</th>
                    <th className="pb-2 font-medium">เครดิตที่เกิดขึ้น</th>
                    <th className="pb-2 font-medium">เครดิตสะสม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  <tr>
                    <td className="py-2.5">ปีที่ 1 (2567)</td>
                    <td>62,500</td>
                    <td>1,250 tCO₂e</td>
                    <td>1,250 tCO₂e</td>
                  </tr>
                  <tr>
                    <td className="py-2.5">ปีที่ 2 (2568)</td>
                    <td>62,500</td>
                    <td>1,475 tCO₂e</td>
                    <td>2,725 tCO₂e</td>
                  </tr>
                  <tr>
                    <td className="py-2.5">ปีที่ 3 (2569)</td>
                    <td>62,500</td>
                    <td>1,725 tCO₂e</td>
                    <td>4,450 tCO₂e</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between text-xs">
                <span className="text-emerald-700 font-medium">🟢 เครดิตสำหรับชดเชย</span>
                <span className="font-bold text-gray-800">862.5</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-emerald-700 font-medium">🟢 เครดิตที่ขายได้</span>
                <span className="font-bold text-gray-800">862.5</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t text-gray-900">
                <span>รวม (ปีที่ 3)</span>
                <span className="text-emerald-700">1,725</span>
              </div>
            </div>

            <button 
              onClick={() => alert('กำลังนำท่านไปยังหน้าคำนวณภาษี...')}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition shadow-sm"
            >
              เริ่มคำนวณภาษี
            </button>
          </div>
        </div>
      )}
    </div>
  );
}