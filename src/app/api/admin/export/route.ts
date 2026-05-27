import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以操作" }, { status: 403 });
  }

  const deptId = req.nextUrl.searchParams.get("departmentId");
  const date = req.nextUrl.searchParams.get("date");
  const year = date ? new Date(date).getFullYear() : new Date().getFullYear();

  const where: Prisma.UserWhereInput = { isBlocked: false };
  if (deptId) {
    const dId = Number(deptId);
    const childDeptIds = (await prisma.department.findMany({
      where: { parentId: dId },
      select: { id: true },
    })).map((d) => d.id);
    where.departmentId = { in: [dId, ...childDeptIds] };
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });

  const days = await prisma.planDay.findMany({
    orderBy: { dayIndex: "asc" },
    select: { id: true, dayIndex: true },
  });

  const allCheckins = await prisma.checkin.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      planDayId: { in: days.map((d) => d.id) },
    },
    select: { userId: true, planDayId: true },
  });

  const checkinSet = new Set(allCheckins.map((c) => `${c.userId}_${c.planDayId}`));

  const header = ["用户名", ...days.map((d) => {
    const dt = new Date(year, 0, d.dayIndex);
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  })];
  const rows = users.map((u) => {
    const row = [u.name];
    for (const d of days) {
      row.push(checkinSet.has(`${u.id}_${d.id}`) ? "已打卡" : "未打卡");
    }
    return row;
  });

  const csvLines = [header.join(","), ...rows.map((r) => r.join(","))];
  const csv = "\uFEFF" + csvLines.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bible365_${year}.csv"`,
    },
  });
}