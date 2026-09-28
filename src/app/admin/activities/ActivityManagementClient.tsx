'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { CarbonScope, Activity, ActivityDetail } from '@/types/activity-management';
import type { EmissionFactor, GwpValue } from '@/types/ef-gwp';

const scopeBadgeStyle: Record<number, string> = {
  1: 'bg-[#B8EED8] text-[#3C6E5C]',
  2: 'bg-[#CBF7FF] text-[#4842A1]',
  3: 'bg-[#FFE1C8] text-[#775B45]',
};

export default function ActivityManagementClient({
  initialScopes,
  initialActivities,
  initialDetails,
}: {
  initialScopes: CarbonScope[];
  initialActivities: Activity[];
  initialDetails: ActivityDetail[];
}) {
  const [scopes, setScopes] = useState<CarbonScope[]>(initialScopes);
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [details, setDetails] = useState<ActivityDetail[]>(initialDetails);

  const [efOptions, setEfOptions] = useState<EmissionFactor[]>([]);
  const [gwpOptions, setGwpOptions] = useState<GwpValue[]>([]);

  const [showScopeModal, setShowScopeModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [scopeForm, setScopeForm] = useState({ scope_number: '', scope_name: '', scope_detail: '' });
  const [activityForm, setActivityForm] = useState({ scope_id: '', activity_name: '' });
  const [detailForm, setDetailForm] = useState({
    activity_id: '',
    detail_name: '',
    unit: '',
    description: '',
    ef_id: '',
    gwp_id: '',
  });

  async function openDetailModal() {
    if (efOptions.length === 0) {
      const { data } = await supabase.from('emission_factor').select('*');
      setEfOptions((data ?? []) as EmissionFactor[]);
    }
    if (gwpOptions.length === 0) {
      const { data } = await supabase.from('global_warming_potential').select('*');
      setGwpOptions((data ?? []) as GwpValue[]);
    }
    setShowDetailModal(true);
  }

  async function handleAddScope(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('carbon_scope')
      .insert({
        scope_number: Number(scopeForm.scope_number),
        scope_name: scopeForm.scope_name,
        scope_detail: scopeForm.scope_detail,
      })
      .select()
      .single();
    if (error) return alert('เพิ่มขอบเขตไม่สำเร็จ: ' + error.message);
    setScopes((prev) => [...prev, data as CarbonScope]);
    setShowScopeModal(false);
    setScopeForm({ scope_number: '', scope_name: '', scope_detail: '' });
  }

  async function handleDeleteScope(id: string) {
    if (!confirm('ลบขอบเขตนี้? (กิจกรรมที่ผูกอยู่จะถูก unlink)')) return;
    const { error } = await supabase.from('carbon_scope').delete().eq('scope_id', id);
    if (error) return alert('ลบไม่สำเร็จ: ' + error.message);
    setScopes((prev) => prev.filter((s) => s.scope_id !== id));
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('activity')
      .insert({
        scope_id: activityForm.scope_id || null,
        activity_name: activityForm.activity_name,
      })
      .select('*, carbon_scope(scope_id, scope_name, scope_number)')
      .single();
    if (error) return alert('เพิ่มกิจกรรมไม่สำเร็จ: ' + error.message);
    setActivities((prev) => [...prev, data as Activity]);
    setShowActivityModal(false);
    setActivityForm({ scope_id: '', activity_name: '' });
  }

  async function handleDeleteActivity(id: string) {
    if (!confirm('ลบกิจกรรมนี้?')) return;
    const { error } = await supabase.from('activity').delete().eq('activity_id', id);
    if (error) return alert('ลบไม่สำเร็จ: ' + error.message);
    setActivities((prev) => prev.filter((a) => a.activity_id !== id));
  }

  async function handleAddDetail(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('activity_detail')
      .insert({
        activity_id: detailForm.activity_id || null,
        detail_name: detailForm.detail_name,
        unit: detailForm.unit,
        description: detailForm.description,
        ef_id: detailForm.ef_id || null,
        gwp_id: detailForm.gwp_id || null,
      })
      .select(
        `*,
        activity(activity_id, activity_name, scope_id, carbon_scope(scope_id, scope_name, scope_number)),
        emission_factor(ef_id, ef_name, ef_value, real_unit),
        global_warming_potential(gwp_id, gas_name, gwp_value)`
      )
      .single();
    if (error) return alert('เพิ่มรายละเอียดไม่สำเร็จ: ' + error.message);
    setDetails((prev) => [...prev, data as ActivityDetail]);
    setShowDetailModal(false);
    setDetailForm({
      activity_id: '',
      detail_name: '',
      unit: '',
      description: '',
      ef_id: '',
      gwp_id: '',
    });
  }

  async function handleDeleteDetail(id: string) {
    if (!confirm('ลบรายละเอียดนี้?')) return;
    const { error } = await supabase.from('activity_detail').delete().eq('scopedetail_id', id);
    if (error) return alert('ลบไม่สำเร็จ: ' + error.message);
    setDetails((prev) => prev.filter((d) => d.scopedetail_id !== id));
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
            onClick={() => setShowScopeModal(true)}
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
                  <p className="text-sm leading-relaxed text-[#3F4944] font-['Be_Vietnam_Pro']">
                    {scope.scope_detail ?? ''}
                  </p>
                </div>
                <div className="flex justify-between items-center bg-[#F3F4F4] -mx-6 -mb-6 px-6 py-3 rounded-b-xl mt-4">
                  <span />
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
            onClick={() => setShowActivityModal(true)}
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
                    <button
                      onClick={() => handleDeleteActivity(a.activity_id)}
                      className="text-[#3F4944] hover:text-red-500"
                    >
                      🗑️
                    </button>
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
            onClick={openDetailModal}
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
                    <td className="px-4 py-4 text-[#3F4944] max-w-[320px]">{d.description}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleDeleteDetail(d.scopedetail_id)}
                        className="text-[#3F4944] hover:text-red-500"
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
        <ModalShell onClose={() => setShowScopeModal(false)}>
          <form onSubmit={handleAddScope} className="space-y-4">
            <h3 className="text-lg font-bold">เพิ่มขอบเขตใหม่</h3>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="หมายเลขสโคป เช่น 1, 2, 3"
              type="number"
              value={scopeForm.scope_number}
              onChange={(e) => setScopeForm({ ...scopeForm, scope_number: e.target.value })}
              required
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="ชื่อขอบเขต เช่น Direct Emissions"
              value={scopeForm.scope_name}
              onChange={(e) => setScopeForm({ ...scopeForm, scope_name: e.target.value })}
              required
            />
            <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="คำอธิบายขอบเขต เช่น Direct GHG emissions from sources owned or controlled by your company..."
                rows={3}
                value={scopeForm.scope_detail}
                onChange={(e) => setScopeForm({ ...scopeForm, scope_detail: e.target.value })}
            />
            <ModalActions onCancel={() => setShowScopeModal(false)} />
          </form>
        </ModalShell>
      )}

      {showActivityModal && (
        <ModalShell onClose={() => setShowActivityModal(false)}>
          <form onSubmit={handleAddActivity} className="space-y-4">
            <h3 className="text-lg font-bold">เพิ่มกิจกรรมใหม่</h3>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={activityForm.scope_id}
              onChange={(e) => setActivityForm({ ...activityForm, scope_id: e.target.value })}
              required
            >
              <option value="">เลือกขอบเขต (Scope)</option>
              {scopes.map((s) => (
                <option key={s.scope_id} value={s.scope_id}>
                  Scope {s.scope_number} — {s.scope_name}
                </option>
              ))}
            </select>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="ชื่อกิจกรรม เช่น การใช้น้ำมันเชื้อเพลิงยานพาหนะ"
              value={activityForm.activity_name}
              onChange={(e) => setActivityForm({ ...activityForm, activity_name: e.target.value })}
              required
            />
            <ModalActions onCancel={() => setShowActivityModal(false)} />
          </form>
        </ModalShell>
      )}

      {showDetailModal && (
        <ModalShell onClose={() => setShowDetailModal(false)}>
          <form onSubmit={handleAddDetail} className="space-y-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold">เพิ่มรายละเอียดกิจกรรม</h3>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={detailForm.activity_id}
              onChange={(e) => setDetailForm({ ...detailForm, activity_id: e.target.value })}
              required
            >
              <option value="">เลือกกิจกรรม</option>
              {activities.map((a) => (
                <option key={a.activity_id} value={a.activity_id}>
                  {a.activity_name}
                </option>
              ))}
            </select>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="ชื่อรายละเอียดที่บันทึก เช่น น้ำมันดีเซล B7"
              value={detailForm.detail_name}
              onChange={(e) => setDetailForm({ ...detailForm, detail_name: e.target.value })}
              required
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="หน่วย เช่น ลิตร, kWh, kg, km"
              value={detailForm.unit}
              onChange={(e) => setDetailForm({ ...detailForm, unit: e.target.value })}
              required
            />
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
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
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
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
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="รายละเอียดวิธีบันทึกข้อมูล"
              rows={2}
              value={detailForm.description}
              onChange={(e) => setDetailForm({ ...detailForm, description: e.target.value })}
            />
            <ModalActions onCancel={() => setShowDetailModal(false)} />
          </form>
        </ModalShell>
      )}
    </div>
  );
}

function ModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 w-full max-w-[440px]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border">
        ยกเลิก
      </button>
      <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-[#059669] text-white">
        บันทึก
      </button>
    </div>
  );
}