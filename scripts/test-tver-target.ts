// ทดสอบสูตรของโหมด "จำลองโครงการ T-VER จากเป้าหมายการกักเก็บคาร์บอน" (src/app/organization/tver-target/calculation.ts)
// วิธีรัน: npx tsx scripts/test-tver-target.ts
// ตัวเลขที่คาดหวังคิดมือไว้ก่อน และตรวจซ้ำด้วยการคิดแบบเศษส่วนแล้ว

import assert from 'node:assert/strict';
import {
  calculateTargetPlan,
  upperLimitFrom,
  type PlanInput,
  type SpeciesInput,
} from '../src/app/organization/tver-target/calculation';

const LIMIT_1000 = { operator: '<=' as const, value: 1000 };

// ที่ดินตัวอย่างหลัก: พันธุ์ A ระยะ 4 × 4 ม. (30 ไร่ × 2 + 20 ไร่ × 3 = 120 ไร่) และพันธุ์ B ระยะ 3 × 3 ม. (25 ไร่ × 2 = 50 ไร่)
const A: SpeciesInput = { key: 'A', name: 'พันธุ์ A', spacingTreeM: 4, spacingRowM: 4, plots: [{ sizeRai: 30, count: 2 }, { sizeRai: 20, count: 3 }] };
const B: SpeciesInput = { key: 'B', name: 'พันธุ์ B', spacingTreeM: 3, spacingRowM: 3, plots: [{ sizeRai: 25, count: 2 }] };
const plan = (targetTco2e: number, species: SpeciesInput[], year = 3): PlanInput => ({ targetTco2e, year, species, maxProjectArea: LIMIT_1000 });

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log('ผ่าน  ' + name);
}

test('ที่ดินไม่พอ เพิ่มได้ทั้ง 2 พันธุ์ (เป้า 1,000 ตัน)', () => {
  const r = calculateTargetPlan(plan(1000, [A, B]));
  assert.equal(r.species[0].areaPerTreeSqm, 16);
  assert.equal(r.species[1].areaPerTreeSqm, 9);
  assert.equal(r.species[0].treesCapacity, 12000);
  assert.equal(r.species[1].treesCapacity, 8888); // 8,888.9 ปัดลง
  assert.equal(r.areaRai, 170);
  assert.equal(r.treesCapacity, 20888);
  assert.equal(r.treeGap, 14200);
  assert.equal(r.treesNeeded, 35088); // 35,087.7 ปัดขึ้น
  assert.equal(r.treesNeeded - r.treesCapacity, 14200);
  assert.equal(r.isSufficient, false);
  assert.equal(r.treesShort, 14200);
  assert.deepEqual([r.species[0].addRai, r.species[0].totalRaiAfterAdd, r.species[0].withinLimit], [142, 312, true]);
  assert.deepEqual([r.species[1].addRai, r.species[1].totalRaiAfterAdd, r.species[1].withinLimit], [80, 250, true]); // 79.875 ปัดขึ้น
  assert.equal(r.hasFeasibleOption, true);
});

test('ที่ดินไม่พอ เกิน 1,000 ไร่บางพันธุ์ (เป้า 3,000 ตัน)', () => {
  const r = calculateTargetPlan(plan(3000, [A, B]));
  assert.equal(r.treesNeeded, 105264);
  assert.equal(r.treesShort, 84376);
  assert.deepEqual([r.species[0].addRai, r.species[0].totalRaiAfterAdd, r.species[0].withinLimit], [844, 1014, false]);
  assert.deepEqual([r.species[1].addRai, r.species[1].totalRaiAfterAdd, r.species[1].withinLimit], [475, 645, true]);
  assert.equal(r.hasFeasibleOption, true);
});

test('ที่ดินไม่พอ เกิน 1,000 ไร่ทุกพันธุ์ (เป้า 10,000 ตัน)', () => {
  const r = calculateTargetPlan(plan(10000, [A, B]));
  assert.equal(r.treesNeeded, 350878);
  assert.equal(r.treesShort, 329990);
  assert.deepEqual([r.species[0].addRai, r.species[0].totalRaiAfterAdd, r.species[0].withinLimit], [3300, 3470, false]);
  assert.deepEqual([r.species[1].addRai, r.species[1].totalRaiAfterAdd, r.species[1].withinLimit], [1857, 2027, false]);
  assert.equal(r.hasFeasibleOption, false);
});

test('ที่ดินพอและเกินเป้า (เป้า 50 ตัน, A 10 ไร่ × 2)', () => {
  const small: SpeciesInput = { ...A, plots: [{ sizeRai: 10, count: 2 }] };
  const r = calculateTargetPlan(plan(50, [small]));
  assert.equal(r.treesCapacity, 2000);
  assert.equal(r.treesNeeded, 1755); // 1,754.4 ปัดขึ้น
  assert.equal(r.treeGap, -245); // ปลูกได้เกินเป้า 245 ต้น
  assert.equal(r.isSufficient, true);
  assert.equal(r.treesShort, 0);
  assert.equal(r.species[0].addRai, null);
});

test('ผลต่างเป็น 0 พอดี ถือว่าพอ (เป้า 57 ตัน = ที่ดินทำได้พอดี)', () => {
  const small: SpeciesInput = { ...A, plots: [{ sizeRai: 10, count: 2 }] };
  const r = calculateTargetPlan(plan(57, [small]));
  assert.equal(r.treesNeeded, 2000);
  assert.equal(r.treeGap, 0);
  assert.equal(r.isSufficient, true);
});

