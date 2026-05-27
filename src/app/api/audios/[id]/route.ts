import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { writeAuditLog } from "@/lib/auditLog";

function contentTypeByName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".wav") return "audio/wav";
  return "audio/mpeg";
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser(req);
  if (!me) return NextResponse.json({ error: "Please login first" }, { status: 401 });

  const { id } = await ctx.params;
  const audio = await prisma.audio.findUnique({ where: { id: Number(id) } });
  if (!audio) return NextResponse.json({ error: "Audio not found" }, { status: 404 });

  const canAccess = audio.visibility === "PUBLIC" || audio.ownerId === me.id || me.role === "ADMIN";
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const filePath = path.join(/* turbopackIgnore: true */ process.cwd(), audio.filePath);
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(filePath));
  } catch {
    return NextResponse.json({ error: "Audio file missing" }, { status: 404 });
  }
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);

  const safeFileName = encodeURIComponent(audio.originalName);
  return new NextResponse(new Blob([ab]), {
    headers: {
      "Content-Type": contentTypeByName(audio.originalName),
      "Content-Disposition": `attachment; filename*=UTF-8''${safeFileName}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser(req);
  if (!me) return NextResponse.json({ error: "Please login first" }, { status: 401 });

  const { id } = await ctx.params;
  const audio = await prisma.audio.findUnique({ where: { id: Number(id) } });
  if (!audio) return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  if (audio.ownerId !== me.id && me.role !== "ADMIN") {
    return NextResponse.json({ error: "Can only delete your own audio" }, { status: 403 });
  }

  await prisma.audio.delete({ where: { id: audio.id } });
  try {
    await unlink(path.join(/* turbopackIgnore: true */ process.cwd(), audio.filePath));
  } catch {
    // Ignore missing file after DB row was removed.
  }

  if (me.role === "ADMIN" && audio.ownerId !== me.id) {
    await writeAuditLog({
      adminId: me.id,
      adminName: me.name,
      action: "delete_audio",
      target: audio.originalName,
    });
  }

  return NextResponse.json({ ok: true });
}
