// src/app/admin/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NavUser from '@/components/NavUser';

const navItems = [
  { label: 'EF & GWP Value', href: '/admin/ef-gwp' },
  { label: 'Activity Management', href: '/admin/activities' },
  { label: 'สำนักงาน & คำแนะนำ', href: '/admin/officerec' },
  { label: 'T-VER Project', href: '/admin/tver' },
  { label: 'Allocation & TAX & Doc', href: '/admin/allotaxdoc' },
];

// โครงหน้าฝั่งแอดมิน: แถบด้านบนและเมนูด้านข้างที่ใช้ร่วมกันทุกหน้า
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // ใช้ฟอนต์เดียวกับฝั่ง organization (font-sans)
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-800 font-sans">
      {/* Top Navbar */}
      {/* navbar ให้หน้าตาเดียวกับฝั่ง organization (ดูคอมเมนต์ใน organization/layout.tsx):
          [MERGE aom + cyn2] ขนาดตัวอักษรใช้ตามฝั่ง organization (navbar ของ cyn2):
          สูง 84px, โลโก้ 28px ตัวหนา ฟอนต์ Prompt (font-display), ขวาเหลือแค่วงกลมผู้ใช้ */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-[84px] flex items-center justify-between px-8 rounded-bl-[50px]"
        style={{
          background: 'linear-gradient(90deg, #2D4A63 0%, #32885F 100%)',
          boxShadow: '0 6px 16px rgba(0, 50, 50, 0.35)',
        }}
      >
        <div className="flex items-baseline gap-3">
          <Link
            href="/admin/ef-gwp"
            className="font-display text-white font-bold text-[28px] tracking-tight hover:opacity-90 transition"
          >
            Carbon Calculator
          </Link>
          <span className="text-white/80 text-sm">Admin</span>
        </div>

        {/* วงกลมผู้ใช้: กดแล้วเห็นอีเมล + ปุ่มออกจากระบบ (NavUser ตัวเดียวกับฝั่ง organization) */}
        <NavUser />
      </header>

      <div className="pt-[84px] flex">
        {/* Sidebar */}
        {/* เดิมเงาเข้มรอบเมนูซ้าย -> เส้นขอบบางด้านขวา ดูเบาและทันสมัยขึ้น (ตำแหน่ง/ความกว้างเดิม) */}
        <aside className="fixed left-0 top-[84px] bottom-0 w-[179px] bg-white border-r border-[#E2E8F0] overflow-y-auto">
          <nav className="flex flex-col gap-1 px-3 pt-6 pb-4">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  // เมนูที่เปิดอยู่: คงพื้นเหลืองตามแบบเดิม เพิ่มตัวหนา / เมนูอื่นตัวสีเทาเข้ม ให้แยกกันชัดขึ้น
                  aria-current={isActive ? 'page' : undefined}
                  // [MERGE aom + cyn2] เดิม text-sm (14px) -> text-base (16px) ให้ใกล้เมนูฝั่ง organization
                  // (ฝั่ง organization 20px แต่เมนูด้านข้างกว้างแค่ 179px ถ้าใช้ 20px ชื่อเมนูจะตัดบรรทัด)
                  className={`rounded-lg px-3 py-2.5 text-base transition ${
                    isActive ? 'bg-[#F2D84E] font-semibold text-black' : 'font-medium text-[#334155] hover:bg-[#F1F5F9]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="ml-[179px] flex-1 min-h-[calc(100vh-84px)]">
          {children}
        </main>
      </div>
    </div>
  );
}