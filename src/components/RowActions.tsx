import { PencilIcon, TrashIcon } from './icons';

/* ปุ่ม "แก้ไข" + "ลบ" ท้ายแถวของตารางฝั่ง admin (เดิมเขียนซ้ำทุกตารางทุกหน้า)
 * ใช้: <RowActions onEdit={() => openModal(row)} onDelete={() => handleDelete(row.id)} />
 * แก้สี/ระยะห่างของปุ่มที่ไฟล์นี้ที่เดียว ทุกตารางเปลี่ยนตาม */
export default function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-3 align-middle">
      <button
        type="button"
        onClick={onEdit}
        title="แก้ไข"
        aria-label="แก้ไข"
        className="text-[#64748B] hover:text-[#266955]"
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        onClick={onDelete}
        title="ลบ"
        aria-label="ลบ"
        className="text-[#64748B] hover:text-red-500"
      >
        <TrashIcon />
      </button>
    </span>
  );
}
