/*
 * ตรวจว่า "ช่องบังคับ" ของฟอร์มกิจกรรมทั่วไป (ประชุม / เดินทาง) กรอกครบและใช้ได้หรือยัง (TOR ข้อ 9.1)
 *
 * หลักการ: ฟอร์มส่งค่าที่ผู้ใช้กรอกมา "ตามจริง" ไม่เติมค่าแทนให้เอง (เดิมฟอร์มเติมชื่ออุปกรณ์ว่าง = "อุปกรณ์",
 *   จำนวน/ชั่วโมงว่าง = 1, วัตต์ว่าง = 60 แล้วเอาไปคำนวณและบันทึกโดยผู้ใช้ไม่รู้) ที่นี่ตรวจก่อนคำนวณ
 *   ถ้าไม่ครบจะบอกว่าขาดช่องไหน และหน้า page.tsx จะไม่คำนวณ ไม่บันทึก จนกว่าจะกรอกครบ
 * คืนข้อความภาษาไทยของข้อแรกที่ไม่ผ่าน หรือ null ถ้าผ่านทั้งหมด
 */

type EquipmentInput = { equipmentName: string; devices: number; durationHours: number; electricityKwh: number };
type MeetingInput = {
  category_type: string;
  equipmentSets?: EquipmentInput[];
  vehicleType?: string;
  distanceKm?: number;
  trips?: number;
  electricityKwh?: number; // kWh ต่อ กม. ของรถ EV
};
type TravelInput = { vehicleType: string; distanceKm: number; trips: number; electricityKwh?: number };

const isPositiveInteger = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 1;
const isPositive = (v: unknown) => typeof v === "number" && v > 0; // NaN / ว่าง (0) ไม่ผ่าน

// ส่วนการเดินทางที่ใช้ร่วมกัน (ประชุมออนไซต์ และการเดินทาง)
function checkTrip(label: string, vehicleType: string | undefined, distanceKm: number | undefined, trips: number | undefined, evKwhPerKm: number | undefined): string | null {
  if (!isPositive(distanceKm)) return `${label}: กรุณากรอกระยะทาง (กิโลเมตร) ให้มากกว่า 0`;
  if (!isPositiveInteger(trips)) return `${label}: กรุณากรอกจำนวนเที่ยวเป็นจำนวนเต็ม 1 ขึ้นไป`;
  if ((vehicleType || "").toLowerCase() === "ev" && !isPositive(evKwhPerKm)) {
    return `${label}: กรุณากรอกอัตราสิ้นเปลืองไฟฟ้าของรถ EV (kWh ต่อ 100 กม.)`;
  }
  return null;
}

export function findMissingInput(meeting: MeetingInput | null, travel: TravelInput | null): string | null {
  if (meeting) {
    const sets = meeting.equipmentSets ?? [];
    if (sets.length === 0) return "การประชุม: ต้องมีรายการอุปกรณ์ไฟฟ้าอย่างน้อย 1 รายการ";

    for (let i = 0; i < sets.length; i++) {
      const s = sets[i];
      const n = i + 1;
      if (!s.equipmentName || !s.equipmentName.trim()) return `การประชุม: กรุณากรอกชื่อ "ชนิดอุปกรณ์ ${n}" (ถ้าไม่ใช้รายการนี้ให้กดถังขยะลบออก)`;
      if (!isPositiveInteger(s.devices)) return `การประชุม: ชนิดอุปกรณ์ ${n} กรุณากรอก "จำนวน" เป็นจำนวนเต็ม 1 ขึ้นไป`;
      if (!isPositive(s.durationHours)) return `การประชุม: ชนิดอุปกรณ์ ${n} กรุณากรอก "ชม.ใช้งาน" ให้มากกว่า 0`;
      if (!isPositive(s.electricityKwh)) return `การประชุม: ชนิดอุปกรณ์ ${n} กรุณากรอก "กำลังไฟ (วัตต์)" ให้มากกว่า 0`;
    }

    if (meeting.category_type === "onsite") {
      const problem = checkTrip("การประชุมออนไซต์", meeting.vehicleType, meeting.distanceKm, meeting.trips, meeting.electricityKwh);
      if (problem) return problem;
    }
  }

  if (travel) {
    const problem = checkTrip("การเดินทาง", travel.vehicleType, travel.distanceKm, travel.trips, travel.electricityKwh);
    if (problem) return problem;
  }

  return null;
}
