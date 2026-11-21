// ทดสอบสูตรของโหมด "จำลองโครงการ T-VER จากการกักเก็บก๊าซเรือนกระจก" (src/app/organization/tver-target/calculation.ts)
// รัน: npx tsx scripts/test-tver-target.ts
import assert from 'node:assert/strict';
import { calculateTargetPlan, type AreaLimit } from '../src/app/organization/tver-target/calculation';

const LIMIT: AreaLimit = { operator: '<=', value: 1000 };
const calc = (target: number, year: number) => calculateTargetPlan({ targetTco2e: target, year, maxProjectArea: LIMIT });

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ผ่าน  ${name}`);
}

test('เป้า 1,000 ตัน ปีที่ 3', () => {
  const r = calc(1000, 3);
  assert.equal(r.treesNeeded, 35088); // ⌈1,000 ÷ 0.0285⌉ = ⌈35,087.72⌉
  assert.equal(r.areaPerTreeSqm, 16);
  assert.equal(r.treesPerRai, 100);
  assert.equal(r.areaRai, 351); // ⌈35,088 × 16 ÷ 1,600⌉ = ⌈350.88⌉
  assert.equal(r.withinLimit, true);
});

test('เป้า 50 ตัน ปีที่ 3 (ต้นปัดขึ้น)', () => {
  const r = calc(50, 3);
  assert.equal(r.treesNeeded, 1755); // ⌈1,754.39⌉
  assert.equal(r.areaRai, 18); // ⌈17.55⌉
});

test('เป้า 57 ตัน ปีที่ 3 (หารลงตัว)', () => {
  const r = calc(57, 3);
  assert.equal(r.treesNeeded, 2000);
  assert.equal(r.areaRai, 20);
});

test('เป้า 1,000 ตัน ปีที่ 10', () => {
  const r = calc(1000, 10);
  assert.equal(r.treesNeeded, 10527); // ⌈10,526.32⌉
  assert.equal(r.areaRai, 106); // ⌈105.27⌉
});

test('เป้า 1,000 ตัน ปีที่ 1 (เกิน 1,000 ไร่)', () => {
  const r = calc(1000, 1);
  assert.equal(r.treesNeeded, 105264); // ⌈105,263.16⌉
  assert.equal(r.areaRai, 1053);
  assert.equal(r.withinLimit, false);
});

test('ขอบเกณฑ์: 1,000 ไร่พอดี ยังผ่าน (เป้า 2,850 ตัน ปีที่ 3)', () => {
  const r = calc(2850, 3);
  assert.equal(r.treesNeeded, 100000);
  assert.equal(r.areaRai, 1000);
  assert.equal(r.withinLimit, true);
});

test('ขอบเกณฑ์: เกิน 1,000 ไร่ไป 1 ไร่ (เป้า 2,850.01 ตัน ปีที่ 3)', () => {
  const r = calc(2850.01, 3);
  assert.equal(r.treesNeeded, 100001);
  assert.equal(r.areaRai, 1001);
  assert.equal(r.withinLimit, false);
});

test('เป้า 10,000 ตัน ปีที่ 3 (เกินมาก)', () => {
  const r = calc(10000, 3);
  assert.equal(r.treesNeeded, 350878);
  assert.equal(r.areaRai, 3509);
  assert.equal(r.withinLimit, false);
});

test('ไม่ปัดเศษผิดจากทศนิยมของคอมพิวเตอร์ (เป้า 45.60 ตัน ปีที่ 3)', () => {
  const r = calc(45.6, 3);
  assert.equal(r.treesNeeded, 1600); // ต้องไม่เป็น 1,601
  assert.equal(r.areaRai, 16);
});

test('เป้าน้อยสุด 0.01 ตัน ปีที่ 10', () => {
  const r = calc(0.01, 10);
  assert.equal(r.treesNeeded, 1); // ⌈0.01 ÷ 0.095⌉ = ⌈0.105⌉
  assert.equal(r.areaRai, 1);
});

test('เงื่อนไขแบบ "น้อยกว่า" 1,000 ไร่: 1,000 ไร่พอดีไม่ผ่าน', () => {
  const r = calculateTargetPlan({ targetTco2e: 2850, year: 3, maxProjectArea: { operator: '<', value: 1000 } });
  assert.equal(r.withinLimit, false);
});

console.log(`\nผ่านทั้งหมด ${passed} กรณี`);
