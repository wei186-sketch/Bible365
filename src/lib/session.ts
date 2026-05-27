import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

export async function currentUser(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const id = Number(payload.sub);
  if (!Number.isFinite(id)) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isBlocked) return null;
  return user;
}
