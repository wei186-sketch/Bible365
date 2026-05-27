import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { currentUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以批量导入用户" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const count = Math.max(1, Math.min(100, Number(body.count) || 100));
  const prefix = String(body.prefix || "user").trim();
  const namePrefix = String(body.namePrefix || prefix).trim();
  const password = String(body.password || "123456").trim();
  const startIndex = Math.max(1, Number(body.startIndex) || 1);

  if (!prefix || !password) {
    return NextResponse.json({ error: "prefix/password 必填" }, { status: 400 });
  }

  const createdUsers: string[] = [];
  for (let i = 0; i < count; i++) {
    const n = String(startIndex + i).padStart(3, "0");
    const account = `${prefix}${n}`;
    const name = `${namePrefix}${n}`;
    try {
      await prisma.user.create({
        data: {
          account,
          name,
          password: hashPassword(password),
          role: "USER",
        },
      });
      createdUsers.push(account);
    } catch {
      // skip duplicate
    }
  }

  return NextResponse.json({
    requested: count,
    created: createdUsers.length,
    defaultPassword: password,
    sampleAccounts: createdUsers.slice(0, 3),
  });
}