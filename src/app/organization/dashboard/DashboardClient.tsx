'use client';

import Link from 'next/link';
import type { OrgActivityLog, OrgTreeProject } from '@/types/dashboard';

function formatNumber(n: number | null): string {
  return new Intl.NumberFormat('th-TH').format(n ?? 0);
}

function formatThaiDate(dateStr: string): string {
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function sumCredits(p: OrgTreeProject): number {
  return (p.credit_year_1 ?? 0) + (p.credit_year_2 ?? 0) + (p.credit_year_3 ?? 0);
}

// พันธุ์ไม้ของโครงการ ดึงจากแถวรายละเอียดแถวแรกที่มี tree_id
function getTreeName(p: OrgTreeProject): string {
  return (
    p.org_tree_project_detail?.find((d) => d.tree_list)?.tree_list?.tree_name ??
    'ไม่ระบุพันธุ์ไม้'
  );
}

export default function DashboardClient({
  activities,
  treeProjects,
}: {
  activities: OrgActivityLog[];
  treeProjects: OrgTreeProject[];
}) {
  const latest = activities[0];
  const previous = activities[1];

  let changePercent: number | null = null;
  if (latest?.total_ghg_emission != null && previous?.total_ghg_emission) {
    changePercent =
      ((latest.total_ghg_emission - previous.total_ghg_emission) /
        previous.total_ghg_emission) *
      100;
  }

  const totalActiveCredits = treeProjects.reduce((sum, p) => sum + sumCredits(p), 0);

  return (
    <div className="max-w-[1256px] mx-auto px-8 py-8 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-[32px] font-semibold text-black">การแสดงผลการคำนวณองค์กร</h1>
        <p className="text-base font-medium text-[#315757]">
          ภาพรวมข้อมูลการปล่อยก๊าซเรือนกระจกขององค์กร
        </p>
      </div>

      {/* Top Metrics */}
      <div className="flex flex-col gap-4">
        {/* Metric: Net Emissions */}
        <div className="bg-white border-2 border-[#DAE2EA] shadow-sm rounded-xl p-6">
          <div className="space-y-3">
            <p className="text-sm font-bold text-[#64748B]">การปล่อยก๊าซสุทธิ (ล่าสุด)</p>
            <div className="flex items-baseline gap-2">
              <span className="text-[36px] font-bold text-[#0F172A]">
                {formatNumber(latest?.total_ghg_emission ?? null)}
              </span>
              <span className="text-base font-bold text-[#64748B]">
                tCO<sub>2</sub>e
              </span>
            </div>
            {changePercent !== null && (
              <p
                className={`text-sm font-medium ${
                  changePercent < 0 ? 'text-[#16A34A]' : 'text-[#F97316]'
                }`}
              >
                {changePercent > 0 ? '+' : ''}
                {changePercent.toFixed(1)}% เทียบกับช่วงก่อนหน้า
              </p>
            )}
          </div>
        </div>

        {/* Metric: Active T-VER Credits */}
        <div className="bg-white border-2 border-[#DAE2EA] shadow-sm rounded-xl p-6">
          <div className="space-y-3">
            <p className="text-sm font-bold text-[#64748B]">เครดิต T-VER ที่ใช้งานอยู่</p>
            <div className="flex items-baseline gap-2">
              <span className="text-[36px] font-bold text-[#0F172A]">
                {formatNumber(totalActiveCredits)}
              </span>
              <span className="text-base font-bold text-[#64748B]">
                tCO<sub>2</sub>e
              </span>
            </div>
            <p className="text-sm text-[#64748B]">จาก {treeProjects.length} โครงการ</p>
          </div>
        </div>
      </div>

      {/* Emission Logs Section */}
      <div className="bg-white border-2 border-[#DAE2EA] shadow-sm rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0F172A]">
            บันทึกการปล่อยก๊าซเรือนกระจกขององค์กร
          </h2>
          <Link
            href="/organization/footprint"
            className="flex items-center gap-1 text-sm font-bold text-[#6B7280]"
          >
            กรอกข้อมูลใหม่ ›
          </Link>
        </div>

        <div>
          {activities.length === 0 && (
            <p className="text-sm text-[#64748B] py-6 text-center">ยังไม่มีบันทึกการปล่อยก๊าซ</p>
          )}
          {activities.slice(0, 3).map((log, idx) => (
            <div
              key={log.orgactlist_id}
              className={`flex items-center justify-between py-5 ${
                idx > 0 ? 'border-t border-[#F1F5F9]' : ''
              }`}
            >
              <div>
                <h3 className="text-base font-bold text-[#1E293B]">{log.orgact_name}</h3>
                <p className="text-xs text-[#64748B]">{formatThaiDate(log.created_at)}</p>
              </div>
              <p className="text-base font-bold text-[#0F172A]">
                {formatNumber(log.total_ghg_emission)} {log.unit ?? 'tCO2e'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* T-VER Projects Section */}
      <div className="bg-white border-2 border-[#DAE2EA] shadow-sm rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0F172A]">โครงการจำลองป่า T-VER</h2>
          <Link
            href="/organization/tver-simulation"
            className="flex items-center gap-1 text-sm font-bold text-[#64748B]"
          >
            + จำลองโครงการใหม่
          </Link>
        </div>

        <div className="space-y-2">
          {treeProjects.length === 0 && (
            <p className="text-sm text-[#64748B] py-6 text-center">ยังไม่มีโครงการ T-VER</p>
          )}
          {treeProjects.map((p) => (
            <Link
              key={p.orgtreeproject_id}
              href={`/organization/tver-simulation/${p.orgtreeproject_id}`}
              className="block space-y-4 border-b border-[#F8FAFC] last:border-b-0 rounded-lg p-3 -mx-3 hover:bg-[#F8FAFC] transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#1E293B]">{p.project_name}</h3>
                  <p className="text-xs text-[#64748B]">
                    {getTreeName(p)} •{' '}
                    {p.join_year ? `เข้าร่วมปี พ.ศ. ${p.join_year + 543}` : 'ไม่ระบุปี'}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#F0FDF4] border border-[#DCFCE7] text-[11px] font-bold text-[#16A34A]">
                  ดำเนินการอยู่
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#16A34A]">เครดิตสะสม</p>
                <div className="flex items-center gap-4">
                  <p className="text-base font-bold text-[#16A34A]">
                    {formatNumber(sumCredits(p))} tCO<sub>2</sub>e
                  </p>
                  <span className="text-xs font-semibold text-[#64748B]">
                    ดูรายละเอียด/แก้ไข ›
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}