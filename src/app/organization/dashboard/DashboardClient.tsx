'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { dbErrorMessage } from '@/lib/supabaseCrud';
import { showConfirm, showError } from '@/lib/dialog';
import type { OrgActivityLog, OrgTreeProject } from '@/types/dashboard';

/* [เพิ่ม] ลบรายการบันทึกการปล่อยก๊าซ และโครงการ T-VER จากหน้า Dashboard
 * ลบข้อมูลลูกก่อนแล้วค่อยลบแถวหลัก (ไม่พึ่ง ON DELETE CASCADE ของ DB เพราะบางตารางอาจไม่ได้ตั้งไว้)
 * ถ้าลบไม่สำเร็จ จะแจ้ง error แล้วโหลดหน้าใหม่ให้เห็นสถานะจริง */

// ตารางไม่มีอยู่ (เช่น ลบ org_bill_file ทิ้งไปแล้ว) ถือว่าไม่มีอะไรให้ลบ
const isMissingTable = (code?: string) => code === '42P01' || code === 'PGRST205';

// ลบ 1 รายการบันทึกการปล่อยก๊าซ พร้อมรายละเอียด ข้อมูลสำนักงาน และบิลเก่าที่เคยแนบ (ระบบเดิม)
async function deleteActivity(id: string): Promise<string | null> {
  // บิลเก่าในระบบเดิม: ลบไฟล์ใน Storage ด้วย ไม่ให้เหลือไฟล์กำพร้า
  const bills = await supabase.from('org_bill_file').select('file_path').eq('orgactlist_id', id);
  const paths = (bills.data ?? []).map((b) => b.file_path as string).filter(Boolean);
  if (paths.length > 0) await supabase.storage.from('bills').remove(paths);

  for (const table of ['org_bill_file', 'org_office_info', 'org_activity_detail']) {
    const { error } = await supabase.from(table).delete().eq('orgactlist_id', id);
    if (error && !isMissingTable(error.code)) return dbErrorMessage(error);
  }
  const { data, error } = await supabase.from('org_activity_list').delete().eq('orgactlist_id', id).select('orgactlist_id');
  if (error) return dbErrorMessage(error);
  // RLS ไม่อนุญาตจะไม่ error แต่ลบได้ 0 แถว
  return data && data.length > 0 ? null : 'ไม่พบรายการ หรือไม่มีสิทธิ์ลบ';
}

