'use client';

import { useState } from 'react';
import type { CarbonScope, Activity, ActivityDetail } from '@/types/activity-management';
import type { EmissionFactor, GwpValue } from '@/types/ef-gwp';
import { scopeSchema, activitySchema, detailSchema, type ScopeField, type ActivityField, type DetailField } from './schema';
import { ModalActions, ModalShell } from '@/components/Modal';
import { deleteRecord, insertRecord, updateRecord } from '@/lib/supabaseCrud';
import { validateForm, extendSchema, notDuplicate, existsIn, type formError } from '@/lib/validation';
import { normalizeToArabicNumber } from '@/lib/normalization';
import { fieldError as FieldError } from '@/components/FieldError';

/* [ปรับปรุง] สรุปสิ่งที่เปลี่ยนในไฟล์นี้
 * 1) เดิม validate แล้วเก็บ error ไว้ใน state แต่ "ไม่ได้แสดง" ใน modal -> เพิ่ม <FieldError> ใต้ทุกช่อง
 * 2) เอา required / type="number" ของ HTML ออก (ใส่ noValidate) ให้ผ่าน normalize + validate ของเราทั้งหมด
 *    (type="number" ทำให้พิมพ์เลขไทยไม่ได้ และ browser เด้งข้อความของตัวเองก่อน)
 * 3) ตรวจข้อมูลซ้ำตามเงื่อนไขของตาราง:
 *      - สโคป: หมายเลขสโคปห้ามซ้ำ และชื่อขอบเขตห้ามซ้ำ
 *      - กิจกรรม: ชื่อห้ามซ้ำ "ภายในสโคปเดียวกัน"
 *      - รายละเอียด: ชื่อห้ามซ้ำ "ภายในกิจกรรมเดียวกัน"
 * 4) ตรวจความสัมพันธ์: สโคป / กิจกรรม / EF / GWP ที่เลือกต้องมีอยู่จริง (existsIn)
 * 5) scope_number ใช้ normalizeToArabicNumber แทน Number() (Number('') = 0 และไม่รู้จักเลขไทย)
 * 6) เพิ่มการแก้ไขทั้ง 3 ตาราง โดยใช้ modal เดียวกับการเพิ่ม */

const scopeBadgeStyle: Record<number, string> = {
  1: 'bg-[#B8EED8] text-[#3C6E5C]',
  2: 'bg-[#CBF7FF] text-[#4842A1]',
  3: 'bg-[#FFE1C8] text-[#775B45]',
};

const inputCls = (hasError?: boolean) =>
  `w-full border rounded-lg px-3 py-2 text-sm ${hasError ? 'border-red-500' : ''}`;

const DETAIL_SELECT =
  '*, activity(activity_id, activity_name, scope_id, carbon_scope(scope_id, scope_name, scope_number)), emission_factor(ef_id, ef_name, ef_value, real_unit),global_warming_potential(gwp_id, gas_name, gwp_value)';

const emptyScopeForm = { scope_number: '', scope_name: '', scope_detail: '' };
const emptyActivityForm = { scope_id: '', activity_name: '' };
const emptyDetailForm = { activity_id: '', detail_name: '', unit: '', description: '', ef_id: '', gwp_id: '' };

