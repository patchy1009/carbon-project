"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/users", label: "ผู้ใช้งาน" },
  { href: "/admin/abnormal", label: "มอนิเตอร์บัญชี" },
  { href: "/admin/activities", label: "ข้อมูลกิจกรรม" },
  { href: "/admin/formula", label: "สูตรคำนวณ" },
  { href: "/admin/recommendation", label: "แนวทางลดคาร์บอน" },
  { href: "/admin/guideline", label: "โครงการ T-VER" },
  { href: "/admin/documents", label: "เอกสาร" },
  { href: "/admin/allocation", label: "การจัดสรรคาร์บอนเครดิต" },
  { href: "/admin/tax", label: "ภาษี" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F7FAF8] text-[#25352F]">
      <header className="sticky top-0 z-40 bg-gradient-to-r from-[#117056] to-[#158C69] text-white shadow-[0_1px_3px_rgba(15,74,59,0.12)]">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-6">
          <Link href="/admin/dashboard" className="flex shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 font-bold">C</div>
            <div className="leading-tight">
              <p className="font-semibold text-[15px]">Carbon Calculator</p>
              <p className="text-[11px] text-[#DEF7EC]">Admin</p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="การแจ้งเตือน"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10"
            >
              <span className="text-lg">♧</span>
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-400 ring-2 ring-[#117056]" />
            </button>

            <div className="ml-1 flex items-center gap-2 border-l border-white/20 pl-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
                อว
              </div>
              <div className="hidden leading-tight xl:block">
                <p className="text-[13px] font-medium">อมรรัตน์ วงศ์ดี</p>
                <p className="text-[11px] text-[#DEF7EC]">ผู้ดูแลระบบ</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/login")}
              className="ml-2 rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-medium hover:bg-white/20"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>

        <nav className="mx-auto flex h-11 max-w-[1440px] items-center gap-6 overflow-x-auto border-t border-white/10 px-6 text-[13px] font-medium">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative whitespace-nowrap pb-0 transition ${
                  active
                    ? "text-white after:absolute after:-bottom-[14px] after:left-0 after:right-0 after:h-[3px] after:rounded-t-md after:bg-[#22AD82]"
                    : "text-[#BAEDD9] hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-8">{children}</main>
    </div>
  );
}
