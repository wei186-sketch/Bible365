import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

// GET /api/checkins/grid - yearly 365-grid for current user
export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const userId = Number(req.nextUrl.searchParams.get("userId") || me.id);

  // Allow admin or same-department users
  if (userId !== me.id && me.role !== "ADMIN") {
    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
    if (!targetUser || !me.departmentId || targetUser.departmentId !== me.departmentId) {
      return NextResponse.json({ error: "无权查看他人打卡网格" }, { status: 403 });
    }
  }

  const checkins = await prisma.checkin.findMany({
    where: { userId },
    select: { planDay: { select: { dayIndex: true } }, checkinDate: true },
  });

  const grid: Record<number, string | null> = {};
  for (let d = 1; d <= 365; d++) grid[d] = null;
  for (const c of checkins) {
    grid[c.planDay.dayIndex] = c.checkinDate.toISOString();
  }

  return NextResponse.json(grid);
}