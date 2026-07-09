import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const styleId = searchParams.get('styleId');
  const where: any = {};
  if (styleId) where.styleId = styleId;

  const batches = await prisma.fabricBatch.findMany({
    where,
    include: { style: true, beds: { select: { bedNo: true, totalPieces: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({
    batches: batches.map((b) => ({
      id: b.id, batchNo: b.batchNo,
      styleCode: b.style.code, styleName: b.style.name,
      bedCount: b.beds.length,
      totalPieces: b.beds.reduce((s, bed) => s + bed.totalPieces, 0),
      note: b.note,
      createdAt: b.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!['BOSS', 'CUTTER'].includes(session.role)) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const { styleId, note } = await req.json();
    if (!styleId) return NextResponse.json({ error: '请选择款号' }, { status: 400 });

    const style = await prisma.style.findUnique({ where: { id: styleId } });
    if (!style) return NextResponse.json({ error: '款式不存在' }, { status: 400 });

    const today = new Date();
    const ds = `${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const styleShort = style.code.replace(/[^A-Za-z0-9]/g, '');
    const prefix = `BL${ds}-${styleShort}`;
    const count = await prisma.fabricBatch.count({ where: { batchNo: { startsWith: prefix } } });
    const batchNo = `${prefix}-${String(count + 1).padStart(2, '0')}`;

    const batch = await prisma.fabricBatch.create({
      data: { batchNo, styleId, note: note || null },
    });

    return NextResponse.json({ success: true, batchNo, batch });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '创建失败' }, { status: 400 });
  }
}
