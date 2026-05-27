import { prisma } from "@/lib/prisma";

export async function writeAuditLog(params: {
  adminId: number;
  adminName: string;
  action: string;
  target: string;
  detail?: string;
}) {
  await prisma.auditLog.create({
    data: {
      adminId: params.adminId,
      adminName: params.adminName,
      action: params.action,
      target: params.target,
      detail: params.detail ?? null,
    },
  });
}