import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get("limit")) || 100));
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const users = await prisma.user.findMany({
    where: { role: "USER", isBlocked: false },
    select: {
      id: true, name: true, nickname: true, account: true,
      _count: { select: { checkins: true } },
      checkins: {
        where: { checkinDate: { gte: dayStart, lt: dayEnd } },
        orderBy: { checkinDate: "asc" },
        take: 1,
        select: { checkinDate: true },
      },
    },
  });

  const sorted = users.sort((a, b) => {
    const diffCount = b._count.checkins - a._count.checkins;
    if (diffCount !== 0) return diffCount;
    const aTime = a.checkins[0]?.checkinDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const bTime = b.checkins[0]?.checkinDate?.getTime() ?? Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return a.id - b.id;
  });

  return NextResponse.json(
    sorted.slice(0, limit).map((u, idx) => ({
      rank: idx + 1,
      id: u.id,
      name: u.name,
      nickname: u.nickname,
      account: u.account,
      checkins: u._count.checkins,
      todayCheckinAt: u.checkins[0]?.checkinDate ?? null,
    })),
  );
}