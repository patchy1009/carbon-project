// API ลบบัญชีองค์กร (DELETE /api/account) ตรวจล็อกอิน + role ก่อนลบ แล้วลบข้อมูลขององค์กรนั้นทุกตาราง และลบบัญชีใน Supabase Auth
//   ใช้ SUPABASE_SERVICE_ROLE_KEY (ฝั่ง server เท่านั้น ห้ามขึ้นต้นด้วย NEXT_PUBLIC_) ต้องเพิ่มใน .env.local ไม่งั้นลบบัญชีไม่ได้
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabaseServer";

// ============================================================
// API จัดการข้อมูลบัญชีของตัวเอง  (ไฟล์: src/app/api/account/route.ts)
//   DELETE /api/account  -> ลบข้อมูลทั้งหมดขององค์กร + ลบบัญชีใน Supabase Auth
//
// หลักความปลอดภัย
//  1) รู้ว่าใครเป็นผู้เรียกจาก session (cookie) ฝั่ง server เท่านั้น ไม่รับ id จากหน้าเว็บ
//     จึงลบได้เฉพาะบัญชีของตัวเอง
//  2) ใช้ service role key (SUPABASE_SERVICE_ROLE_KEY) เฉพาะฝั่ง server เท่านั้น
//     ห้ามขึ้นต้นชื่อด้วย NEXT_PUBLIC_ เพราะจะหลุดไปที่เบราว์เซอร์
//  3) บัญชีที่ไม่ใช่ role "organization" (เช่น admin) ลบจากหน้านี้ไม่ได้
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// ------------------------------------------------------------
// [รายการตารางที่ผูกกับบัญชี] ถ้าเพิ่มตารางใหม่ที่เก็บข้อมูลขององค์กร ให้มาเพิ่มที่นี่
// (ผังนี้อ้างอิงจากกฎ foreign key ในฐานข้อมูลจริง)
//
// ตรวจรายชื่อตารางที่มีคอลัมน์ org_id / acc_id ได้ด้วย SQL:
//   select table_name, column_name from information_schema.columns
//   where table_schema = 'public' and column_name in ('org_id','acc_id') order by table_name;
// ------------------------------------------------------------

type DirectTable = { table: string; column: string };

// ตารางลูกของตารางแม่
//  deleteFirst = true  -> FK เป็นแบบ NO ACTION ต้องลบลูกก่อนแม่ (โค้ดนี้ลบให้)
//  deleteFirst = false -> FK เป็นแบบ CASCADE ฐานข้อมูลลบให้เองเมื่อลบแม่
type Child = { table: string; deleteFirst: boolean };

type ParentChild = {
  parent: string; // ตารางแม่ (มีคอลัมน์เจ้าขององค์กร)
  parentKey: string; // คีย์ของแม่ ซึ่งตารางลูกอ้างถึง (ชื่อคอลัมน์เดียวกันในตารางลูก)
  column: string; // คอลัมน์เจ้าของในตารางแม่
  children: Child[];
};

// ตารางที่เก็บข้อมูลโดยตรงด้วย org_id (ไม่มี FK -> ต้องลบเอง)
const DIRECT_TABLES: DirectTable[] = [
  { table: "general_activity_meeting", column: "org_id" },
  { table: "general_activity_traveling", column: "org_id" },
];

const PARENT_CHILD: ParentChild[] = [
  {
    parent: "org_activity_list",
    parentKey: "orgactlist_id",
    column: "org_id",
    children: [
      { table: "org_activity_detail", deleteFirst: true },
      { table: "org_office_info", deleteFirst: false },
      { table: "org_credit_allocation_detail", deleteFirst: false },
    ],
  },
  {
    parent: "org_tree_project",
    parentKey: "orgtreeproject_id",
    column: "org_id",
    children: [
      { table: "org_tree_project_detail", deleteFirst: true },
      { table: "org_credit_allocation", deleteFirst: false },
      { table: "org_sell_credit", deleteFirst: false },
    ],
  },
];

// ตารางบัญชี (ลบเป็นลำดับสุดท้ายก่อนลบ Auth) organization ผูกกับ user แบบ CASCADE
const ACCOUNT_TABLES: DirectTable[] = [
  { table: "organization", column: "acc_id" },
  { table: "user", column: "acc_id" },
];

// ------------------------------------------------------------

function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error("ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY ใน .env.local");
  }

  return createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type AdminClient = ReturnType<typeof createAdminClient>;

// ตารางที่ไม่มีอยู่จริงในฐานข้อมูล -> ข้ามได้ (ไม่ถือเป็นข้อผิดพลาด)
function isMissingTable(error: { code?: string } | null): boolean {
  return !!error && (error.code === "PGRST205" || error.code === "42P01");
}

// ตาราง organization มีทั้ง acc_id (id บัญชีล็อกอิน) และ org_id (id ขององค์กร ซึ่งเป็นคนละค่ากัน)
// ตารางข้อมูลอื่นๆ ใช้ org_id จึงต้องดึง org_id ของผู้ใช้คนนี้มาก่อน แล้วลบด้วยค่านั้น
// (ใส่ acc_id ไว้ด้วยเผื่อบางตารางเก็บค่านี้ในคอลัมน์ org_id ทั้งสองค่าเป็นของผู้ใช้คนนี้เท่านั้น)
async function getOwnerIds(admin: AdminClient, userId: string): Promise<string[]> {
  const { data, error } = await admin
    .from("organization")
    .select("org_id")
    .eq("acc_id", userId)
    .maybeSingle();

  if (error && !isMissingTable(error)) {
    throw new Error(`อ่านตาราง organization ไม่สำเร็จ: ${error.message}`);
  }

  const orgId = (data as { org_id?: string } | null)?.org_id;
  return orgId && orgId !== userId ? [orgId, userId] : [userId];
}

