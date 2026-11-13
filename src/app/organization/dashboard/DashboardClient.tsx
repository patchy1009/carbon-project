// หน้า Dashboard ขององค์กร: แสดงยอดรวม รายการบันทึกการปล่อยก๊าซ และโครงการจำลอง T-VER
'use client';

import { useState } from 'react'; // React state สำหรับรายการบันทึกและโครงการที่ดึงมาจาก server
import Link from 'next/link'; // ลิงก์ไปหน้ารายละเอียดและแก้ไขโครงการ
import { useRouter } from 'next/navigation'; // router.refresh() โหลดข้อมูลใหม่จาก server
import { supabase } from '@/lib/supabaseClient'; // client ของ Supabase ฝั่ง client
import { dbErrorMessage } from '@/lib/supabaseCrud'; // แปลง error ของ Supabase เป็นข้อความภาษาไทย
import { showConfirm, showError } from '@/lib/dialog'; // กล่องยืนยันและแจ้ง error
import type { OrgActivityLog, OrgTreeProject } from '@/types/dashboard'; // TypeScript type ของข้อมูลที่ดึงมาจาก server
import { TVER_AREA_NAME, TVER_TREE_COUNT_NAME } from '@/types/tver-project'; // ชื่อเงื่อนไขของโครงการ T-VER
import { TrashIcon } from '@/components/icons'; // ไอคอนถังขยะ
import { formatNumber, formatThaiDate } from '@/lib/format'; // ฟังก์ชันจัดรูปแบบตัวเลขและวันที่


// ลบ 1 รายการบันทึกการปล่อยก๊าซ พร้อมรายละเอียดและข้อมูลสำนักงาน
async function deleteActivity(id: string): Promise<string | null> {
  //   ไล่ลบดตารางย่อยก่อน (org_activity_detail, org_office_info, org_credit_allocation_detail) แล้วค่อยลบตัวรายการหลัก (org_activity_list)
  for (const table of ['org_credit_allocation_detail', 'org_office_info', 'org_activity_detail']) {
    const { error } = await supabase.from(table).delete().eq('orgactlist_id', id);
    if (error) return dbErrorMessage(error);
  }
  const { data, error } = await supabase.from('org_activity_list').delete().eq('orgactlist_id', id).select('orgactlist_id');
  if (error) return dbErrorMessage(error);
  // RLS ไม่อนุญาตจะไม่ error แต่ลบได้ 0 แถว
  return data && data.length > 0 ? null : 'ไม่พบรายการ หรือไม่มีสิทธิ์ลบ';
}

// ลบ 1 โครงการ T-VER พร้อมรายละเอียดของโครงการ
async function deleteTreeProject(id: string): Promise<string | null> {
  // ลบ allocation ก่อน เพราะตาราง allocation อ้างถึง orgtreeproject_id ถ้าไม่ลบก่อน การลบโครงการจะติด foreign key
  const { data: allocs, error: allocErr } = await supabase
    .from('org_credit_allocation')
    .select('orgallocate_id')
    .eq('orgtreeproject_id', id);
  if (allocErr) return dbErrorMessage(allocErr);
  const allocIds = (allocs ?? []).map((a: { orgallocate_id: string }) => a.orgallocate_id);
  if (allocIds.length > 0) {
    const allocDetail = await supabase.from('org_credit_allocation_detail').delete().in('orgallocate_id', allocIds);
    if (allocDetail.error) return dbErrorMessage(allocDetail.error);
    const alloc = await supabase.from('org_credit_allocation').delete().in('orgallocate_id', allocIds);
    if (alloc.error) return dbErrorMessage(alloc.error);
  }
  // ลบรายละเอียดโครงการ แล้วค่อยลบตัวโครงการ
  const detail = await supabase.from('org_tree_project_detail').delete().eq('orgtreeproject_id', id);
  if (detail.error) return dbErrorMessage(detail.error);
  const { data, error } = await supabase.from('org_tree_project').delete().eq('orgtreeproject_id', id).select('orgtreeproject_id');
  if (error) return dbErrorMessage(error);
  return data && data.length > 0 ? null : 'ไม่พบโครงการ หรือไม่มีสิทธิ์ลบ';
}

