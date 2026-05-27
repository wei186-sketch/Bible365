import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function POST() {
  try {
    const hasUsers = await prisma.user.count();

    if (hasUsers > 0) {
      return NextResponse.json({ ok: true, message: "already initialized" });
    }

    const days = Array.from({ length: 365 }).map((_, i) => ({
      dayIndex: i + 1,
      title: `第${i + 1}天`,
      scripture: "请在后台补充经文内容",
    }));

    await prisma.$transaction([
      prisma.user.create({
        data: {
          name: "管理员",
          account: "admin",
          password: hashPassword("admin123"),
          role: "ADMIN",
        },
      }),
      prisma.planDay.createMany({ data: days }),
    ]);

    return NextResponse.json({ ok: true, adminAccount: "admin", adminPassword: "admin123" });
  } catch (error) {
    console.error("POST /api/bootstrap failed:", error);
    return NextResponse.json({ error: "数据库连接失败，请先启动数据库服务" }, { status: 503 });
  }
}

