/* กล่องแจ้งเตือน/ยืนยันแบบมีสไตล์ ใช้แทน alert() / confirm() ของเบราว์เซอร์
 * เรียกได้จากทุกที่ (ทั้งใน component และไฟล์ lib) โดยไม่ต้องมี state ในหน้านั้น
 *   await showAlert('บันทึกแล้ว')                         -> กล่องแจ้งข้อมูล ปุ่ม "ตกลง"
 *   await showError('บันทึกไม่สำเร็จ: ...')               -> กล่องแจ้งข้อผิดพลาด (ไอคอนแดง)
 *   if (!(await showConfirm('ลบรายการนี้?', { danger: true }))) return;
 * แสดงผลโดย <DialogHost /> ที่วางไว้ใน src/app/layout.tsx (ทุกหน้าใช้ร่วมกัน)
 * เปิดซ้อนกันหลายกล่อง = เข้าคิว แสดงทีละกล่องตามลำดับ */

export type DialogTone = 'info' | 'success' | 'error' | 'warning' | 'danger';

export type DialogKind = 'alert' | 'confirm';

export type DialogRequest = {
  id: number;
  kind: DialogKind;
  tone: DialogTone;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  resolve: (ok: boolean) => void;
};

type Options = {
  title?: string;
  tone?: DialogTone;
  confirmText?: string;
  cancelText?: string;
};

let queue: DialogRequest[] = [];
let nextId = 1;
let listeners: (() => void)[] = []; // ฟังก์ชันที่รอรับแจ้งเมื่อกล่องเปลี่ยน

// แจ้งทุกฟังก์ชันที่รออยู่ว่ากล่องเปลี่ยนแล้ว
function emit() {
  for (const l of listeners) l();
}

// สมัครรับแจ้งเมื่อกล่องเปลี่ยน แล้วคืนฟังก์ชันสำหรับยกเลิก
export function subscribeDialog(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

// กล่องที่กำลังแสดง (ตัวแรกของคิว)
export function currentDialog(): DialogRequest | null {
  return queue[0] ?? null;
}

// เอากล่องออกจากคิว แล้วส่งผลการกดกลับไปให้โค้ดที่รออยู่
export function closeDialog(id: number, ok: boolean) {
  const req = queue.find((d) => d.id === id);
  if (!req) return;
  queue = queue.filter((d) => d.id !== id);
  emit();
  req.resolve(ok);
}

// เพิ่มกล่องใหม่เข้าคิว แล้วรอจนกว่าผู้ใช้จะกดปุ่ม
function open(kind: DialogKind, message: string, opts: Options, defaults: Required<Options>) {
  // ฝั่ง server ไม่มีหน้าจอให้แสดง (ไม่ควรเกิด เพราะเรียกจากเหตุการณ์ของผู้ใช้)
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    queue = [
      ...queue,
      {
        id: nextId++,
        kind,
        message,
        tone: opts.tone ?? defaults.tone,
        title: opts.title ?? defaults.title,
        confirmText: opts.confirmText ?? defaults.confirmText,
        cancelText: opts.cancelText ?? defaults.cancelText,
        resolve,
      },
    ];
    emit();
  });
}

// แสดงกล่องแจ้งเตือนที่มีปุ่มตกลงปุ่มเดียว
export async function showAlert(message: string, opts: Options = {}): Promise<void> {
  await open('alert', message, opts, { title: 'แจ้งเตือน', tone: 'info', confirmText: 'ตกลง', cancelText: '' });
}

// แสดงกล่องแจ้งบันทึกสำเร็จ (ไอคอนเขียว) ใช้หลังบันทึกข้อมูลเสร็จ เช่นปุ่มบันทึกในหน้าแอดมิน
//   showSaved()  หรือ  showSaved('อัปโหลดเอกสารเรียบร้อยแล้ว')
export function showSaved(message = 'บันทึกข้อมูลเรียบร้อยแล้ว', opts: Options = {}): Promise<void> {
  return showAlert(message, { title: 'บันทึกสำเร็จ', tone: 'success', ...opts });
}

// แสดงกล่องแจ้งข้อผิดพลาด
export function showError(message: string, opts: Options = {}): Promise<void> {
  return showAlert(message, { title: 'เกิดข้อผิดพลาด', tone: 'error', ...opts });
}

// แสดงกล่องยืนยัน กดยืนยันได้ true กดยกเลิกได้ false
export function showConfirm(message: string, opts: Options & { danger?: boolean } = {}): Promise<boolean> {
  const danger = opts.danger ?? false;
  return open('confirm', message, opts, {
    title: danger ? 'ยืนยันการลบ' : 'ยืนยันการทำรายการ',
    tone: danger ? 'danger' : 'warning',
    confirmText: danger ? 'ลบ' : 'ยืนยัน',
    cancelText: 'ยกเลิก',
  });
}
