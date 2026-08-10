const recommendations = [
  ["1", "เปลี่ยนหลอดไฟเป็น LED ทั้งอาคาร", "พลังงาน", "12.4"],
  ["2", "ปรับเส้นทางขนส่งให้สั้นลงและรวมรอบส่งของ", "การขนส่ง", "8.7"],
  ["3", "คัดแยกและรีไซเคิลของเสียก่อนฝังกลบ", "ของเสีย", "5.2"],
];

export default function RecommendationPage() {
  return (
    <section>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#152420]">แนวทางลดคาร์บอน</h1>
          <p className="mt-1 text-sm text-[#67766F]">จัดการคำแนะนำที่แสดงให้องค์กรตามผลการคำนวณคาร์บอน</p>
        </div>
        <button className="rounded-xl bg-[#158C69] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#117056]">+ เพิ่มแนวทาง</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E7ECE9] bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E7ECE9] p-4">
          <input placeholder="ค้นหาชื่อแนวทาง" className="min-w-[220px] flex-1 rounded-xl border border-[#E7ECE9] px-4 py-2.5 text-sm outline-none focus:border-[#22AD82]" />
          <select className="rounded-xl border border-[#E7ECE9] px-3 py-2.5 text-sm"><option>ประเภทกิจกรรม: ทั้งหมด</option><option>พลังงาน</option><option>การขนส่ง</option><option>ของเสีย</option></select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#E7ECE9]/40 text-xs text-[#67766F]">
              <th className="px-6 py-3 text-left font-medium">ลำดับ</th><th className="px-6 py-3 text-left font-medium">ชื่อแนวทาง</th><th className="px-6 py-3 text-left font-medium">ประเภทกิจกรรม</th><th className="px-6 py-3 text-left font-medium">ปริมาณการลด (tCO2e)</th><th className="px-6 py-3 text-right font-medium">การดำเนินการ</th>
            </tr></thead>
            <tbody className="divide-y divide-[#E7ECE9]">
              {recommendations.map(([no,name,type,amount]) => (
                <tr key={no} className="hover:bg-[#F0FBF7]">
                  <td className="px-6 py-3.5 font-mono text-[#A9B5AF]">{no}</td><td className="px-6 py-3.5 font-medium text-[#152420]">{name}</td><td className="px-6 py-3.5 text-[#67766F]">{type}</td><td className="px-6 py-3.5 font-mono text-[#67766F]">{amount}</td>
                  <td className="px-6 py-3.5 text-right whitespace-nowrap"><button className="px-2.5 py-1.5 text-xs font-medium text-[#117056]">แก้ไข</button><button className="px-2.5 py-1.5 text-xs font-medium text-red-600">ลบ</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[#E7ECE9] px-6 py-4 text-sm text-[#67766F]"><p>แสดง 1–3 จาก 24 รายการ</p><div className="flex gap-1"><button className="h-8 w-8 rounded-lg border border-[#E7ECE9]">‹</button><button className="h-8 w-8 rounded-lg bg-[#158C69] text-white">1</button><button className="h-8 w-8 rounded-lg border border-[#E7ECE9]">2</button><button className="h-8 w-8 rounded-lg border border-[#E7ECE9]">›</button></div></div>
      </div>
    </section>
  );
}
