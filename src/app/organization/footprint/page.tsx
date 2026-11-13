// /organization/footprint -> ส่งต่อไปขั้นที่ 1 (footprint/office_info) พร้อม query เดิม (?edit= / ?resume=)
// เมนู "คาร์บอนฟุตพรินต์" บน navbar และลิงก์เก่าที่ไม่มี /office_info จึงยังใช้ได้
import { redirect } from 'next/navigation';

export default async function FootprintIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === 'string') params.set(k, v);
  }
  const q = params.toString();
  redirect(`/organization/footprint/office_info${q ? `?${q}` : ''}`);
}
