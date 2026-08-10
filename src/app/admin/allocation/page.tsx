const targets = [
  ["Net Zero", "100", "100%", "ชดเชยการปล่อยก๊าซเรือนกระจกทั้งหมดให้เป็นศูนย์ ไม่มีการขายคาร์บอนเครดิตส่วนเกิน"],
  ["Carbon Neutral", "70", "70% ชดเชย · 30% ขาย", "ชดเชยคาร์บอนไดออกไซด์เป็นหลัก และขายส่วนเกินเป็นคาร์บอนเครดิตตามความสมัครใจ"],
  ["Carbon Credit Selling", "20", "20% ชดเชย · 80% ขาย", "เน้นสร้างรายได้จากการขายคาร์บอนเครดิตส่วนเกินในตลาดคาร์บอน"],
];

export default function AllocationPage() {
  return (
    <section>
      <div className="mb-6 flex items-end justify-between">
        <div><h1 className="text-2xl font-semibold text-[#152420]">การจัดสรรคาร์บอนเครดิต</h1><p className="mt-1 text-sm text-[#67766F]">กำหนดสัดส่วนชดเชยและขายคาร์บอนเครดิตตามเป้าหมายขององค์กร</p></div>
        <button className="rounded-xl bg-[#158C69] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#117056]">+ เพิ่มเป้าหมาย</button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {targets.map(([name, percentage, label, description]) => (
          <div key={name} className="rounded-xl border border-[#E7ECE9] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-[#152420]">{name}</h3>
              <button className="rounded-lg px-2 py-1 text-xs font-medium text-[#117056] hover:bg-[#F0FBF7]">แก้ไข</button>
            </div>
            <div className="mb-1 flex items-end gap-1"><span className="font-mono text-3xl font-semibold text-[#152420]">{percentage}</span><span className="mb-1 text-sm text-[#67766F]"> {label === "100%" ? "% ชดเชย" : label}</span></div>
            <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-[#E7ECE9]"><div className="h-full rounded-full bg-[#158C69]" style={{ width: `${percentage}%` }} /></div>
            <p className="text-sm leading-relaxed text-[#67766F]">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
