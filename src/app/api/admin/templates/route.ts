import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: '只有管理员可以下载模板' }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get('type') || 'import';

  let csv = '';
  let filename = '';

  if (type === 'users') {
    const users = await prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        account: true, name: true, nickname: true,
        role: true, department: { select: { name: true } },
        isBlocked: true,
      },
    });
    csv = 'account,name,nickname,password,departmentId,newAccount,role,isBlocked\r\n';
    for (const u of users) {
      csv += [
        u.account,
        u.name,
        u.nickname || '',
        '',
        u.department?.name || '',
        '',
        u.role,
        u.isBlocked ? '封禁' : '正常',
      ].join(',') + '\r\n';
    }
    filename = '当前用户列表.csv';
  } else if (type === 'import') {
    csv = 'account,name,nickname,password,departmentId\r\ndemo01,张三,小张,123456,技术部\r\ndemo02,李四,,123456,\r\n';
    filename = '用户导入模板.csv';
  } else {
    csv = 'account,name,nickname,password,departmentId,newAccount\r\ndemo01,张三,小张,123456,技术部,\r\ndemo02,李四,,123456,,demo02_new\r\n';
    filename = '用户修改模板.csv';
  }

  const bom = '\uFEFF';
  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="' + encodeURIComponent(filename) + '"',
    },
  });
}