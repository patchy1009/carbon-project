/* หน้าตากลางของหน้าแอดมิน: การ์ด หัวข้อ ปุ่มเพิ่ม และตาราง
 * ยกมาจากหน้า T-VER Project (admin/tver/TverProjectClient.tsx) ให้ทุกหน้าแอดมินหน้าตาเหมือนกัน
 * แก้สี/ระยะห่างของตารางแอดมินทุกหน้าได้ที่ไฟล์นี้ที่เดียว
 *
 * ใช้: <section className={T.card}> <div className={T.cardHead}> <h2 className={T.h2}>…</h2> <button className={T.addBtn}>…
 *      <table className={T.table}> <thead className={T.thead}> <tr className={T.headRow}> <th className={`${T.th} text-left`}>
 *      <tr className={T.row}> <td className={T.tdMain}> (คอลัมน์แรก ตัวหนา) / <td className={T.td}> / <td className={T.tdActions}> */
export const T = {
  page: 'max-w-[1280px] px-8 pt-6 pb-16 space-y-6',
  h1: 'text-[32px] font-bold leading-10 tracking-[-0.8px] text-[#191C1C]',
  card: 'rounded-xl bg-white shadow-sm p-6 space-y-6',
  cardHead: 'flex items-center justify-between gap-4',
  h2: 'text-xl font-bold text-[#191C1C]',
  addBtn: 'btn btn-create flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm',
  wrap: 'overflow-x-auto',
  table: 'w-full text-sm',
  thead: 'bg-[#EDEEEE]',
  headRow: 'text-xs font-bold uppercase tracking-wide text-[#3F4944]',
  th: 'px-4 py-3',
  row: 'border-b border-[#F3F4F4]',
  td: 'px-4 py-4 text-[#3F4944]',
  tdMain: 'px-4 py-4 font-bold text-[#191C1C]',
  tdActions: 'px-4 py-4 text-right whitespace-nowrap',
  empty: 'px-4 py-6 text-center text-[#6F7974]',
} as const;
