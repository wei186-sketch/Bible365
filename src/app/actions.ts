"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { audioDiskPath } from "@/lib/storage";
import { verifyToken } from "@/lib/jwt";

export async function uploadAudio(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return { error: "????" };

  const payload = verifyToken(token);
  if (!payload) return { error: "?????" };

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return { error: "?????" };

  const file = formData.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "??????" };
  }

  const fileName = file.name || "audio.mp3";
  const ext = path.extname(fileName).toLowerCase();
  if (![".mp3", ".m4a", ".wav", ".webm"].includes(ext)) {
    return { error: "??? mp3/m4a/wav/webm" };
  }
  if (file.size > 200 * 1024 * 1024) {
    return { error: "??????200MB" };
  }

  const folder = audioDiskPath(user.id);
  await mkdir(folder, { recursive: true });
  const diskName = `${Date.now()}-${randomUUID()}${ext}`;
  const diskPath = path.join(folder, diskName);
  const rel = path.relative(process.cwd(), diskPath).replaceAll("\\", "/");

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, buf);

  const audio = await prisma.audio.create({
    data: {
      ownerId: user.id,
      source: "USER",
      originalName: fileName,
      filePath: rel,
      visibility: "PUBLIC",
    },
  });

  return { ok: true, audio: { id: audio.id, originalName: audio.originalName } };
}
