import Link from 'next/link';

export default function FootprintStepper({ current }: { current: 1 | 2 }) {
  const steps = [
    { n: 1, label: 'ข้อมูลสำนักงาน', href: '/organization/footprint' },
    { n: 2, label: 'ข้อมูลการดำเนินกิจกรรม', href: '/organization/footprint/activity' },
  ];

  return (
    <div className="mb-6 flex items-center gap-4">
      {steps.map((s, i) => {
        const active = s.n <= current; // ขั้นที่ถึงแล้วเป็นสีเขียว
        return (
          <div key={s.n} className="flex items-center gap-4">
            <Link href={s.href} className="flex items-center gap-3">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${
                  active ? 'bg-[#6FB898] text-white' : 'bg-[#E2E8F0] text-[#94A3B8]'
                }`}
              >
                {s.n}
              </span>
              <span
                className={`text-lg font-semibold ${
                  s.n === current ? 'text-black' : 'text-[#94A3B8]'
                }`}
              >
                {s.label}
              </span>
            </Link>
            {i < steps.length - 1 && <span className="h-px w-24 bg-[#BDC9C1]" />}
          </div>
        );
      })}
    </div>
  );
}