test('พื้นที่รวมหลังเพิ่ม = 1,000 ไร่พอดี ยังผ่าน (เป้า 2,960.80 ตัน)', () => {
  const r = calculateTargetPlan(plan(2960.8, [A, B]));
  assert.equal(r.treesNeeded, 103888);
  assert.equal(r.treesShort, 83000);
  assert.deepEqual([r.species[0].addRai, r.species[0].totalRaiAfterAdd, r.species[0].withinLimit], [830, 1000, true]);
});

test('เกิน 1,000 ไร่ไป 1 ไร่ ไม่ผ่าน (เป้า 2,960.81 ตัน)', () => {
  const r = calculateTargetPlan(plan(2960.81, [A, B]));
  assert.equal(r.treesNeeded, 103889);
  assert.deepEqual([r.species[0].addRai, r.species[0].totalRaiAfterAdd, r.species[0].withinLimit], [831, 1001, false]);
});

test('ไม่ปัดเศษผิดจากทศนิยมของคอมพิวเตอร์ (7 ไร่ ระยะ 2 × 3.5 ม. = 1,600 ต้นพอดี)', () => {
  const s: SpeciesInput = { key: 'C', name: 'C', spacingTreeM: 2, spacingRowM: 3.5, plots: [{ sizeRai: 7, count: 1 }] };
  const r = calculateTargetPlan(plan(1, [s]));
  assert.equal(r.species[0].areaPerTreeSqm, 7);
  assert.equal(r.species[0].treesCapacity, 1600);
});

test('ขนาดแปลงมีทศนิยม (12.5 ไร่ × 3 ระยะ 3 × 3 ม.)', () => {
  const s: SpeciesInput = { key: 'D', name: 'D', spacingTreeM: 3, spacingRowM: 3, plots: [{ sizeRai: 12.5, count: 3 }] };
  const r = calculateTargetPlan(plan(1, [s]));
  assert.equal(r.areaRai, 37.5);
  assert.equal(r.species[0].treesCapacity, 6666); // 6,666.7 ปัดลง
});

test('ปีที่ 10 ใช้ต้นน้อยลง (เป้า 1,000 ตัน)', () => {
  const r = calculateTargetPlan(plan(1000, [A, B], 10));
  assert.equal(r.treesNeeded, 10527); // 10,526.3 ปัดขึ้น
  assert.equal(r.treeGap, -10361); // 10,527 − 20,888
  assert.equal(r.isSufficient, true);
});

test('เพดานพื้นที่จากเงื่อนไขของแอดมิน', () => {
  const criteria = [
    { detail_name: 'พื้นที่โครงการ', condition_operator: '<=', condition_number: 500 },
    { detail_name: 'จำนวนต้นไม้', condition_operator: '>=', condition_number: 10 },
  ];
  assert.deepEqual(upperLimitFrom(criteria, 'พื้นที่โครงการ', 1000), { operator: '<=', value: 500 });
  assert.deepEqual(upperLimitFrom(criteria, 'ขนาดแปลงย่อย', 30), { operator: '<=', value: 30 }); // ไม่มี -> ค่าตามเกณฑ์ T-VER
  assert.deepEqual(upperLimitFrom(criteria, 'จำนวนต้นไม้', 7), { operator: '<=', value: 7 }); // ไม่ใช่เพดาน -> ค่าตามเกณฑ์
});

test('ยังไม่มีพื้นที่ปลูกเลย (เป้า 1,000 ตัน ทั้ง 2 พันธุ์ไม่มีแปลง)', () => {
  const r = calculateTargetPlan(plan(1000, [{ ...A, plots: [] }, { ...B, plots: [] }]));
  assert.equal(r.areaRai, 0);
  assert.equal(r.treesCapacity, 0);
  assert.equal(r.treesNeeded, 35088);
  assert.equal(r.treeGap, 35088); // ต้นที่ขาด = ต้นที่ต้องปลูกทั้งหมด
  assert.equal(r.isSufficient, false);
  assert.equal(r.species[0].addRai, 351); // ⌈35,088 × 16 ÷ 1,600⌉ = ⌈350.88⌉
  assert.equal(r.species[0].totalRaiAfterAdd, 351);
  assert.equal(r.species[1].addRai, 198); // ⌈35,088 × 9 ÷ 1,600⌉ = ⌈197.37⌉
  assert.equal(r.species[0].withinLimit, true);
  assert.equal(r.species[1].withinLimit, true);
});

test('มีพื้นที่บางพันธุ์ (A มี 120 ไร่, B ยังไม่มี, เป้า 1,000 ตัน)', () => {
  const r = calculateTargetPlan(plan(1000, [A, { ...B, plots: [] }]));
  assert.equal(r.areaRai, 120);
  assert.equal(r.treesCapacity, 12000);
  assert.equal(r.treesShort, 23088);
  assert.equal(r.species[0].addRai, 231); // ⌈23,088 × 16 ÷ 1,600⌉ = ⌈230.88⌉
  assert.equal(r.species[0].totalRaiAfterAdd, 351);
  assert.equal(r.species[1].addRai, 130); // ⌈23,088 × 9 ÷ 1,600⌉ = ⌈129.87⌉
  assert.equal(r.species[1].totalRaiAfterAdd, 250);
});

test('ยังไม่มีพื้นที่ปลูก และเกิน 1,000 ไร่ทุกพันธุ์ (เป้า 10,000 ตัน)', () => {
  const r = calculateTargetPlan(plan(10000, [{ ...A, plots: [] }, { ...B, plots: [] }]));
  assert.equal(r.treesNeeded, 350878);
  assert.equal(r.species[0].addRai, 3509);
  assert.equal(r.species[1].addRai, 1974);
  assert.equal(r.hasFeasibleOption, false);
});

console.log(`\nผ่านทั้งหมด ${passed} กรณี`);
