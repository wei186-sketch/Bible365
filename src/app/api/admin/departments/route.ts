import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { writeAuditLog } from "@/lib/auditLog";

function requireAdmin(me: Awaited<ReturnType<typeof currentUser>>) {
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以操作" }, { status: 403 });
  }
  return null;
}

// GET /api/admin/departments - list all departments
export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  const err = requireAdmin(me);
  if (err) return err;

  const depts = await prisma.department.findMany({
    include: {
      children: true,
      _count: { select: { users: true } },
    },
    orderBy: { id: "asc" },
  });

  return NextResponse.json(depts);
}

// POST /api/admin/departments - create department
export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  const err = requireAdmin(me);
  if (err) return err;

  const body = await req.json();
  const name = String(body.name || "").trim();
  const parentId = body.parentId ? Number(body.parentId) : null;

  if (!name) {
    return NextResponse.json({ error: "部门名称不能为空" }, { status: 400 });
  }

  if (parentId !== null) {
    const parent = await prisma.department.findUnique({ where: { id: parentId } });
    if (!parent) return NextResponse.json({ error: "父部门不存在" }, { status: 404 });
    if (parent.parentId !== null) {
      return NextResponse.json({ error: "只能创建两级部门，不能在二级部门下再创建" }, { status: 400 });
    }
  }

  const dept = await prisma.department.create({
    data: { name, parentId },
    include: { children: true, _count: { select: { users: true } } },
  });

  await writeAuditLog({
    adminId: me!.id,
    adminName: me!.name,
    action: "create_department",
    target: name,
    detail: parentId ? `parentId=${parentId}` : "level1",
  });

  return NextResponse.json(dept, { status: 201 });
}