// ลบ 1 โครงการ T-VER พร้อมรายละเอียดของโครงการ
async function deleteTreeProject(id: string): Promise<string | null> {
  const detail = await supabase.from('org_tree_project_detail').delete().eq('orgtreeproject_id', id);
  if (detail.error) return dbErrorMessage(detail.error);
  const { data, error } = await supabase.from('org_tree_project').delete().eq('orgtreeproject_id', id).select('orgtreeproject_id');
  if (error) return dbErrorMessage(error);
  return data && data.length > 0 ? null : 'ไม่พบโครงการ หรือไม่มีสิทธิ์ลบ';
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

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
  activities: initialActivities,
  treeProjects: initialTreeProjects,
}: {
  activities: OrgActivityLog[];
  treeProjects: OrgTreeProject[];
}) {
  const router = useRouter();
  // [เพิ่ม] เก็บใน state เพื่อเอารายการที่ลบออกจากหน้าได้ทันที (ตัวเลขสรุปด้านบนคำนวณใหม่ตาม)
  const [activities, setActivities] = useState(initialActivities);
  const [treeProjects, setTreeProjects] = useState(initialTreeProjects);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDeleteActivity(log: OrgActivityLog) {
    const msg = `ลบรายการ "${log.orgact_name ?? 'ไม่มีชื่อ'}"?\nรายละเอียดกิจกรรมและข้อมูลสำนักงานของรายการนี้จะถูกลบด้วย และกู้คืนไม่ได้`;
    // [แก้ไข] ใช้กล่องยืนยันกลาง (src/lib/dialog.ts) แทน confirm() ของเบราว์เซอร์
    if (!(await showConfirm(msg, { title: 'ลบบันทึกการปล่อยก๊าซ', danger: true }))) return;
    setDeleting(log.orgactlist_id);
    const err = await deleteActivity(log.orgactlist_id);
    setDeleting(null);
    if (err) {
      showError('ลบรายการไม่สำเร็จ: ' + err);
      router.refresh();
      return;
    }
    setActivities((prev) => prev.filter((a) => a.orgactlist_id !== log.orgactlist_id));
  }

  async function handleDeleteProject(p: OrgTreeProject) {
    if (!(await showConfirm(`ลบโครงการ "${p.project_name ?? 'ไม่มีชื่อ'}"?\nกู้คืนไม่ได้`, { title: 'ลบโครงการ T-VER', danger: true }))) return;
    setDeleting(p.orgtreeproject_id);
    const err = await deleteTreeProject(p.orgtreeproject_id);
    setDeleting(null);
    if (err) {
      showError('ลบโครงการไม่สำเร็จ: ' + err);
      router.refresh();
      return;
    }
    setTreeProjects((prev) => prev.filter((x) => x.orgtreeproject_id !== p.orgtreeproject_id));
  }
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
            {/* [แก้ไข] เดิม "กรอกข้อมูลใหม่ ›" */}
            + บันทึกข้อมูลฟุตพรินต์
          </Link>
        </div>

        {/* [แก้ไข] เดิมแสดงแค่ 3 รายการล่าสุด -> แสดงทุกรายการ ถ้ายาวเกินให้เลื่อนดูในกรอบ (scroll bar) */}
        <div className="scroll-list max-h-[320px] pr-2">
          {activities.length === 0 && (
            <p className="text-sm text-[#64748B] py-6 text-center">ยังไม่มีบันทึกการปล่อยก๊าซ</p>
          )}
          {activities.map((log, idx) => (
            <div
              key={log.orgactlist_id}
              className={`flex items-center gap-2 ${idx > 0 ? 'border-t border-[#F1F5F9]' : ''}`}
            >
              <Link
                href={`/organization/footprint/report/${log.orgactlist_id}`}
                className="flex flex-1 items-center justify-between py-5 hover:bg-[#F8FAFC] transition"
              >
                <div>
                  <h3 className="text-base font-bold text-[#1E293B]">{log.orgact_name}</h3>
                  <p className="text-xs text-[#64748B]">{formatThaiDate(log.created_at)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-base font-bold text-[#0F172A]">
                    {formatNumber(log.total_ghg_emission)} {log.unit ?? 'tCO2e'}
                  </p>
                  <span className="text-xs font-semibold text-[#64748B]">ดูรายงาน ›</span>
                </div>
              </Link>
              {/* [เพิ่ม] ปุ่มลบรายการ */}
              <button
                type="button"
                onClick={() => handleDeleteActivity(log)}
                disabled={deleting === log.orgactlist_id}
                aria-label={`ลบรายการ ${log.orgact_name ?? ''}`}
                title="ลบรายการ"
                className="rounded-lg p-2 text-[#94A3B8] hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <TrashIcon />
              </button>
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

        {/* [แก้ไข] รายการโครงการเยอะ ให้เลื่อนดูในกรอบ (scroll bar) */}
        <div className="scroll-list max-h-[360px] space-y-2 pl-3 pr-2">
          {treeProjects.length === 0 && (
            <p className="text-sm text-[#64748B] py-6 text-center">ยังไม่มีโครงการ T-VER</p>
          )}
          {treeProjects.map((p) => (
            <div key={p.orgtreeproject_id} className="flex items-start gap-2 border-b border-[#F8FAFC] last:border-b-0">
            <Link
              href={`/organization/tver-simulation/${p.orgtreeproject_id}`}
              className="block flex-1 space-y-4 rounded-lg p-3 -ml-3 hover:bg-[#F8FAFC] transition"
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
            {/* [เพิ่ม] ปุ่มลบโครงการ */}
            <button
              type="button"
              onClick={() => handleDeleteProject(p)}
              disabled={deleting === p.orgtreeproject_id}
              aria-label={`ลบโครงการ ${p.project_name ?? ''}`}
              title="ลบโครงการ"
              className="mt-3 rounded-lg p-2 text-[#94A3B8] hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <TrashIcon />
            </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}