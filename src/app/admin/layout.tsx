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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // [แก้ไข] ใช้ฟอนต์เดียวกับฝั่ง organization (font-sans)
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-800 font-sans">
      {/* Top Navbar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-[84px] flex items-center justify-between px-8 rounded-bl-[50px]"
        style={{
          background: 'linear-gradient(90deg, #2D4A63 0%, #32885F 100%)',
          boxShadow: '-1px 6px 12.1px rgba(0, 63, 66, 0.81)',
        }}
      >
        {/* [แก้ไข] โลโก้และส่วนผู้ใช้ให้หน้าตาเดียวกับ navbar ฝั่ง organization */}
        <div className="flex items-baseline gap-3">
          <Link
            href="/admin/ef-gwp"
            className="text-white font-bold text-[28px] font-['Prompt'] hover:opacity-90 transition"
            style={{ textShadow: '3px 2px 2.8px rgba(0,0,0,0.25)' }}
          >
            Carbon Calculator
          </Link>
          <span className="text-white/80 text-sm">Admin</span>
        </div>

        {/* [แก้ไข] เดิมแสดงชื่อ/บทบาทจาก user_roles + ไอคอนออกจากระบบ
            ตอนนี้ใช้ NavUser เดียวกับฝั่ง organization: อีเมล + "ออกจากระบบ" + วงกลมผู้ใช้ */}
        <NavUser />
      </header>

      <div className="pt-[84px] flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-[84px] bottom-0 w-[179px] bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.3)] overflow-y-auto">
          <nav className="flex flex-col gap-1 px-3 pt-6 pb-4">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2.5 text-sm font-medium ${
                    isActive ? 'bg-[#F2D84E] text-black' : 'text-black hover:bg-[#F1F5F9]'
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