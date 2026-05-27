import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const days = await prisma.planDay.findMany({ orderBy: { dayIndex: "asc" } });
    return NextResponse.json(days);
  } catch (error) {
    console.error("GET /api/plans failed:", error);
    return NextResponse.json({ error: "数据库连接失败，请先启动数据库服务" }, { status: 503 });
  }
}

