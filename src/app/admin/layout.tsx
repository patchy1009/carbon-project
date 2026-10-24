// src/app/admin/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const navItems = [
  { label: 'EF & GWP Value', href: '/admin/ef-gwp' },
  { label: 'Activity Management', href: '/admin/activities' },
  { label: 'สำนักงาน & คำแนะนำ', href: '/admin/officerec' },
  { label: 'T-VER Project', href: '/admin/tver' },
  { label: 'Allocation & TAX & Doc', href: '/admin/allotaxdoc' },
];

interface AdminProfile {
  full_name: string;
  role: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<AdminProfile | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_roles')
        .select('full_name, role')
        .eq('user_id', user.id)
        .single();

      if (data) setProfile(data as AdminProfile);
    }
    loadProfile();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Navbar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-[84px] flex items-center justify-between px-8 rounded-bl-[50px]"
        style={{
          background: 'linear-gradient(90deg, #2D4A63 0%, #32885F 100%)',
          boxShadow: '-1px 6px 12.1px rgba(0, 63, 66, 0.81)',
        }}
      >
        <div>
          <h1 className="text-white font-bold text-2xl leading-[22px] font-['Prompt']">
            Carbon Calculator
          </h1>
          <p className="text-white text-sm font-['Prompt']">Admin</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FF951B] flex items-center justify-center text-white text-sm font-bold font-['Prompt']">
              {profile?.full_name?.slice(0, 2) ?? '..'}
            </div>
            <div className="text-right">
              <p className="text-white text-base font-semibold leading-5">
                {profile?.full_name ?? 'กำลังโหลด...'}
              </p>
              <p className="text-white text-sm font-light leading-4">
                {profile?.role ?? ''}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} aria-label="ออกจากระบบ">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
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
                  className={`rounded-md px-3 py-2.5 text-sm font-medium font-['Sarabun'] ${
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