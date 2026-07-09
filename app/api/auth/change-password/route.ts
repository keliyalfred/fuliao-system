import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  try {
    const { oldPassword, newPassword } = await req.json();
    if (!oldPassword || !newPassword) return NextResponse.json({ error: '请填写旧密码和新密码' }, { status: 400 });
    if (String(newPassword).length < 6) return NextResponse.json({ error: '新密码至少6位' }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return NextResponse.json({ error: '账号异常' }, { status: 400 });
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return NextResponse.json({ error: '旧密码不正确' }, { status: 400 });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: session.userId }, data: { password: hashed } });
    return NextResponse.json({ success: true, message: '密码修改成功' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '修改失败' }, { status: 400 });
  }
}
