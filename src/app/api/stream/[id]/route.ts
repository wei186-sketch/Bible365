import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const audio = await prisma.audio.findUnique({ where: { id: Number(id) } });
  if (!audio) return NextResponse.json({ error: "audio not found" }, { status: 404 });

  const me = await currentUser(req);
  const isPublic = audio.visibility === "PUBLIC";
  const canAccess = isPublic || (!!me && (audio.ownerId === me.id || me.role === "ADMIN"));
  if (!canAccess) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const abs = path.join(/* turbopackIgnore: true */ process.cwd(), audio.filePath);
  const fileStat = await stat(abs);
  const size = fileStat.size;
  const ext = path.extname(audio.originalName).toLowerCase();
  const contentType = ext === ".m4a" ? "audio/mp4" : ext === ".wav" ? "audio/wav" : "audio/mpeg";
  const range = req.headers.get("range");

  if (!range) {
    const bytes = new Uint8Array(await readFile(abs));
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    return new NextResponse(new Blob([ab]), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return NextResponse.json({ error: "invalid range" }, { status: 416 });

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end >= size) {
    return NextResponse.json({ error: "range not satisfiable" }, { status: 416 });
  }

  const bytes = new Uint8Array(await readFile(abs));
  const chunk = bytes.subarray(start, end + 1);
  const ab = new ArrayBuffer(chunk.byteLength);
  new Uint8Array(ab).set(chunk);
  return new NextResponse(new Blob([ab]), {
    status: 206,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(chunk.length),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=60",
    },
  });
}
