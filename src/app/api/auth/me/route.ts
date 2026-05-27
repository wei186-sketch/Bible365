import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const dept = me.departmentId
    ? await prisma.department.findUnique({
        where: { id: me.departmentId },
        select: { id: true, name: true, parentId: true },
      })
    : null;

  return NextResponse.json({
    id: me.id,
    name: me.name,
    nickname: me.nickname,
    role: me.role,
    account: me.account,
    departmentId: me.departmentId,
    department: dept,
  });
}