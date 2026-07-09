import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const ADMIN_ROLES = ['BOSS', 'MANAGER', 'PURCHASER'];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { materials: { where: { active: true } } } } },
  });

  return NextResponse.json({
    categories: categories.map((c) => ({
      id: c.id, name: c.name, icon: c.icon,
      sortOrder: c.sortOrder,
      count: c._count.materials,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  try {
    const { name, icon } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: '名称不能为空' }, { status: 400 });
    const exists = await prisma.category.findUnique({ where: { name: name.trim() } });
    if (exists) return NextResponse.json({ error: '该分类已存在' }, { status: 400 });
    const maxSort = await prisma.category.aggregate({ _max: { sortOrder: true } });
    const category = await prisma.category.create({
      data: { name: name.trim(), icon: icon || null, sortOrder: (maxSort._max.sortOrder || 0) + 1 },
    });
    return NextResponse.json({ success: true, category });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '创建失败' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  try {
    const { id, name, icon } = await req.json();
    if (!id || !name?.trim()) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    const category = await prisma.category.update({
      where: { id },
      data: { name: name.trim(), icon: icon || null },
    });
    return NextResponse.json({ success: true, category });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '更新失败' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: '缺少ID' }, { status: 400 });
    // 检查是否有关联辅料
    const count = await prisma.material.count({ where: { categoryId: id, active: true } });
    if (count > 0) return NextResponse.json({ error: `该分类下有 ${count} 种辅料，请先删除辅料` }, { status: 400 });
    // 检查是否有非active的辅料也关联
    const allCount = await prisma.material.count({ where: { categoryId: id } });
    if (allCount > 0) {
      return NextResponse.json({ error: `该分类下还有辅料记录，无法删除` }, { status: 400 });
    }
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '删除失败' }, { status: 400 });
  }
}
