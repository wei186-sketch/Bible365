import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { writeAuditLog } from "@/lib/auditLog";

// GET /api/admin/announcements
export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以操作" }, { status: 403 });
  }
  const list = await prisma.announcement.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(list);
}

// POST /api/admin/announcements
export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以操作" }, { status: 403 });
  }

  const body = await req.json();
  const content = String(body.content || "").trim();
  if (!content) {
    return NextResponse.json({ error: "公告内容不能为空" }, { status: 400 });
  }

  const ann = await prisma.announcement.create({
    data: {
      content,
      imageUrl: body.imageUrl || null,
      active: body.active !== false,
      sortOrder: Number(body.sortOrder) || 0,
    },
  });

  await writeAuditLog({
    adminId: me.id,
    adminName: me.name,
    action: "create_announcement",
    target: content.slice(0, 50),
  });

  return NextResponse.json(ann, { status: 201 });
}