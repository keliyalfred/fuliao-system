import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const CAN_EDIT = ['BOSS', 'CUTTER', 'FINANCE'];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const styles = await prisma.style.findMany({
    where: { active: true },
    include: {
      colors: true,
      _count: { select: { beds: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    styles: styles.map((s) => ({
      id: s.id, code: s.code, name: s.name, season: s.season,
      targetPrice: s.targetPrice ? Number(s.targetPrice) : null,
      laborCost: Number(s.laborCost),
      sizes: s.sizes ? JSON.parse(s.sizes) : [],
      colors: s.colors.map((c) => ({ id: c.id, colorCode: c.colorCode, colorName: c.colorName })),
      cuttingCount: s._count.beds,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !CAN_EDIT.includes(session.role)) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  try {
    const { code, name, season, targetPrice, sizes, colors } = await req.json();
    if (!code?.trim() || !name?.trim()) return NextResponse.json({ error: '款号和款名必填' }, { status: 400 });

    // 允许同款号多批次，不做重复检查

    const style = await prisma.style.create({
      data: {
        code: code.trim(), name: name.trim(),
        season: season || null,
        targetPrice: targetPrice || null,
        sizes: sizes ? JSON.stringify(sizes) : null,
        colors: colors?.length ? {
          create: colors.map((c: any) => ({ colorCode: c.colorCode, colorName: c.colorName })),
        } : undefined,
      },
      include: { colors: true },
    });

    return NextResponse.json({ success: true, style });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '创建失败' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || !CAN_EDIT.includes(session.role)) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  try {
    const { id, name, season, targetPrice, sizes } = await req.json();
    if (!id) return NextResponse.json({ error: '缺少ID' }, { status: 400 });

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (season !== undefined) data.season = season || null;
    if (targetPrice !== undefined) data.targetPrice = targetPrice || null;
    if (sizes !== undefined) data.sizes = JSON.stringify(sizes);

    const style = await prisma.style.update({ where: { id }, data });
    return NextResponse.json({ success: true, style });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '更新失败' }, { status: 400 });
  }
}
