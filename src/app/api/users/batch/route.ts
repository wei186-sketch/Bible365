import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { currentUser } from '@/lib/session';
import { writeAuditLog } from '@/lib/auditLog';

export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: '只有管理员可以批量导入用户' }, { status: 403 });
  }

  const contentType = req.headers.get('content-type') || '';

  // CSV file upload
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: '未上传文件' }, { status: 400 });

    const csvText = await file.text();
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return NextResponse.json({ error: 'CSV至少需要标题行和一行数据' }, { status: 400 });

    const headers = lines[0].split(',').map((h: string) => h.trim());
    const accountIdx = headers.indexOf('account');
    const nameIdx = headers.indexOf('name');
    if (accountIdx === -1 || nameIdx === -1) {
      return NextResponse.json({ error: 'CSV必须包含 account 和 name 列' }, { status: 400 });
    }
    const nicknameIdx = headers.indexOf('nickname');
    const passwordIdx = headers.indexOf('password');
    const deptIdx = headers.indexOf('departmentId');

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const sampleAccounts: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',').map((c: string) => c.trim());
      const account = cols[accountIdx] || '';
      const name = cols[nameIdx] || '';
      if (!account || !name) { skipped++; continue; }

      const nickname = nicknameIdx >= 0 ? (cols[nicknameIdx] || null) : null;
      const password = passwordIdx >= 0 ? (cols[passwordIdx] || '123456') : '123456';
      let departmentId: number | null = null;
      if (deptIdx >= 0 && cols[deptIdx]) {
        const dept = await prisma.department.findFirst({ where: { name: cols[deptIdx] } });
        if (dept) departmentId = dept.id;
      }

      try {
        await prisma.user.create({
          data: {
            account, name,
            nickname: nickname || null,
            password: hashPassword(password),
            role: 'USER',
            departmentId,
          },
        });
        created++;
        if (sampleAccounts.length < 3) sampleAccounts.push(account);
      } catch (e: any) {
        if (e?.code === 'P2002') { skipped++; }
        else { errors.push(account + ': ' + (e?.message || 'unknown')); }
      }
    }

    await writeAuditLog({ adminId: me.id, adminName: me.name, action: 'csv_import_users', target: 'CSV', detail: 'created=' + created + ', skipped=' + skipped });
    return NextResponse.json({ created, skipped, errors: errors.slice(0, 10), sampleAccounts, message: '导入完成' });
  }

  // Original JSON batch create
  const body = await req.json().catch(() => ({}));
  const count = Math.max(1, Math.min(100, Number(body.count) || 100));
  const prefix = String(body.prefix || 'user').trim();
  const namePrefix = String(body.namePrefix || prefix).trim();
  const password = String(body.password || '123456').trim();
  const startIndex = Math.max(1, Number(body.startIndex) || 1);

  if (!prefix || !password) {
    return NextResponse.json({ error: 'prefix/password 必填' }, { status: 400 });
  }

  const createdUsers: string[] = [];
  for (let i = 0; i < count; i++) {
    const n = String(startIndex + i).padStart(3, '0');
    try {
      await prisma.user.create({ data: { account: prefix + n, name: namePrefix + n, password: hashPassword(password), role: 'USER' } });
      createdUsers.push(prefix + n);
    } catch {
      // skip duplicate
    }
  }

  return NextResponse.json({ requested: count, created: createdUsers.length, defaultPassword: password, sampleAccounts: createdUsers.slice(0, 3) });
}

export async function PUT(req: NextRequest) {
  const me = await currentUser(req);
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: '只有管理员可以批量修改用户' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: '未上传文件' }, { status: 400 });

  const csvText = await file.text();
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return NextResponse.json({ error: 'CSV至少需要标题行和一行数据' }, { status: 400 });

  const headers = lines[0].split(',').map((h: string) => h.trim());
  const accountIdx = headers.indexOf('account');
  if (accountIdx === -1) {
    return NextResponse.json({ error: 'CSV必须包含 account 列' }, { status: 400 });
  }

  let updated = 0;
  let notFound = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',').map((c: string) => c.trim());
    const account = cols[accountIdx] || '';
    if (!account) { notFound++; continue; }

    const user = await prisma.user.findUnique({ where: { account } });
    if (!user) { notFound++; continue; }

    const data: any = {};

    const nameIdx = headers.indexOf('name');
    if (nameIdx >= 0 && cols[nameIdx]) data.name = cols[nameIdx];

    const nicknameIdx = headers.indexOf('nickname');
    if (nicknameIdx >= 0) data.nickname = cols[nicknameIdx] || null;

    const pwdIdx = headers.indexOf('password');
    if (pwdIdx >= 0 && cols[pwdIdx]) data.password = hashPassword(cols[pwdIdx]);

    const deptIdx = headers.indexOf('departmentId');
    if (deptIdx >= 0) {
      if (cols[deptIdx]) {
        const dept = await prisma.department.findFirst({ where: { name: cols[deptIdx] } });
        data.departmentId = dept ? dept.id : null;
      } else {
        data.departmentId = null;
      }
    }

    const newAccIdx = headers.indexOf('newAccount');
    if (newAccIdx >= 0 && cols[newAccIdx]) {
      const exist = await prisma.user.findUnique({ where: { account: cols[newAccIdx] } });
      if (exist && exist.id !== user.id) {
        errors.push(account + ': 新登录名已被占用');
        continue;
      }
      data.account = cols[newAccIdx];
    }

    if (Object.keys(data).length === 0) continue;

    try {
      await prisma.user.update({ where: { id: user.id }, data });
      updated++;
    } catch (e: any) {
      errors.push(account + ': ' + (e?.message || 'unknown'));
    }
  }

  await writeAuditLog({ adminId: me.id, adminName: me.name, action: 'csv_modify_users', target: 'CSV', detail: 'updated=' + updated + ', notFound=' + notFound });

  return NextResponse.json({
    updated, notFound,
    errors: errors.slice(0, 10),
    message: '修改完成: 更新' + updated + '个, 未找到' + notFound + '个',
  });
}