// ดึง id ของตารางแม่ทั้งหมดของผู้ใช้
async function getParentIds(
  admin: AdminClient,
  { parent, parentKey, column }: ParentChild,
  ownerIds: string[]
): Promise<{ ids: string[]; missing: boolean }> {
  const { data, error } = await admin.from(parent).select(parentKey).in(column, ownerIds);

  if (error) {
    if (isMissingTable(error)) return { ids: [], missing: true };
    throw new Error(`อ่านตาราง ${parent} ไม่สำเร็จ: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as Record<string, string>[];
  return { ids: rows.map((row) => row[parentKey]), missing: false };
}

// ลบข้อมูลขององค์กรทั้งหมด (ถ้าตารางใดลบไม่สำเร็จ จะหยุดทันทีและยังไม่ลบบัญชี Auth
// ผู้ใช้จึงยังเข้าระบบและลองใหม่ได้)
async function deleteOrgData(admin: AdminClient, userId: string): Promise<string[]> {
  const warnings: string[] = [];

  // ต้องดึง org_id ก่อนลบตาราง organization (ไม่งั้นหาไม่เจอ)
  const ownerIds = await getOwnerIds(admin, userId);

  // 1) ตารางแม่-ลูก: ลบลูกที่เป็น NO ACTION ก่อน แล้วลบแม่ (ลูกแบบ CASCADE ฐานข้อมูลลบให้เอง)
  for (const rel of PARENT_CHILD) {
    const { ids, missing } = await getParentIds(admin, rel, ownerIds);

    if (missing) {
      warnings.push(`ข้ามตาราง ${rel.parent}: ไม่พบตารางนี้ในฐานข้อมูล`);
      continue;
    }

    if (ids.length > 0) {
      for (const child of rel.children.filter((c) => c.deleteFirst)) {
        const { error: childError } = await admin
          .from(child.table)
          .delete()
          .in(rel.parentKey, ids);

        if (childError && !isMissingTable(childError)) {
          throw new Error(`ลบตาราง ${child.table} ไม่สำเร็จ: ${childError.message}`);
        }
      }
    }

    const { error: parentError } = await admin.from(rel.parent).delete().in(rel.column, ownerIds);

    if (parentError && !isMissingTable(parentError)) {
      throw new Error(`ลบตาราง ${rel.parent} ไม่สำเร็จ: ${parentError.message}`);
    }
  }

  // 2) ตารางข้อมูลที่ผูกกับ org_id โดยตรง (ใช้ org_id) และ 3) ตารางบัญชี organization, user (ใช้ acc_id)
  const deleteSteps = [
    ...DIRECT_TABLES.map(({ table, column }) => ({ table, column, values: ownerIds })),
    ...ACCOUNT_TABLES.map(({ table, column }) => ({ table, column, values: [userId] })),
  ];

  for (const { table, column, values } of deleteSteps) {
    const { error } = await admin.from(table).delete().in(column, values);

    if (error) {
      if (isMissingTable(error)) {
        warnings.push(`ข้ามตาราง ${table}: ไม่พบตารางนี้ในฐานข้อมูล`);
        continue;
      }
      throw new Error(`ลบตาราง ${table} ไม่สำเร็จ: ${error.message}`);
    }
  }

  return warnings;
}

// ------------------------------------------------------------
// DELETE: ลบข้อมูลองค์กรและบัญชีผู้ใช้ (ไม่ต้องส่ง body ใดๆ)
// ------------------------------------------------------------
export async function DELETE() {
  try {
    // 1) รู้ตัวตนผู้เรียกจาก session ฝั่ง server
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    // ไม่ขอรหัสผ่านซ้ำ ผู้ใช้ยืนยันด้วยปุ่มใน popup ของหน้าบัญชีผู้ใช้แล้ว

    const admin = createAdminClient();

    // 2) กันบัญชีที่ไม่ใช่องค์กร (เช่น admin) ลบตัวเองจากหน้านี้
    //    ถ้ายังไม่มีแถวในตาราง user ให้ลบได้ตามปกติ (กรณีบันทึกตอนสมัครไม่สำเร็จ)
    const { data: roleRow } = await admin
      .from("user")
      .select("role")
      .eq("acc_id", user.id)
      .maybeSingle();

    if (roleRow && roleRow.role !== "organization") {
      return NextResponse.json(
        { error: "บัญชีผู้ดูแลระบบไม่สามารถลบจากหน้านี้ได้" },
        { status: 403 }
      );
    }

    // 3) ลบข้อมูลขององค์กรในทุกตาราง
    const warnings = await deleteOrgData(admin, user.id);

    // 4) ลบบัญชีใน Supabase Auth เป็นขั้นสุดท้าย
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id);

    if (deleteAuthError) {
      throw new Error(`ลบบัญชีผู้ใช้ไม่สำเร็จ: ${deleteAuthError.message}`);
    }

    return NextResponse.json({ message: "ลบบัญชีและข้อมูลทั้งหมดเรียบร้อยแล้ว", warnings });
  } catch (error: unknown) {
    console.error("Delete account error:", error);
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}