'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ModalActions, ModalShell } from '@/components/Modal';
import { deleteRecord, insertRecord, updateRecord } from '@/lib/supabaseCrud';

const inputCls = (hasError: boolean) =>
  `w-full border rounded-lg px-3 py-2 text-sm text-gray-800 bg-white ${hasError ? 'border-red-500' : 'border-gray-300'}`;

export default function ActivityBasedClient({
  initialActivities,
}: {
  initialActivities: any[];
}) {
  const [activities, setActivities] = useState<any[]>(initialActivities);
  const [emissionFactors, setEmissionFactors] = useState<any[]>([]);
  
  // Modal สำหรับจัดการกิจกรรมย่อย
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Modal สำหรับจัดการหมวดหมู่หลัก
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingOldCategory, setEditingOldCategory] = useState<string | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');

  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('ALL');

  const [form, setForm] = useState({
    category_name: '',
    sub_category: '',
    ef_id: '',
    unit: '',
  });

  const dynamicCategories = Array.from(
    new Set(activities.map(item => item.category_name).filter(Boolean))
  ) as string[];

  // ดึงข้อมูล Emission Factor กลางจากระบบ
  useEffect(() => {
    async function fetchEmissionFactors() {
      const { data, error } = await supabase
        .from('emission_factor')
        .select('*')
        .order('ef_name', { ascending: true });
      if (!error && data) {
        setEmissionFactors(data);
      }
    }
    fetchEmissionFactors();
  }, []);

  function openModal(row?: any) {
    setEditId(row?.activity_id ?? null);
    setForm(
      row
        ? {
            category_name: row.category_name ?? (dynamicCategories[0] || ''),
            sub_category: row.sub_category ?? '',
            ef_id: row.ef_id ?? '',
            unit: row.unit ?? '',
          }
        : { 
            category_name: selectedCategoryTab !== 'ALL' ? selectedCategoryTab : (dynamicCategories[0] || ''), 
            sub_category: '', 
            ef_id: '', 
            unit: '' 
          }
    );
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      alert("กรุณาเข้าสู่ระบบก่อนทำการบันทึกข้อมูล");
      return;
    }

    const selectedEf = emissionFactors.find(e => e.ef_id === form.ef_id);

    const values = {
      category_name: form.category_name.trim(),
      sub_category: form.sub_category.trim(),
      ef_id: form.ef_id || null,
      unit: form.unit.trim() || selectedEf?.real_unit || 'unit',
      admin_id: user.id,
    };

    const select = '*';
    const primaryKey = 'activity_id';

    if (editId) {
      const updated = await updateRecord(
        'activity_based',
        primaryKey,
        editId,
        values,
        select,
        'แก้ไขกิจกรรม'
      );
      if (!updated) return;
      setActivities((prev) => prev.map((item) => (item[primaryKey] === editId ? updated : item)));
    } else {
      const created = await insertRecord(
        'activity_based',
        values,
        select,
        'เพิ่มกิจกรรม'
      );
      if (!created) return;
      setActivities((prev) => [...prev, created]);
    }

    closeModal();
  }

  async function handleDelete(id: string) {
    const primaryKey = 'activity_id';
    const ok = await deleteRecord('activity_based', primaryKey, id, 'ลบกิจกรรมนี้หรือไม่?');
    if (!ok) return;
    setActivities((prev) => prev.filter((item) => item[primaryKey] !== id));
  }

  // เพิ่มหรือแก้ไขเฉพาะชื่อหมวดหมู่หลักในตาราง activity_based (ไม่ต้องใส่ข้อมูลซับซ้อนแล้วเพราะฟิลด์ย่อยเป็น NULL ได้)
  async function handleSaveCategorySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryNameInput.trim()) return;

    const trimmedVal = categoryNameInput.trim();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      alert("กรุณาเข้าสู่ระบบก่อนทำการบันทึกข้อมูล");
      return;
    }

    const primaryKey = 'activity_id';

    if (editingOldCategory) {
      const targetRows = activities.filter(item => item.category_name === editingOldCategory);
      for (const row of targetRows) {
        await updateRecord(
          'activity_based',
          primaryKey,
          row[primaryKey],
          { category_name: trimmedVal },
          '*',
          'แก้ไขหมวดหมู่'
        );
      }
      setActivities(prev => prev.map(item => item.category_name === editingOldCategory ? { ...item, category_name: trimmedVal } : item));
      if (selectedCategoryTab === editingOldCategory) {
        setSelectedCategoryTab(trimmedVal);
      }
      setEditingOldCategory(null);
    } else {
      // เพิ่มหมวดหมู่ใหม่ บันทึกแค่ชื่อหมวดและ admin_id อย่างเดียวแบบคลีนๆ
      const values = {
        category_name: trimmedVal,
        admin_id: user.id,
      };
      const created = await insertRecord('activity_based', values, '*', 'เพิ่มหมวดหมู่ใหม่');
      if (created) {
        setActivities(prev => [...prev, created]);
        setSelectedCategoryTab(trimmedVal);
      }
    }

    setCategoryNameInput('');
  }

  async function handleDeleteCategory(catName: string) {
    if (!confirm(`ต้องการลบหมวดหมู่ "${catName}" และกิจกรรมทั้งหมดในหมวดนี้ใช่หรือไม่?`)) return;

    const primaryKey = 'activity_id';
    const targetRows = activities.filter(item => item.category_name === catName);
    for (const row of targetRows) {
      await deleteRecord('activity_based', primaryKey, row[primaryKey], '');
    }

    setActivities(prev => prev.filter(item => item.category_name !== catName));
    if (selectedCategoryTab === catName) {
      setSelectedCategoryTab('ALL');
    }
  }

  const filteredActivities = selectedCategoryTab === 'ALL'
    ? activities
    : activities.filter(item => item.category_name === selectedCategoryTab);

  return (
    <div className="max-w-[1280px] px-8 pt-16 pb-8 space-y-6 font-['Be_Vietnam_Pro']">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-bold leading-[32px] tracking-[-0.6px] text-gray-900">
            จัดการข้อมูลกิจกรรม (Activity Based)
          </h1>
          <p className="text-sm text-gray-700 mt-2 font-medium">
            จัดการหมวดหมู่หลัก กิจกรรมย่อย ค่า EF และหน่วยวัดได้อย่างอิสระ
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              setEditingOldCategory(null);
              setCategoryNameInput('');
              setShowCategoryModal(true);
            }}
            className="rounded-lg border border-[#266955] text-[#266955] px-4 py-2 text-xs font-semibold shadow-sm hover:bg-emerald-50 transition"
          >
            ⚙️ จัดการหมวดหมู่หลัก
          </button>
          <button
            onClick={() => openModal()}
            className="rounded-lg bg-[#266955] px-4 py-2 text-xs text-white shadow-sm hover:bg-[#1f5443] transition font-semibold"
          >
            + เพิ่มกิจกรรมย่อยใหม่
          </button>
        </div>
      </div>

      {/* แถบ Tabs แสดงหมวดหมู่หลัก */}
      <div className="flex items-center space-x-2 border-b border-gray-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setSelectedCategoryTab('ALL')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
            selectedCategoryTab === 'ALL'
              ? 'bg-[#266955] text-white shadow-sm'
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}
        >
          แสดงทั้งหมด ({activities.length})
        </button>
        {dynamicCategories.map((cat) => {
          const count = activities.filter(item => item.category_name === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategoryTab(cat)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                selectedCategoryTab === cat
                  ? 'bg-[#266955] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              หมวด: {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* ตารางแสดงข้อมูล */}
      <div className="w-full rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <tr className="text-xs font-bold uppercase tracking-wide text-gray-700">
              <th className="px-6 py-3.5 text-left">หมวดหมู่หลัก</th>
              <th className="px-6 py-3.5 text-left">กิจกรรมย่อย (Sub-Category)</th>
              <th className="px-6 py-3.5 text-right">ค่า Emission Factor</th>
              <th className="px-6 py-3.5 text-left">หน่วยวัด (Unit)</th>
              <th className="px-6 py-3.5 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredActivities.map((row) => {
              const matchedEf = emissionFactors.find(e => e.ef_id === row.ef_id);
              const rowKey = row.activity_id;
              return (
                <tr key={rowKey} className="border-t border-[#F1F5F9] hover:bg-gray-50/50">
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-md text-xs font-bold border border-emerald-200">
                      {row.category_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-900 font-semibold">{row.sub_category || '-'}</td>
                  <td className="px-6 py-4 text-right font-bold text-[#047857]">
                    {matchedEf ? matchedEf.ef_value : '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-800 font-medium">
                    <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-800 rounded-md text-xs font-semibold border border-gray-200">
                      {row.unit || matchedEf?.real_unit || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center space-x-3">
                    <button onClick={() => openModal(row)} className="text-gray-600 hover:text-[#266955] font-bold" title="แก้ไข">
                      ✏️
                    </button>
                    <button onClick={() => handleDelete(rowKey)} className="text-gray-600 hover:text-red-600 font-bold" title="ลบ">
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredActivities.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-700 font-medium">
                  ไม่พบข้อมูลกิจกรรมในหมวดหมู่นี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal จัดการกิจกรรมย่อย */}
      {showModal && (
        <ModalShell onClose={closeModal}>
          <form onSubmit={handleSave} className="space-y-4" noValidate>
            <h3 className="text-lg font-bold border-b pb-2 text-gray-900">
              {editId ? 'แก้ไขข้อมูลกิจกรรมย่อย' : 'เพิ่มกิจกรรมย่อยใหม่'}
            </h3>

            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">
                1. เลือกหมวดหมู่หลัก *
              </label>
              <select
                className={inputCls(false)}
                value={form.category_name}
                onChange={(e) => setForm({ ...form, category_name: e.target.value })}
                required
              >
                {dynamicCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">
                2. ระบุชื่อกิจกรรมย่อย *
              </label>
              <input
                className={inputCls(false)}
                placeholder="เช่น รถยนต์ส่วนบุคคล, ประชุมออนไลน์"
                value={form.sub_category}
                onChange={(e) => setForm({ ...form, sub_category: e.target.value })}
                required
              />
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  3. ดึงค่า Emission Factor กลางจากระบบ *
                </label>
                <select
                  className={inputCls(false)}
                  value={form.ef_id}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const found = emissionFactors.find(item => item.ef_id === selectedId);
                    setForm({
                      ...form,
                      ef_id: selectedId,
                      unit: found?.real_unit || form.unit,
                    });
                  }}
                  required
                >
                  <option value="">-- เลือกค่า Emission Factor --</option>
                  {emissionFactors.map((ef) => (
                    <option key={ef.ef_id} value={ef.ef_id}>
                      {ef.ef_name} (EF: {ef.ef_value} / {ef.real_unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  4. หน่วยวัด (Unit) *
                </label>
                <input
                  className={inputCls(false)}
                  placeholder="เช่น km, kWh, hours"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  required
                />
              </div>
            </div>

            <ModalActions onCancel={closeModal} />
          </form>
        </ModalShell>
      )}

      {/* Modal จัดการเฉพาะชื่อหมวดหมู่หลัก */}
      {showCategoryModal && (
        <ModalShell onClose={() => setShowCategoryModal(false)}>
          <div className="space-y-4">
            <h3 className="text-lg font-bold border-b pb-2 text-gray-900">จัดการหมวดหมู่หลักทั้งหมด</h3>

            <form onSubmit={handleSaveCategorySubmit} className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-3">
              <label className="block text-xs font-bold text-gray-800">
                {editingOldCategory ? `แก้ไขชื่อหมวดหมู่: "${editingOldCategory}"` : '➕ เพิ่มหมวดหมู่หลักใหม่'}
              </label>
              
              <div className="flex space-x-2">
                <input
                  className={inputCls(false)}
                  placeholder="พิมพ์ชื่อหมวดหมู่..."
                  value={categoryNameInput}
                  onChange={(e) => setCategoryNameInput(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#266955] px-4 py-2 text-xs font-bold text-white whitespace-nowrap hover:bg-[#1f5443] transition"
                >
                  {editingOldCategory ? 'บันทึก' : 'เพิ่มหมวด'}
                </button>
                {editingOldCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingOldCategory(null);
                      setCategoryNameInput('');
                    }}
                    className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-bold text-gray-800 hover:bg-gray-300 transition"
                  >
                    ยกเลิก
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              <label className="block text-xs font-bold text-gray-800">รายชื่อหมวดหมู่เดิมในระบบ:</label>
              {dynamicCategories.length === 0 ? (
                <p className="text-xs text-gray-700 text-center py-4 font-medium">ยังไม่มีหมวดหมู่ในระบบ</p>
              ) : (
                dynamicCategories.map((cat) => (
                  <div key={cat} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <span className="text-sm font-bold text-gray-900">{cat}</span>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingOldCategory(cat);
                          setCategoryNameInput(cat);
                        }}
                        className="text-xs font-bold text-blue-600 hover:underline px-2.5 py-1 bg-blue-50 rounded"
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        className="text-xs font-bold text-red-600 hover:underline px-2.5 py-1 bg-red-50 rounded"
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="rounded-lg bg-gray-200 px-4 py-2 text-xs font-bold text-gray-800 hover:bg-gray-300 transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}