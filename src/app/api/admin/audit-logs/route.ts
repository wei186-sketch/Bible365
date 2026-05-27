import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

// GET /api/admin/audit-logs - list audit logs with optional filters
export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以操作" }, { status: 403 });
  }

  const url = req.nextUrl;
  const action = url.searchParams.get("action") || undefined;
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 50));

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
    if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate + "T23:59:59.999Z");
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where: where as never }),
    prisma.auditLog.findMany({
      where: where as never,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ total, page, pageSize, logs });
}