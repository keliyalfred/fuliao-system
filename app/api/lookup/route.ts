import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  // 获取所有款号
  if (type === 'styles') {
    const styles = await prisma.style.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    return NextResponse.json({ items: styles.map((s) => ({ id: s.id, label: `${s.code} ${s.name}` })) });
  }

  // 获取款号下的裁床号
  if (type === 'beds') {
    const styleId = searchParams.get('styleId');
    if (!styleId) return NextResponse.json({ items: [] });
    const beds = await prisma.cuttingBed.findMany({
      where: { styleId },
      include: {
        styleColor: { select: { colorName: true } },
        sizes: { select: { size: true, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({
      items: beds.map((b) => {
        const date = `${b.createdAt.getMonth()+1}/${b.createdAt.getDate()}`;
        const sizeStr = b.sizes.map(s => `${s.size}×${s.quantity}`).join(' ');
        return {
          id: b.id,
          label: `${b.bedNo} | ${date} ${b.styleColor.colorName} ${sizeStr} = ${b.totalPieces}件`,
          bedNo: b.bedNo,
        };
      }),
    });
  }

  // 获取裁床号下的扎号
  if (type === 'bundles') {
    const bedId = searchParams.get('bedId');
    if (!bedId) return NextResponse.json({ items: [] });
    const bundles = await prisma.bundle.findMany({
      where: { bedId },
      select: { id: true, bundleNo: true, color: true, size: true, quantity: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({
      items: bundles.map((b) => ({
        id: b.id, label: `第${b.bundleNo}扎 ${b.color || ''} ${b.size || ''} ${b.quantity}件`,
        bundleNo: b.bundleNo,
      })),
    });
  }

  // 获取布料批次
  if (type === 'batches') {
    const styleId = searchParams.get('styleId');
    if (!styleId) return NextResponse.json({ items: [] });
    const batches = await prisma.fabricBatch.findMany({
      where: { styleId },
      select: { id: true, batchNo: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ items: batches.map((b) => ({ id: b.id, label: b.batchNo })) });
  }

  return NextResponse.json({ items: [] });
}
