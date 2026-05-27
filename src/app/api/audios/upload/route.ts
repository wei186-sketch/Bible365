import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audioDiskPath } from "@/lib/storage";
import { currentUser } from "@/lib/session";

export const maxDuration = 300;

async function readBody(req: NextRequest): Promise<Buffer> {
  const reader = req.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function parseMultipart(raw: Buffer, boundary: string): Record<string, { filename?: string; data: Buffer }> {
  const result: Record<string, { filename?: string; data: Buffer }> = {};
  const delim = boundary.startsWith("--") ? boundary : "--" + boundary;
  const delimBuf = Buffer.from(delim);
  const endDelimBuf = Buffer.from(delim + "--");
  const crlf = Buffer.from("\r\n");
  const doubleCrlf = Buffer.from("\r\n\r\n");
  let pos = raw.indexOf(delimBuf);
  if (pos === -1) return result;
  pos += delimBuf.length;
  if (pos + 2 <= raw.length && raw.subarray(pos, pos + 2).equals(crlf)) pos += 2;

  function parsePart(bodyStart: number, bodyEnd: number) {
    const headerEnd = raw.indexOf(doubleCrlf, pos);
    if (headerEnd === -1 || headerEnd >= bodyEnd) return;
    const headerStr = raw.subarray(pos, headerEnd).toString("utf-8");
    const dataStart = headerEnd + 4;
    if (bodyEnd > dataStart) {
      const body = raw.subarray(dataStart, bodyEnd);
      const nameMatch = headerStr.match(/name="([^"]+)"/);
      const filenameMatch = headerStr.match(/filename="([^"]+)"/);
      if (nameMatch) result[nameMatch[1]] = { filename: filenameMatch ? filenameMatch[1] : undefined, data: body };
    }
  }

  while (pos < raw.length) {
    const endCheck = raw.indexOf(endDelimBuf, pos);
    const nextDelim = raw.indexOf(delimBuf, pos);
    if (endCheck !== -1 && (nextDelim === -1 || endCheck <= nextDelim)) {
      parsePart(pos, endCheck - 2);
      break;
    }
    if (nextDelim === -1) break;
    parsePart(pos, nextDelim - 2);
    pos = nextDelim + delimBuf.length;
    if (pos + 2 <= raw.length && raw.subarray(pos, pos + 2).equals(crlf)) pos += 2;
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const me = await currentUser(req);
    if (!me) return NextResponse.json({ error: "\u8bf7\u5148\u767b\u5f55" }, { status: 401 });

    const contentType = req.headers.get("content-type") || "";
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      return NextResponse.json({ error: "\u65e0\u6548\u7684\u4e0a\u4f20\u683c\u5f0f" }, { status: 400 });
    }
    const boundary = boundaryMatch[1].trim();

    const rawBody = await readBody(req);
    const parts = parseMultipart(rawBody, boundary);

    const filePart = parts["audio"];
    if (!filePart || filePart.data.length === 0) {
      return NextResponse.json({ error: "\u7f3a\u5c11\u97f3\u9891\u6587\u4ef6" }, { status: 400 });
    }

    const fileName = filePart.filename || "audio.mp3";
    const ext = path.extname(fileName).toLowerCase();
    if (![".mp3", ".m4a", ".wav", ".webm"].includes(ext)) {
      return NextResponse.json({ error: "\u4ec5\u652f\u6301 mp3/m4a/wav/webm" }, { status: 400 });
    }
    if (filePart.data.length > 200 * 1024 * 1024) {
      return NextResponse.json({ error: "\u6587\u4ef6\u4e0d\u80fd\u8d85\u8fc7200MB" }, { status: 400 });
    }

    const folder = audioDiskPath(me.id);
    await mkdir(folder, { recursive: true });
    const diskName = `${Date.now()}-${randomUUID()}${ext}`;
    const diskPath = path.join(folder, diskName);
    const rel = path.relative(process.cwd(), diskPath).replaceAll("\\", "/");
    await writeFile(diskPath, filePart.data);

    const audio = await prisma.audio.create({
      data: {
        ownerId: me.id,
        source: "USER",
        originalName: fileName,
        filePath: rel,
        visibility: "PUBLIC",
      },
    });

    return NextResponse.json(audio, { status: 201 });
  } catch (error) {
    console.error("User upload error:", error);
    return NextResponse.json({ error: "\u4e0a\u4f20\u5931\u8d25: " + (error as Error).message }, { status: 500 });
  }
}
