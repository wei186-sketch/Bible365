import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const oldPassword = String(body.oldPassword || "").trim();
  const newPassword = String(body.newPassword || "").trim();

  if (!oldPassword || !newPassword) {
    return NextResponse.json({ error: "旧密码和新密码不能为空" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "新密码至少6位" }, { status: 400 });
  }
  if (hashPassword(oldPassword) !== me.password) {
    return NextResponse.json({ error: "旧密码错误" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: me.id },
    data: { password: hashPassword(newPassword) },
  });

  return NextResponse.json({ ok: true });
}
