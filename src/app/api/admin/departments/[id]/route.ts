import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { writeAuditLog } from "@/lib/auditLog";

// PATCH /api/admin/departments/[id] - rename or reassign parent
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以操作" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const deptId = Number(id);
  const dept = await prisma.department.findUnique({ where: { id: deptId } });
  if (!dept) return NextResponse.json({ error: "部门不存在" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name = body.name ? String(body.name).trim() : undefined;

  if (name !== undefined) {
    const updated = await prisma.department.update({
      where: { id: deptId },
      data: { name },
    });
    await writeAuditLog({
      adminId: me.id,
      adminName: me.name,
      action: "rename_department",
      target: `${dept.name} -> ${name}`,
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "没有要更新的字段" }, { status: 400 });
}

// DELETE /api/admin/departments/[id] - delete department
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以操作" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const deptId = Number(id);
  const dept = await prisma.department.findUnique({
    where: { id: deptId },
    include: { _count: { select: { users: true } } },
  });
  if (!dept) return NextResponse.json({ error: "部门不存在" }, { status: 404 });

  // Unlink users first
  await prisma.user.updateMany({
    where: { departmentId: deptId },
    data: { departmentId: null },
  });

  // Delete children if level-1
  if (dept.parentId === null) {
    await prisma.user.updateMany({
      where: { department: { parentId: deptId } },
      data: { departmentId: null },
    });
    await prisma.department.deleteMany({ where: { parentId: deptId } });
  }

  await prisma.department.delete({ where: { id: deptId } });

  await writeAuditLog({
    adminId: me.id,
    adminName: me.name,
    action: "delete_department",
    target: dept.name,
    detail: `users=${dept._count.users}`,
  });

  return NextResponse.json({ ok: true });
}