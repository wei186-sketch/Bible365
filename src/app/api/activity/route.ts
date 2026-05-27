import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/activity - recent checkin activity feed
export async function GET(req: NextRequest) {
  const feed = await prisma.checkin.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, name: true, nickname: true } },
      audio: { select: { id: true, originalName: true } },
      planDay: { select: { dayIndex: true, title: true } },
    },
  });

  const items = feed.map((c) => {
    const d = new Date(new Date().getFullYear(), 0, c.planDay.dayIndex);
    const monthDay = `${d.getMonth() + 1}月${d.getDate()}日`;
    const displayName = c.user.nickname ? `${c.user.nickname}（${c.user.name}）` : c.user.name;

    return {
      id: c.id,
      displayName,
      monthDay,
      audioName: c.audio.originalName,
      dayIndex: c.planDay.dayIndex,
      dayTitle: c.planDay.title,
      time: c.createdAt.toISOString(),
    };
  });

  return NextResponse.json(items);
}