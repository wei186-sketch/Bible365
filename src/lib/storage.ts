import { mkdir } from "node:fs/promises";
import path from "node:path";

export const uploadRoot = path.join(process.cwd(), "uploads");

export async function ensureUploadRoot() {
  await mkdir(uploadRoot, { recursive: true });
}

export function audioDiskPath(userId: number) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return path.join(uploadRoot, String(userId), `${y}-${m}`);
}

