import { randomUUID } from "node:crypto";
import { copyFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { writeAuditLog } from "@/lib/auditLog";

// PATCH /api/admin/files/[id] - rename file / set folder
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") return NextResponse.json({ error: "只有管理员可以操作" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json();
  const action = String(body.action || "");

  if (action === "rename") {
    const newName = String(body.name || "").trim();
    if (!newName) return NextResponse.json({ error: "文件名不能为空" }, { status: 400 });
    const audio = await prisma.audio.update({
      where: { id: Number(id) },
      data: { originalName: newName },
    });
    await writeAuditLog({ adminId: me.id, adminName: me.name, action: "rename_file", target: newName });
    return NextResponse.json(audio);
  }

  if (action === "setFolder") {
    const folder = body.folder ? String(body.folder).trim() : null;
    const audio = await prisma.audio.update({
      where: { id: Number(id) },
      data: { folder },
    });
    return NextResponse.json(audio);
  }

  return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
}

// POST /api/admin/files/[id] - copy file
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") return NextResponse.json({ error: "只有管理员可以操作" }, { status: 403 });

  const { id } = await ctx.params;
  const original = await prisma.audio.findUnique({ where: { id: Number(id) } });
  if (!original) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  const ext = path.extname(original.filePath);
  const folder = path.dirname(original.filePath);
  const newName = `copy-${Date.now()}-${randomUUID()}${ext}`;
  const newDiskPath = path.join(folder, newName);
  const rel = path.relative(process.cwd(), newDiskPath).replaceAll("\\", "/");

  await mkdir(path.dirname(newDiskPath), { recursive: true });
  await copyFile(path.join(process.cwd(), original.filePath), newDiskPath);

  const copy = await prisma.audio.create({
    data: {
      ownerId: me.id,
      source: "ADMIN",
      originalName: `${original.originalName} (副本)`,
      filePath: rel,
      folder: original.folder,
      visibility: original.visibility,
    },
  });

  await writeAuditLog({ adminId: me.id, adminName: me.name, action: "copy_file", target: original.originalName });
  return NextResponse.json(copy, { status: 201 });
}