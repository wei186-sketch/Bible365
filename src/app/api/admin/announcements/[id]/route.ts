import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { writeAuditLog } from "@/lib/auditLog";

// PATCH /api/admin/announcements/[id]
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以操作" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const ann = await prisma.announcement.update({
    where: { id: Number(id) },
    data: {
      ...(body.content !== undefined ? { content: String(body.content).trim() } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl || null } : {}),
      ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
    },
  });

  await writeAuditLog({
    adminId: me.id,
    adminName: me.name,
    action: "update_announcement",
    target: `id=${id}`,
  });

  return NextResponse.json(ann);
}

// DELETE /api/admin/announcements/[id]
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以操作" }, { status: 403 });
  }

  const { id } = await ctx.params;
  await prisma.announcement.delete({ where: { id: Number(id) } });

  await writeAuditLog({
    adminId: me.id,
    adminName: me.name,
    action: "delete_announcement",
    target: `id=${id}`,
  });

  return NextResponse.json({ ok: true });
}