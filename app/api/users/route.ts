import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

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
    const { id, name } = await req.json();
    if (!id || !name?.trim()) return NextResponse.json({ error: '参数不完整' }, { status: 400 });

    const user = await prisma.user.update({
      where: { id },
      data: { name: name.trim() },
      select: { id: true, username: true, name: true, role: true },
    });

    return NextResponse.json({ success: true, user });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '更新失败' }, { status: 400 });
  }
}
