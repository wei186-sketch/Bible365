import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [users, checkins, topUsers] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.checkin.count(),
    prisma.user.findMany({
      where: { role: "USER" },
      select: {
        id: true,
        name: true,
        _count: { select: { checkins: true } },
      },
      orderBy: { checkins: { _count: "desc" } },
      take: 10,
    }),
  ]);

  return NextResponse.json({ users, checkins, topUsers });
}

