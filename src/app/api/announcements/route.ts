import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/announcements - public, returns active announcements
export async function GET() {
  const list = await prisma.announcement.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(list);
}