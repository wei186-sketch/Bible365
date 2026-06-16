import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { issueToken } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const account = String(body.account || "").trim();
    const password = String(body.password || "").trim();

    if (!account || !password) {
      return NextResponse.json({ error: "帐号密码不能为空" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { account },
      select: { id: true, name: true, nickname: true, account: true, role: true, isBlocked: true, password: true },
    });
    if (!user || user.password !== hashPassword(password)) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }
    if (user.isBlocked) {
      return NextResponse.json({ error: "帐号已被封禁，请联系管理员" }, { status: 403 });
    }

    const token = issueToken({ sub: user.id, account: user.account, role: user.role });
    const res = NextResponse.json({
      id: user.id, name: user.name, nickname: user.nickname, role: user.role, account: user.account,
    });
    res.cookies.set("session", token, {
      httpOnly: true, sameSite: "lax",
      secure: false,
      path: "/", maxAge: 7 * 24 * 60 * 60,
    });
    return res;
  } catch (error) {
    console.error("POST /api/auth/login failed:", error);
    return NextResponse.json({ error: "数据库连接失败，请先启动数据库服务" }, { status: 503 });
  }
}