import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/auditLog";


export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以删除用户" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "无效用户ID" }, { status: 400 });
  }
  if (userId === me.id) {
    return NextResponse.json({ error: "不能删除自己" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  await prisma.checkin.deleteMany({ where: { userId } });
  await prisma.audio.deleteMany({ where: { ownerId: userId } });
  await prisma.user.delete({ where: { id: userId } });
  await writeAuditLog({ adminId: me.id, adminName: me.name, action: "delete_user", target: user.account });
  return NextResponse.json({ ok: true, message: "用户已删除" });
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser(req);
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "只有管理员可以操作用户" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "无效用户ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  if (action === "resetPassword") {
    const newPassword = String(body.newPassword || "123456").trim();
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "新密码至少6位" }, { status: 400 });
    }
    await prisma.user.update({ where: { id: userId }, data: { password: hashPassword(newPassword) } });
    await writeAuditLog({ adminId: me.id, adminName: me.name, action: "reset_password", target: user.account });
    return NextResponse.json({ ok: true, message: "密码重置成功" });
  }

  if (action === "setBlocked") {
    const isBlocked = Boolean(body.isBlocked);
    if (user.id === me.id && isBlocked) {
      return NextResponse.json({ error: "不能封禁当前管理员自己" }, { status: 400 });
    }
    await prisma.user.update({ where: { id: userId }, data: { isBlocked } });
    await writeAuditLog({ adminId: me.id, adminName: me.name, action: isBlocked ? "block_user" : "unblock_user", target: user.account });
    return NextResponse.json({ ok: true, isBlocked });
  }

  if (action === "setRole") {
    const role = body.role;
    if (role !== "USER" && role !== "ADMIN") return NextResponse.json({ error: "无效角色" }, { status: 400 });
    await prisma.user.update({ where: { id: userId }, data: { role } });
    await writeAuditLog({ adminId: me.id, adminName: me.name, action: "set_role", target: user.account, detail: `role=${role}` });
    return NextResponse.json({ ok: true, role });
  }

  if (action === "setDepartment") {
    const departmentId = body.departmentId ? Number(body.departmentId) : null;
    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) return NextResponse.json({ error: "部门不存在" }, { status: 404 });
    }
    await prisma.user.update({ where: { id: userId }, data: { departmentId } });
    await writeAuditLog({ adminId: me.id, adminName: me.name, action: "set_department", target: user.account, detail: `deptId=${departmentId ?? "none"}` });
    return NextResponse.json({ ok: true, departmentId });
  }

  if (action === "setNickname") {
    const nickname = body.nickname ? String(body.nickname).trim() : null;
    await prisma.user.update({ where: { id: userId }, data: { nickname } });
    await writeAuditLog({ adminId: me.id, adminName: me.name, action: "set_nickname", target: user.account, detail: `nickname=${nickname ?? "none"}` });
    return NextResponse.json({ ok: true, nickname });
  }

  if (action === "setName") {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "用户名不能为空" }, { status: 400 });
    await prisma.user.update({ where: { id: userId }, data: { name } });
    await writeAuditLog({ adminId: me.id, adminName: me.name, action: "rename_user", target: user.account, detail: `name=${name}` });
    return NextResponse.json({ ok: true, name });
  }

  if (action === "setAccount") {
    const account = String(body.account || "").trim();
    if (!account) return NextResponse.json({ error: "登录名不能为空" }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { account } });
    if (existing && existing.id !== userId) return NextResponse.json({ error: "登录名已被占用" }, { status: 409 });
    await prisma.user.update({ where: { id: userId }, data: { account } });
    await writeAuditLog({ adminId: me.id, adminName: me.name, action: "set_account", target: `${user.account} -> ${account}` });
    return NextResponse.json({ ok: true, account });
  }

  return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
}