export default function ActivityManagementClient({
  initialScopes,
  initialActivities,
  initialDetails,
  initialEfOptions,
  initialGwpOptions,
}: {
  initialScopes: CarbonScope[];
  initialActivities: Activity[];
  initialDetails: ActivityDetail[];
  initialEfOptions: EmissionFactor[];
  initialGwpOptions: GwpValue[];
}) {
  const [scopes, setScopes] = useState<CarbonScope[]>(initialScopes);
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [details, setDetails] = useState<ActivityDetail[]>(initialDetails);

  const [efOptions] = useState<EmissionFactor[]>(initialEfOptions);
  const [gwpOptions] = useState<GwpValue[]>(initialGwpOptions);

  const [scopeErrors, setScopeErrors] = useState<formError<ScopeField>>({});
  const [activityErrors, setActivityErrors] = useState<formError<ActivityField>>({});
  const [detailErrors, setDetailErrors] = useState<formError<DetailField>>({});

  const [showScopeModal, setShowScopeModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // [เพิ่ม] id ของแถวที่กำลังแก้ไข (null = เพิ่มใหม่)
  const [editScopeId, setEditScopeId] = useState<string | null>(null);
  const [editActivityId, setEditActivityId] = useState<string | null>(null);
  const [editDetailId, setEditDetailId] = useState<string | null>(null);

  const [scopeForm, setScopeForm] = useState(emptyScopeForm);
  const [activityForm, setActivityForm] = useState(emptyActivityForm);
  const [detailForm, setDetailForm] = useState(emptyDetailForm);

  // ---------- เปิด/ปิด modal (ไม่ส่ง row = เพิ่ม, ส่ง row = แก้ไข) ----------
  function openScopeModal(row?: CarbonScope) {
    setEditScopeId(row?.scope_id ?? null);
    setScopeForm(
      row
        ? {
            scope_number: row.scope_number == null ? '' : String(row.scope_number),
            scope_name: row.scope_name ?? '',
            scope_detail: row.scope_detail ?? '',
          }
        : emptyScopeForm
    );
    setScopeErrors({});
    setShowScopeModal(true);
  }
  function openActivityModal(row?: Activity) {
    setEditActivityId(row?.activity_id ?? null);
    setActivityForm(row ? { scope_id: row.scope_id ?? '', activity_name: row.activity_name ?? '' } : emptyActivityForm);
    setActivityErrors({});
    setShowActivityModal(true);
  }
  function openDetailModal(row?: ActivityDetail) {
    setEditDetailId(row?.scopedetail_id ?? null);
    setDetailForm(
      row
        ? {
            activity_id: row.activity_id ?? '',
            detail_name: row.detail_name ?? '',
            unit: row.unit ?? '',
            description: row.description ?? '',
            ef_id: row.ef_id ?? '',
            gwp_id: row.gwp_id ?? '',
          }
        : emptyDetailForm
    );
    setDetailErrors({});
    setShowDetailModal(true);
  }
  const closeScopeModal = () => { setShowScopeModal(false); setScopeErrors({}); };
  const closeActivityModal = () => { setShowActivityModal(false); setActivityErrors({}); };
  const closeDetailModal = () => { setShowDetailModal(false); setDetailErrors({}); };

  // ---------- ขอบเขต (scope) ----------
  async function handleSaveScope(e: React.FormEvent) {
    e.preventDefault();
    const others = scopes.filter((s) => s.scope_id !== editScopeId);
    const result = validateForm(
      scopeForm,
      extendSchema(scopeSchema, {
        // [เพิ่ม] ห้ามซ้ำ: เลข 1/2/3 มีได้อย่างละสโคปเดียว และชื่อห้ามซ้ำ
        scope_number: [notDuplicate('หมายเลขสโคป', others.map((s) => s.scope_number))],
        scope_name: [notDuplicate('ชื่อขอบเขต', others.map((s) => s.scope_name))],
      })
    );
    if (!result.ok) { setScopeErrors(result.errors); return; }
    setScopeErrors({});

    const values = {
      scope_number: normalizeToArabicNumber(result.clean.scope_number), // [แก้ไข] เดิมใช้ Number()
      scope_name: result.clean.scope_name,
      scope_detail: result.clean.scope_detail || null,   // ว่าง → null
    };

    if (editScopeId) {
      const updated = await updateRecord<CarbonScope>(
        'carbon_scope', 'scope_id', editScopeId,
        { ...values, updated_at: new Date().toISOString() }, '*', 'แก้ไขขอบเขต'
      );
      if (!updated) return;
      setScopes((prev) => prev.map((s) => (s.scope_id === editScopeId ? updated : s)));
      // ข้อมูลสโคปที่ join ไปกับกิจกรรม/รายละเอียดต้องเปลี่ยนตาม (เลขสโคปที่โชว์ในตาราง)
      setActivities((prev) => prev.map((a) => (a.scope_id === editScopeId ? { ...a, carbon_scope: updated } : a)));
      setDetails((prev) =>
        prev.map((d) =>
          d.activity && d.activity.scope_id === editScopeId
            ? { ...d, activity: { ...d.activity, carbon_scope: updated } }
            : d
        )
      );
    } else {
      const created = await insertRecord<CarbonScope>('carbon_scope', values, '*', 'เพิ่มขอบเขต');
      if (!created) return;
      setScopes((prev) => [...prev, created]);
    }
    closeScopeModal();
  }

  async function handleDeleteScope( id : string ){
    const ok = await deleteRecord(
      'carbon_scope',  // ชื่อตาราง
      'scope_id',
      id,
      'ลบขอบเขตนี้?'
    );
    if (!ok) return;
    setScopes((prev) => prev.filter((t) => t.scope_id !== id));
    setActivities((prev) =>
      prev.map((r) => (r.scope_id === id ? { ...r, scope_id: null } : r))
    );
  }

  // ---------- กิจกรรมแต่ละขอบเขต ----------
  async function handleSaveActivity(e: React.FormEvent) {
    e.preventDefault();
    // ชื่อกิจกรรมห้ามซ้ำภายในสโคปเดียวกัน
    const sameScopeNames = activities
      .filter((a) => a.activity_id !== editActivityId && a.scope_id === activityForm.scope_id)
      .map((a) => a.activity_name);
    const result = validateForm(
      activityForm,
      extendSchema(activitySchema, {
        scope_id: [existsIn('สโคป', scopes.map((s) => s.scope_id))], // ตรวจ Scope ที่มีอยู่จริง
        activity_name: [notDuplicate('ชื่อกิจกรรมในสโคปนี้', sameScopeNames)],
      })
    );
    if (!result.ok) { setActivityErrors(result.errors); return; }
    setActivityErrors({});

    const values = { scope_id: result.clean.scope_id, activity_name: result.clean.activity_name };
    const select = '*, carbon_scope(scope_id, scope_name, scope_number)';

    if (editActivityId) {
      const updated = await updateRecord<Activity>(
        'activity', 'activity_id', editActivityId,
        { ...values, updated_at: new Date().toISOString() }, select, 'แก้ไขกิจกรรม'
      );
      if (!updated) return;
      setActivities((prev) => prev.map((a) => (a.activity_id === editActivityId ? updated : a)));
      // ชื่อกิจกรรม/สโคปที่ join ไปกับรายละเอียดต้องเปลี่ยนตาม
      setDetails((prev) =>
        prev.map((d) =>
          d.activity_id === editActivityId
            ? {
                ...d,
                activity: {
                  activity_id: updated.activity_id,
                  activity_name: updated.activity_name,
                  scope_id: updated.scope_id,
                  carbon_scope: updated.carbon_scope,
                },
              }
            : d
        )
      );
    } else {
      const created = await insertRecord<Activity>('activity', values, select, 'เพิ่มกิจกรรม');
      if (!created) return;
      setActivities((prev) => [...prev, created]);
    }
    closeActivityModal();
  }

  async function handleDeleteActivity( id : string ){
    const ok = await deleteRecord(
      'activity',  // ชื่อตาราง
      'activity_id',
      id,
      'ลบกิจกรรมนี้?'
    );
    if (!ok) return;
    setActivities((prev) => prev.filter((t) => t.activity_id !== id));
    setDetails((prev) =>
      prev.map((r) => (r.activity_id === id ? { ...r, activity_id: null } : r))
    );
  }

  // ---------- รายละเอียดในแต่ละกิจกรรม ----------
  async function handleSaveDetail(e: React.FormEvent) {
    e.preventDefault();
    // ชื่อรายละเอียดห้ามซ้ำภายในกิจกรรมเดียวกัน
    const sameActivityNames = details
      .filter((d) => d.scopedetail_id !== editDetailId && d.activity_id === detailForm.activity_id)
      .map((d) => d.detail_name);
    const result = validateForm(
      detailForm,
      extendSchema(detailSchema, {
        activity_id: [existsIn('กิจกรรม', activities.map((a) => a.activity_id))],
        detail_name: [notDuplicate('ชื่อรายละเอียดในกิจกรรมนี้', sameActivityNames)],
        ef_id: [existsIn('ค่า EF', efOptions.map((o) => o.ef_id))],
        gwp_id: [existsIn('ค่า GWP', gwpOptions.map((o) => o.gwp_id))],
      })
    );
    if (!result.ok) { setDetailErrors(result.errors); return; }
    setDetailErrors({});

    const values = {
      activity_id: result.clean.activity_id,
      detail_name: result.clean.detail_name,
      unit: result.clean.unit,
      description: result.clean.description || null,
      ef_id: result.clean.ef_id || null,
      gwp_id: result.clean.gwp_id || null,
    };

    if (editDetailId) {
      const updated = await updateRecord<ActivityDetail>(
        'activity_detail', 'scopedetail_id', editDetailId,
        { ...values, updated_at: new Date().toISOString() }, DETAIL_SELECT, 'แก้ไขรายการนี้'
      );
      if (!updated) return;
      setDetails((prev) => prev.map((d) => (d.scopedetail_id === editDetailId ? updated : d)));
    } else {
      const created = await insertRecord<ActivityDetail>('activity_detail', values, DETAIL_SELECT, 'เพิ่มรายการนี้');
      if (!created) return;
      setDetails((prev) => [...prev, created]);
    }
    closeDetailModal();
  }

  async function handleDeleteDetail( id : string ){
    const ok = await deleteRecord(
      'activity_detail',  // ชื่อตาราง
      'scopedetail_id',
      id,
      'ลบรายการนี้?'
    );
    if (!ok) return;
    setDetails((prev) => prev.filter((t) => t.scopedetail_id !== id));
  }

  const activitiesByScope = scopes
    .slice()
    .sort((a, b) => (a.scope_number ?? 0) - (b.scope_number ?? 0))
    .map((scope) => ({
      scope,
      items: activities.filter((a) => a.scope_id === scope.scope_id),
    }));

  return (
    <div className="max-w-[1280px] px-8 pt-16 pb-16 space-y-12">
      <div>
        <h1 className="text-[32px] font-bold leading-10 text-[#191C1C] font-['Be_Vietnam_Pro']">
          ขอบเขต &amp; กิจกรรมคาร์บอน (Scopes &amp; Activity Management)
        </h1>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#266955]" />
            <h2 className="text-xl font-bold text-[#191C1C] font-['Be_Vietnam_Pro']">
              ขอบเขตคาร์บอน 3 สโคป (Carbon Scopes Configuration)
            </h2>
          </div>
          <button
            onClick={() => openScopeModal()}
            className="flex items-center gap-1.5 rounded-lg bg-[#266955] px-3 py-2 text-sm text-white shadow-sm"
          >
            + เพิ่มขอบเขต
          </button>
        </div>

        <div className="flex gap-6">
          {scopes
            .slice()
            .sort((a, b) => (a.scope_number ?? 0) - (b.scope_number ?? 0))
            .map((scope) => (
              <div
                key={scope.scope_id}
                className="flex-1 rounded-xl bg-white shadow-sm flex flex-col justify-between p-6 min-h-[295px]"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        scopeBadgeStyle[scope.scope_number ?? 1] ?? scopeBadgeStyle[1]
                      }`}
                    >
                      Scope {scope.scope_number}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#191C1C] font-['Be_Vietnam_Pro']">
                    {scope.scope_name}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#3F4944] font-['Be_Vietnam_Pro'] whitespace-pre-line">
                    {scope.scope_detail ?? ''}
                  </p>
                </div>
                <div className="flex justify-end gap-2 items-center bg-[#F3F4F4] -mx-6 -mb-6 px-6 py-3 rounded-b-xl mt-4">
                  <button
                    onClick={() => openScopeModal(scope)}
                    className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm text-[#266955] shadow-sm"
                  >
                    ✏️ แก้ไข
                  </button>
                  <button
                    onClick={() => handleDeleteScope(scope.scope_id)}
                    className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm text-[#266955] shadow-sm"
                  >
                    🗑️ ลบขอบเขต
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#266955]" />
            <h2 className="text-xl font-bold text-[#191C1C] font-['Be_Vietnam_Pro']">
              กิจกรรมที่ต้องการจากสำนักงาน (Office Required Activities)
            </h2>
          </div>
          <button
            onClick={() => openActivityModal()}
            className="flex items-center gap-1.5 rounded-lg bg-[#266955] px-3 py-2 text-sm text-white shadow-sm"
          >
            + เพิ่มกิจกรรม
          </button>
        </div>

        <div className="flex gap-6">
          {activitiesByScope.map(({ scope, items }) => (
            <div key={scope.scope_id} className="flex-1 rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 bg-[#F3F4F4] px-6 py-3">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    scopeBadgeStyle[scope.scope_number ?? 1] ?? scopeBadgeStyle[1]
                  }`}
                >
                  Scope {scope.scope_number}
                </span>
                <span className="text-[#191C1C]">{scope.scope_name}</span>
                <span className="ml-auto text-xs font-bold text-[#6F7974]">
                  {items.length} รายการ
                </span>
              </div>
              <div className="p-3 space-y-2">
                {items.map((a) => (
                  <div
                    key={a.activity_id}
                    className="flex items-center justify-between bg-[#F8F9F9] rounded-lg px-3 py-3"
                  >
                    <span className="text-sm text-[#191C1C]">{a.activity_name}</span>
                    <span className="flex gap-2">
                      <button
                        onClick={() => openActivityModal(a)}
                        className="text-[#3F4944] hover:text-[#266955]"
                        title="แก้ไข"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteActivity(a.activity_id)}
                        className="text-[#3F4944] hover:text-red-500"
                        title="ลบ"
                      >
                        🗑️
                      </button>
                    </span>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-sm text-[#6F7974] px-3 py-2">ยังไม่มีกิจกรรมในสโคปนี้</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-white shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2.5 rounded-full bg-[#266955]" />
            <h2 className="text-xl font-bold text-[#191C1C] font-['Be_Vietnam_Pro']">
              รายละเอียดกิจกรรม (Activity Details)
            </h2>
          </div>
          <button
            onClick={() => openDetailModal()}
            className="flex items-center gap-1.5 rounded-lg bg-[#266955] px-3 py-2 text-sm text-white shadow-sm"
          >
            + เพิ่มรายละเอียด
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F3F4F4]">
              <tr className="text-xs font-bold uppercase tracking-wide text-[#3F4944]">
                <th className="px-4 py-3 text-left rounded-l-lg">สโคป</th>
                <th className="px-4 py-3 text-left">กิจกรรมที่ต้องการจากสำนักงาน</th>
                <th className="px-4 py-3 text-left">ชื่อรายละเอียดที่บันทึก</th>
                <th className="px-4 py-3 text-center">หน่วย</th>
                <th className="px-4 py-3 text-center">ค่า EF</th>
                <th className="px-4 py-3 text-left">ค่า GWP</th>
                <th className="px-4 py-3 text-left">รายละเอียด</th>
                <th className="px-4 py-3 text-right rounded-r-lg">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d) => {
                const scopeNum = d.activity?.carbon_scope?.scope_number ?? 1;
                return (
                  <tr key={d.scopedetail_id} className="border-t border-[#F1F5F9]">
                    <td className="px-4 py-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded text-xs font-semibold ${
                          scopeBadgeStyle[scopeNum] ?? scopeBadgeStyle[1]
                        }`}
                      >
                        {scopeNum}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[#191C1C]">{d.activity?.activity_name}</td>
                    <td className="px-4 py-4 text-[#191C1C]">{d.detail_name}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-[#EDEEEE] text-xs font-bold text-[#6F7974]">
                        {d.unit}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center font-mono text-[#266955]">
                      {d.emission_factor?.ef_value ?? '-'}
                    </td>
                    <td className="px-4 py-4 text-[#3F4944]">
                      {d.global_warming_potential?.gwp_value ?? '-'}
                    </td>
                    <td className="px-4 py-4 text-[#3F4944] max-w-[320px] whitespace-pre-line">{d.description}</td>
                    <td className="px-4 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => openDetailModal(d)}
                        className="text-[#3F4944] hover:text-[#266955]"
                        title="แก้ไข"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteDetail(d.scopedetail_id)}
                        className="text-[#3F4944] hover:text-red-500"
                        title="ลบ"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showScopeModal && (
        <ModalShell onClose={closeScopeModal}>
          <form onSubmit={handleSaveScope} className="space-y-4" noValidate>
            <h3 className="text-lg font-bold">{editScopeId ? 'แก้ไขขอบเขต' : 'เพิ่มขอบเขตใหม่'}</h3>
            <div>
              <input
                className={inputCls(!!scopeErrors.scope_number)}
                placeholder="หมายเลขสโคป เช่น 1, 2, 3"
                type="text"
                inputMode="numeric"
                value={scopeForm.scope_number}
                onChange={(e) => setScopeForm({ ...scopeForm, scope_number: e.target.value })}
              />
              <FieldError message={scopeErrors.scope_number} />
            </div>
            <div>
              <input
                className={inputCls(!!scopeErrors.scope_name)}
                placeholder="ชื่อขอบเขต เช่น Direct Emissions"
                maxLength={150}
                value={scopeForm.scope_name}
                onChange={(e) => setScopeForm({ ...scopeForm, scope_name: e.target.value })}
              />
              <FieldError message={scopeErrors.scope_name} />
            </div>
            <div>
              <textarea
                className={inputCls(!!scopeErrors.scope_detail)}
                placeholder="คำอธิบายขอบเขต เช่น Direct GHG emissions from sources owned or controlled by your company..."
                rows={3}
                maxLength={1000}
                value={scopeForm.scope_detail}
                onChange={(e) => setScopeForm({ ...scopeForm, scope_detail: e.target.value })}
              />
              <FieldError message={scopeErrors.scope_detail} />
            </div>
            <ModalActions onCancel={closeScopeModal} />
          </form>
        </ModalShell>
      )}

      {showActivityModal && (
        <ModalShell onClose={closeActivityModal}>
          <form onSubmit={handleSaveActivity} className="space-y-4" noValidate>
            <h3 className="text-lg font-bold">{editActivityId ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรมใหม่'}</h3>
            <div>
              <select
                className={inputCls(!!activityErrors.scope_id)}
                value={activityForm.scope_id}
                onChange={(e) => setActivityForm({ ...activityForm, scope_id: e.target.value })}
              >
                <option value="">เลือกขอบเขต (Scope)</option>
                {scopes.map((s) => (
                  <option key={s.scope_id} value={s.scope_id}>
                    Scope {s.scope_number} — {s.scope_name}
                  </option>
                ))}
              </select>
              <FieldError message={activityErrors.scope_id} />
            </div>
            <div>
              <input
                className={inputCls(!!activityErrors.activity_name)}
                placeholder="ชื่อกิจกรรม เช่น การใช้น้ำมันเชื้อเพลิงยานพาหนะ"
                maxLength={150}
                value={activityForm.activity_name}
                onChange={(e) => setActivityForm({ ...activityForm, activity_name: e.target.value })}
              />
              <FieldError message={activityErrors.activity_name} />
            </div>
            <ModalActions onCancel={closeActivityModal} />
          </form>
        </ModalShell>
      )}

      {showDetailModal && (
        <ModalShell onClose={closeDetailModal}>
          <form onSubmit={handleSaveDetail} className="space-y-4 max-h-[80vh] overflow-y-auto" noValidate>
            <h3 className="text-lg font-bold">{editDetailId ? 'แก้ไขรายละเอียดกิจกรรม' : 'เพิ่มรายละเอียดกิจกรรม'}</h3>
            <div>
              <select
                className={inputCls(!!detailErrors.activity_id)}
                value={detailForm.activity_id}
                onChange={(e) => setDetailForm({ ...detailForm, activity_id: e.target.value })}
              >
                <option value="">เลือกกิจกรรม</option>
                {activities.map((a) => (
                  <option key={a.activity_id} value={a.activity_id}>
                    {a.activity_name}
                  </option>
                ))}
              </select>
              <FieldError message={detailErrors.activity_id} />
            </div>
            <div>
              <input
                className={inputCls(!!detailErrors.detail_name)}
                placeholder="ชื่อรายละเอียดที่บันทึก เช่น น้ำมันดีเซล B7"
                maxLength={150}
                value={detailForm.detail_name}
                onChange={(e) => setDetailForm({ ...detailForm, detail_name: e.target.value })}
              />
              <FieldError message={detailErrors.detail_name} />
            </div>
            <div>
              <input
                className={inputCls(!!detailErrors.unit)}
                // [แก้ไข] ตัวอย่างเดิมมี "ลิตร" แต่ข้อกำหนดของหน้านี้คือหน่วยเป็นภาษาอังกฤษ
                placeholder="หน่วย (ภาษาอังกฤษ) เช่น Litre, kWh, kg, km"
                maxLength={50}
                value={detailForm.unit}
                onChange={(e) => setDetailForm({ ...detailForm, unit: e.target.value })}
              />
              <FieldError message={detailErrors.unit} />
            </div>
            <div>
              <select
                className={inputCls(!!detailErrors.ef_id)}
                value={detailForm.ef_id}
                onChange={(e) => setDetailForm({ ...detailForm, ef_id: e.target.value })}
              >
                <option value="">เลือกค่า EF (ไม่บังคับ)</option>
                {efOptions.map((ef) => (
                  <option key={ef.ef_id} value={ef.ef_id}>
                    {ef.ef_name} ({ef.ef_value} {ef.real_unit})
                  </option>
                ))}
              </select>
              <FieldError message={detailErrors.ef_id} />
            </div>
            <div>
              <select
                className={inputCls(!!detailErrors.gwp_id)}
                value={detailForm.gwp_id}
                onChange={(e) => setDetailForm({ ...detailForm, gwp_id: e.target.value })}
              >
                <option value="">เลือกค่า GWP (ไม่บังคับ)</option>
                {gwpOptions.map((g) => (
                  <option key={g.gwp_id} value={g.gwp_id}>
                    {g.gas_name} ({g.gwp_value})
                  </option>
                ))}
              </select>
              <FieldError message={detailErrors.gwp_id} />
            </div>
            <div>
              <textarea
                className={inputCls(!!detailErrors.description)}
                placeholder="รายละเอียดวิธีบันทึกข้อมูล"
                rows={2}
                maxLength={1000}
                value={detailForm.description}
                onChange={(e) => setDetailForm({ ...detailForm, description: e.target.value })}
              />
              <FieldError message={detailErrors.description} />
            </div>
            <ModalActions onCancel={closeDetailModal} />
          </form>
        </ModalShell>
      )}
    </div>
  );
}
