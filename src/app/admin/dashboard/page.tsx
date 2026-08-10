const recentActivities = [
  ["บริษัท กรีนเวิลด์ จำกัด", "ส่งรายงานการปล่อยก๊าซ Q2", "02 ส.ค. 2569", "สำเร็จ", "success"],
  ["บริษัท ไทยเอเนอร์จี โซลูชั่น", "ยื่นเอกสารโครงการ T-VER", "02 ส.ค. 2569", "รอตรวจสอบ", "warning"],
  ["ห้างหุ้นส่วน สยามคาร์บอน", "พยายามเข้าสู่ระบบล้มเหลว 5 ครั้ง", "01 ส.ค. 2569", "ผิดปกติ", "danger"],
  ["บริษัท เอิร์ธ โปรดักส์ จำกัด", "คำนวณภาษีนิติบุคคลสำเร็จ", "01 ส.ค. 2569", "สำเร็จ", "success"],
];

const statusClass: Record<string, string> = {
  success: "bg-[#DEF7EC] text-[#0F4A3B]",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
};

export default function DashboardPage() {
  const cards = [
    ["องค์กรทั้งหมด", "312", "▲ 4.2% จากเดือนก่อน", "normal"],
    ["ผู้ใช้งานทั้งหมด", "1,284", "▲ 2.8% จากเดือนก่อน", "normal"],
    ["บัญชีที่ผิดปกติ", "7", "ต้องตรวจสอบ 3 รายการ", "danger"],
    ["การคำนวณคาร์บอน", "8,940", "▲ 12.1% จากเดือนก่อน", "normal"],
    ["โครงการ T-VER", "46", "รออนุมัติ 5 โครงการ", "normal"],
    ["รายงานล่าสุด", "128", "วันนี้ 6 ฉบับ", "normal"],
  ];

  const bars = [120, 132, 101, 134, 150, 142, 158];

  return (
    <section>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#152420]">ภาพรวมระบบ</h1>
          <p className="mt-1 text-sm text-[#67766F]">อัปเดตล่าสุด 3 ส.ค. 2569 · 09:41 น.</p>
        </div>
        <div className="flex gap-2">
          <select className="rounded-xl border border-[#E7ECE9] bg-white px-3 py-2 text-sm text-[#3A4A44]">
            <option>7 วันล่าสุด</option>
            <option>30 วันล่าสุด</option>
            <option>ไตรมาสนี้</option>
          </select>
          <button className="rounded-xl border border-[#E7ECE9] bg-white px-3 py-2 text-sm hover:bg-[#F0FBF7]">
            ส่งออกรายงาน
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        {cards.map(([label, value, note, type]) => (
          <div key={label} className="rounded-xl border border-[#E7ECE9] bg-white p-5 shadow-sm">
            <p className="mb-2 text-xs text-[#67766F]">{label}</p>
            <p className={`font-mono text-2xl font-semibold ${type === "danger" ? "text-red-600" : "text-[#152420]"}`}>
              {value}
            </p>
            <p className={`mt-1.5 text-xs ${type === "danger" ? "text-red-500" : "text-[#117056]"}`}>{note}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#E7ECE9] bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-[#152420]">ปริมาณการปล่อยก๊าซเรือนกระจกรวม (tCO2e)</h3>
            <div className="hidden gap-3 text-xs text-[#67766F] sm:flex">
              <span>● Scope 1</span><span>● Scope 2</span><span>● Scope 3</span>
            </div>
          </div>
          <div className="flex h-56 items-end gap-3 border-b border-[#E7ECE9] px-4 pt-5">
            {bars.map((v, i) => (
              <div key={i} className="flex h-full flex-1 flex-col justify-end">
                <div className="rounded-t-md bg-[#22AD82]" style={{ height: `${(v / 160) * 85}%` }} />
                <span className="pt-2 text-center text-xs text-[#67766F]">
                  {["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค."][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#E7ECE9] bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-[#152420]">สัดส่วนกลยุทธ์คาร์บอนเครดิต</h3>
          <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-full bg-[conic-gradient(#158C69_0_42%,#4CC69E_42%_77%,#BAEDD9_77%_100%)]">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-center text-xs text-[#67766F]">
              กลยุทธ์<br />ทั้งหมด
            </div>
          </div>
          <div className="mt-4 space-y-2 text-xs text-[#67766F]">
            <p>● Net Zero — 42%</p>
            <p>● Carbon Neutral — 35%</p>
            <p>● ขายคาร์บอนเครดิต — 23%</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E7ECE9] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#E7ECE9] px-6 py-4">
          <h3 className="font-semibold text-[#152420]">กิจกรรมล่าสุดในระบบ</h3>
          <a href="/admin/activities" className="text-sm font-medium text-[#117056]">ดูทั้งหมด</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#E7ECE9]/40 text-xs text-[#67766F]">
                <th className="px-6 py-3 text-left font-medium">องค์กร</th>
                <th className="px-6 py-3 text-left font-medium">กิจกรรม</th>
                <th className="px-6 py-3 text-left font-medium">วันที่</th>
                <th className="px-6 py-3 text-left font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7ECE9]">
              {recentActivities.map(([org, activity, date, status, type]) => (
                <tr key={org} className="hover:bg-[#F0FBF7]">
                  <td className="px-6 py-3.5">{org}</td>
                  <td className="px-6 py-3.5 text-[#67766F]">{activity}</td>
                  <td className="px-6 py-3.5 font-mono text-[#A9B5AF]">{date}</td>
                  <td className="px-6 py-3.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass[type]}`}>{status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
