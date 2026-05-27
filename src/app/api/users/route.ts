import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { currentUser } from "@/lib/session";
import { writeAuditLog } from "@/lib/auditLog";

export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以查看用户列表" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true, name: true, nickname: true, account: true, role: true, isBlocked: true,
      departmentId: true, department: { select: { id: true, name: true } },
      createdAt: true,
    },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以创建用户" }, { status: 403 });
  }

  const body = await req.json();
  const account = String(body.account || "").trim();
  const name = String(body.name || "").trim();
  const nickname = body.nickname ? String(body.nickname).trim() : null;
  const password = String(body.password || "").trim();
  const role = body.role === "ADMIN" ? "ADMIN" as const : "USER" as const;
  const departmentId = body.departmentId ? Number(body.departmentId) : null;

  if (!account || !name || !password) {
    return NextResponse.json({ error: "name/account/password 必填" }, { status: 400 });
  }

  if (departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) return NextResponse.json({ error: "部门不存在" }, { status: 404 });
  }

  const created = await prisma.user.create({
    data: { account, name, nickname: nickname || null, password: hashPassword(password), role, departmentId },
    select: {
      id: true, name: true, nickname: true, account: true, role: true, isBlocked: true,
      departmentId: true, department: { select: { id: true, name: true } },
    },
  });

  await writeAuditLog({
    adminId: me.id,
    adminName: me.name,
    action: "create_user",
    target: account,
    detail: `role=${role}, dept=${departmentId ?? "none"}`,
  });

  return NextResponse.json(created, { status: 201 });
}