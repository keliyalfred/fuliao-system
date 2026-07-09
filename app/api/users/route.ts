import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, username: true, name: true, role: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ users });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (session.role !== 'BOSS') {
    return NextResponse.json({ error: '只有老板可以修改用户信息' }, { status: 403 });
  }

  try {
    const { id, name, newPassword } = await req.json();
    if (!id) return NextResponse.json({ error: '缺少ID' }, { status: 400 });
    const data: any = {};
    if (name !== undefined) {
      if (!name?.trim()) return NextResponse.json({ error: '姓名不能为空' }, { status: 400 });
      data.name = name.trim();
    }
    if (newPassword) {
      if (String(newPassword).length < 6) return NextResponse.json({ error: '密码至少6位' }, { status: 400 });
      data.password = await bcrypt.hash(newPassword, 10);
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: '没有要修改的字段' }, { status: 400 });

    const user = await prisma.user.update({
      where: { id }, data,
      select: { id: true, username: true, name: true, role: true },
    });

    return NextResponse.json({ success: true, user, message: newPassword ? '密码已重置' : '姓名已修改' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '更新失败' }, { status: 400 });
  }
}
