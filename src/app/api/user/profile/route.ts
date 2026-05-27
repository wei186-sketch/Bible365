import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// PATCH /api/user/profile - self-service profile update
export async function PATCH(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "setNickname") {
    const nickname = body.nickname ? String(body.nickname).trim() : null;
    if (nickname && nickname.length > 20) {
      return NextResponse.json({ error: "昵称不能超过20个字符" }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: me.id },
      data: { nickname },
    });
    return NextResponse.json({ ok: true, nickname });
  }

  return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
}