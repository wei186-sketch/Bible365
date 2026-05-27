import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const userId = Number(req.nextUrl.searchParams.get("userId") || me.id);

  const rows = await prisma.checkin.findMany({
    where: { userId },
    include: {
      planDay: true,
      audio: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { planDay: { dayIndex: "asc" } },
  });

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json();
  const dayIndex = Number(body.dayIndex);
  const audioId = Number(body.audioId);

  if (!Number.isFinite(dayIndex) || !Number.isFinite(audioId)) {
    return NextResponse.json({ error: "dayIndex 和 audioId 必填" }, { status: 400 });
  }

  const day = await prisma.planDay.findUnique({ where: { dayIndex } });
  if (!day) return NextResponse.json({ error: "计划天不存在" }, { status: 404 });

  const audio = await prisma.audio.findUnique({ where: { id: audioId } });
  if (!audio) return NextResponse.json({ error: "音频不存在" }, { status: 404 });
  if (audio.ownerId !== me.id && me.role !== "ADMIN") {
    return NextResponse.json({ error: "只能用自己的音频打卡" }, { status: 403 });
  }

  // Delete old checkins using the same audio on different days
  await prisma.checkin.deleteMany({
    where: {
      userId: me.id,
      audioId,
      planDayId: { not: day.id },
    },
  });

  const checkin = await prisma.checkin.upsert({
    where: { userId_planDayId: { userId: me.id, planDayId: day.id } },
    update: { audioId, checkinDate: new Date() },
    create: {
      userId: me.id,
      planDayId: day.id,
      audioId,
      checkinDate: new Date(),
    },
    include: { planDay: true, audio: true },
  });

  return NextResponse.json(checkin, { status: 201 });
}