// ช่วงเวลาที่ผู้ใช้กรอก เช่น "มีนาคม 2569" หรือ "ปี 2569" (รายการที่ไม่มีช่วงเวลาแสดงวันที่สร้างแทน)
function periodText(log: OrgActivityLog): string {
  if (!log.period_date) return formatThaiDate(log.created_at);
  const date = new Date(log.period_date);
  if (log.period_type === 'year') return `ปี ${date.getUTCFullYear() + 543}`;
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

// เครดิตรวมของโครงการเดียว
// เอาเครดิตปีที่ 3 มาใช้ 
function sumCredits(p: OrgTreeProject): number {
  return p.credit_year_3 ?? 0;
}

// รวมเครดิตของหลายโครงการ
function sumProjectCredits(projects: OrgTreeProject[]): number {
  let total = 0;
  for (const p of projects) {
    total += sumCredits(p);
  }
  return total;
}

// ค่าที่องค์กรกรอก หาจากชื่อเงื่อนไขแบบตรงทุกตัวอักษร
// ไม่พบ (แอดมินลบหรือเปลี่ยนชื่อเงื่อนไข) = null แล้วหน้าเว็บจะเว้นว่างไว้
function detailAmount(p: OrgTreeProject, name: string): number | null {
  const detail = p.org_tree_project_detail?.find((d) => d.tver_project_detail?.detail_name === name);
  return detail?.amount ?? null;
}

// ข้อความใต้ชื่อโครงการ ข้อมูลไหนไม่มีก็ไม่แสดง
function projectSummary(p: OrgTreeProject): string {
  const area = detailAmount(p, TVER_AREA_NAME);
  const trees = detailAmount(p, TVER_TREE_COUNT_NAME);
  return [
    area !== null ? `${formatNumber(area)} ไร่` : null,
    trees !== null ? `${formatNumber(trees)} ต้น` : null,
    p.join_date ? `เข้าร่วมปี พ.ศ. ${Number(p.join_date.slice(0, 4)) + 543}` : 'ไม่ระบุปี',
  ] 
    .filter(Boolean)
    .join(' • ');
}

// วันที่เข้าร่วมยังไม่ถึงเมื่อเทียบกับวันนี้ = วางแผนการดำเนินการ ถึงวันแล้ว = ดำเนินการอยู่
// คำนวณใหม่ทุกครั้งที่เปิดหน้า ถ้าผู้ใช้แก้วันที่เป็นอนาคต สถานะก็กลับเป็นวางแผนได้
function isPlanned(p: OrgTreeProject): boolean {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
  return p.join_date != null && p.join_date > today; 
}

// หน้าจอหลัก รับข้อมูลจาก page.tsx แล้วเก็บใน state เพื่อให้รายการที่ลบหายจากหน้าทันที
export default function DashboardClient({
  activities: initialActivities,
  treeProjects: initialTreeProjects,
}: {
  activities: OrgActivityLog[];
  treeProjects: OrgTreeProject[];
}) {
  const router = useRouter();
  // เก็บใน state เพื่อเอารายการที่ลบออกจากหน้าได้ทันที (ตัวเลขสรุปด้านบนคำนวณใหม่ตาม)
  const [activities, setActivities] = useState(initialActivities);
  const [treeProjects, setTreeProjects] = useState(initialTreeProjects);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ถามยืนยันแล้วลบรายการบันทึกการปล่อยก๊าซ สำเร็จแล้วเอาออกจากหน้า
  async function handleDeleteActivity(log: OrgActivityLog) {
    const msg = `ลบรายการ "${log.orgact_name ?? 'ไม่มีชื่อ'}"?\nรายละเอียดกิจกรรมและข้อมูลสำนักงานของรายการนี้จะถูกลบด้วย และกู้คืนไม่ได้`;
    // ใช้กล่องยืนยันกลาง (src/lib/dialog.ts) 
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
  

  // ถามยืนยันแล้วลบโครงการ T-VER สำเร็จแล้วเอาออกจากหน้า
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

  // แยกเครดิตตามสถานะโครงการ และรวมทั้งสองสถานะเป็นยอดรวม
  const plannedProjects = treeProjects.filter(isPlanned);
  const activeProjects = treeProjects.filter((p) => !isPlanned(p));
  const plannedCredits = sumProjectCredits(plannedProjects);
  const activeCredits = sumProjectCredits(activeProjects);
  const totalCredits = activeCredits + plannedCredits;

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
          </div>
        </div>

        {/* Metric: Active T-VER Credits */}
        {/* รายงานเครดิตรวม */}
        <div className="bg-white border-2 border-[#DAE2EA] shadow-sm rounded-xl p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-stretch sm:gap-0">
            <div className="space-y-3 sm:w-[260px] sm:shrink-0">
              <p className="text-sm font-bold text-[#64748B]">เครดิต T-VER รวม</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[36px] font-bold text-[#0F172A]">
                  {formatNumber(totalCredits)}
                </span>
                <span className="text-base font-bold text-[#64748B]">
                  tCO<sub>2</sub>e
                </span>
              </div>
              <p className="text-sm text-[#64748B]">จาก {treeProjects.length} โครงการ</p>
            </div>

            <div className="flex flex-col justify-center gap-5 border-t border-[#DAE2EA] pt-6 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
              <div>
                <p className="text-sm text-[#64748B]">เครดิตจากโครงการที่ดำเนินการอยู่</p>
                <p className="mt-0.5 text-lg font-bold text-[#32885F]">
                  {formatNumber(activeCredits)}{' '}
                  <span className="text-sm font-medium text-[#64748B]">
                    tCO<sub>2</sub>e · {activeProjects.length} โครงการ
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-[#64748B]">เครดิตจากโครงการที่วางแผนไว้</p>
                <p className="mt-0.5 text-lg font-bold text-[#B45309]">
                  {formatNumber(plannedCredits)}{' '}
                  <span className="text-sm font-medium text-[#64748B]">
                    tCO<sub>2</sub>e · {plannedProjects.length} โครงการ
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Carbon footprint Section */}
      <div className="bg-white border-2 border-[#DAE2EA] shadow-sm rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0F172A]">
            บันทึกการปล่อยก๊าซเรือนกระจกขององค์กร
          </h2>
          <Link
            href="/organization/footprint/office_info"
            className="btn btn-create flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-semibold"
          >
            + บันทึกข้อมูลฟุตพรินต์
          </Link>
        </div>

        {/* แสดงทุกรายการ ถ้ายาวเกินใช้ scroll bar */}
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
                href={`/organization/footprint/report?id=${log.orgactlist_id}`}
                className="flex flex-1 items-center justify-between py-5 hover:bg-[#F8FAFC] transition"
              >
                <div>
                  <h3 className="text-base font-bold text-[#1E293B]">{log.orgact_name}</h3>
                  <p className="text-xs text-[#64748B]">{periodText(log)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-base font-bold text-[#0F172A]">
                    {formatNumber(log.total_ghg_emission)} {log.unit ?? 'tCO2e'}
                  </p>
                  <span className="text-xs font-semibold text-[#64748B]">ดูรายงาน ›</span>
                </div>
              </Link>
              {/* ปุ่มลบรายการ */}
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
            className="btn btn-create flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-semibold"
          >
            + จำลองโครงการใหม่
          </Link>
        </div>

        {/* รายการโครงการเยอะ ให้เลื่อนดูในกรอบ scroll bar */}
        <div className="scroll-list max-h-[360px] space-y-2 pl-3 pr-2">
          {treeProjects.length === 0 && (
            <p className="text-sm text-[#64748B] py-6 text-center">ยังไม่มีโครงการ T-VER</p>
          )}
          {treeProjects.map((p) => (
            <div key={p.orgtreeproject_id} className="flex items-start gap-2 border-b border-[#F8FAFC] last:border-b-0">
            <Link
              href={`/organization/tver-simulation?edit=${p.orgtreeproject_id}`}
              className="block flex-1 space-y-4 rounded-lg p-3 -ml-3 hover:bg-[#F8FAFC] transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#1E293B]">{p.project_name}</h3>
                  <p className="text-xs text-[#64748B]">
                    {/* แสดงจำนวนไร่รวมและจำนวนต้นไม้แทนชื่อพันธุ์ไม้ */}
                    {projectSummary(p)}
                  </p>
                </div>
                {/* สถานะมี 2 แบบ ตามวันที่เข้าร่วมโครงการ */}
                {isPlanned(p) ? (
                  <span className="px-3 py-1 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[11px] font-bold text-[#B45309]">
                    วางแผนการดำเนินการ
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-[#F0FDF4] border border-[#DCFCE7] text-[11px] font-bold text-[#16A34A]">
                    ดำเนินการอยู่
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-4">
                  <p className="text-xs text-[#16A34A]">เครดิตสะสม</p>
                  <p className="text-base font-bold text-[#16A34A]">
                    {formatNumber(sumCredits(p))} tCO<sub>2</sub>e
                  </p>
                  <span className="text-xs font-semibold text-[#64748B]">
                    ดูรายละเอียด/แก้ไข ›
                  </span>
                </div>
              </div>
            </Link>
            {/* ปุ่มลบโครงการ */}
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