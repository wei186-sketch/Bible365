import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { writeAuditLog } from "@/lib/auditLog";

// GET /api/admin/files - list all files (admin view)
export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") return NextResponse.json({ error: "只有管理员可以操作" }, { status: 403 });

  const rows = await prisma.audio.findMany({
    where: { source: "ADMIN" },

    include: { owner: { select: { id: true, name: true, nickname: true, account: true } } },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return NextResponse.json(rows);
}

// POST /api/admin/files - folder operations
export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") return NextResponse.json({ error: "只有管理员可以操作" }, { status: 403 });

  const body = await req.json();
  const action = String(body.action || "");

  if (action === "renameFolder") {
    const oldName = String(body.oldName || "").trim();
    const newName = String(body.newName || "").trim();
    if (!oldName || !newName) return NextResponse.json({ error: "oldName/newName 必填" }, { status: 400 });
    const result = await prisma.audio.updateMany({
      where: { folder: oldName },
      data: { folder: newName },
    });
    await writeAuditLog({ adminId: me.id, adminName: me.name, action: "rename_folder", target: `${oldName} -> ${newName}`, detail: `affected=${result.count}` });
    return NextResponse.json({ ok: true, affected: result.count });
  }

  if (action === "deleteFolder") {
    const folderName = String(body.folderName || "").trim();
    if (!folderName) return NextResponse.json({ error: "folderName 必填" }, { status: 400 });
    const result = await prisma.audio.updateMany({
      where: { folder: folderName },
      data: { folder: null },
    });
    await writeAuditLog({ adminId: me.id, adminName: me.name, action: "delete_folder", target: folderName, detail: `affected=${result.count}` });
    return NextResponse.json({ ok: true, affected: result.count });
  }

  return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
}