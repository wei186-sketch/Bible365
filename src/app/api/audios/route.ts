import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const scope = req.nextUrl.searchParams.get("scope") || "all";

  const deptFilter: Record<string, unknown>[] = [];
  deptFilter.push({ visibility: "PUBLIC" });
  deptFilter.push({ ownerId: me.id });

  if (me.departmentId) {
    const myDept = await prisma.department.findUnique({
      where: { id: me.departmentId },
      select: { parentId: true },
    });
    if (myDept) {
      if (myDept.parentId === null) {
        const childIds = (await prisma.department.findMany({
          where: { parentId: me.departmentId },
          select: { id: true },
        })).map(d => d.id);
        const deptUserIds = (await prisma.user.findMany({
          where: { departmentId: { in: [me.departmentId, ...childIds] } },
          select: { id: true },
        })).map(u => u.id);
        deptFilter.push({ ownerId: { in: deptUserIds } });
      } else {
        const siblingUserIds = (await prisma.user.findMany({
          where: {
            department: {
              OR: [{ id: myDept.parentId }, { parentId: myDept.parentId }],
            },
          },
          select: { id: true },
        })).map(u => u.id);
        deptFilter.push({ ownerId: { in: siblingUserIds } });
      }
    }
  }

  const where = scope === "mine" ? { ownerId: me.id } : { OR: deptFilter };

  const rows = await prisma.audio.findMany({
    where: where as never,
    include: {
      owner: { select: { id: true, name: true, nickname: true, account: true, departmentId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json(rows);
}
