import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadRoot } from "@/lib/storage";
import { currentUser } from "@/lib/session";
import { writeAuditLog } from "@/lib/auditLog";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以上传" }, { status: 403 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "缺少音频文件" }, { status: 400 });
    }
    const subfolder = String(formData.get("subfolder") || "").trim().replace(/[<>:"/\\|?*]/g, "_");
    const folder = subfolder ? path.join(uploadRoot, "admin", subfolder) : path.join(uploadRoot, "admin");
    await mkdir(folder, { recursive: true });
    const ext = path.extname(file.name).toLowerCase() || ".mp3";
    const name = `${Date.now()}-${randomUUID()}${ext}`;
    const diskPath = path.join(folder, name);
    const rel = path.relative(process.cwd(), diskPath).replaceAll("\\", "/");
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(diskPath, buf);
    const audio = await prisma.audio.create({
      data: { ownerId: me.id, source: "ADMIN", originalName: file.name, filePath: rel, visibility: "PUBLIC" },
    });
    await writeAuditLog({ adminId: me.id, adminName: me.name, action: "upload_public_file", target: file.name });
    return NextResponse.json(audio, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "上传失败: " + (error as Error).message }, { status: 500 });
  }
}