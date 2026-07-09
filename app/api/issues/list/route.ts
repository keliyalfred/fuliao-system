import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope') || 'all';
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
  const type = searchParams.get('type');

  const where: any = {};
  if (scope === 'mine') where.userId = session.userId;
  if (type) where.type = type;
  const materialId = searchParams.get('materialId');
  if (materialId) where.materialId = materialId;

  const issues = await prisma.issue.findMany({
    where,
    include: { material: { include: { category: true } }, user: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({
    issues: issues.map((i) => ({
      id: i.id,
      type: i.type,
      materialName: i.material.name,
      materialCode: i.material.code,
      categoryName: i.material.category.name,
      unit: i.material.unit,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      userName: i.user.name,
      styleCode: i.styleCode,
      note: i.note,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}
