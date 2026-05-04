import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const styles = await prisma.style.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true, laborCost: true, packCost: true, shipCost: true, targetPrice: true },
    orderBy: { code: 'asc' },
  });

  return NextResponse.json({
    styles: styles.map((s) => ({
      id: s.id, code: s.code, name: s.name,
      laborCost: Number(s.laborCost),
      packCost: Number(s.packCost),
      shipCost: Number(s.shipCost),
      targetPrice: s.targetPrice ? Number(s.targetPrice) : null,
    })),
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!['BOSS', 'MANAGER', 'FINANCE'].includes(session.role)) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const { styleId, laborCost, packCost, shipCost } = await req.json();
    if (!styleId) return NextResponse.json({ error: '缺少款式ID' }, { status: 400 });

    const lc = Number(laborCost) || 0;
    const pc = Number(packCost) || 0;
    const sc = Number(shipCost) || 0;

    await prisma.style.update({
      where: { id: styleId },
      data: { laborCost: lc, packCost: pc, shipCost: sc },
    });

    // Recalculate all beds
    const beds = await prisma.cuttingBed.findMany({
      where: { styleId },
      select: { id: true, totalPieces: true, fabricCost: true, materialCost: true, defectWasteCost: true },
    });

    for (const b of beds) {
      const newLabor = lc * b.totalPieces;
      const newPack = pc * b.totalPieces;
      const newShip = sc * b.totalPieces;
      const total = Number(b.fabricCost) + Number(b.materialCost) + newLabor + newPack + newShip + Number(b.defectWasteCost);
      const unit = b.totalPieces > 0 ? total / b.totalPieces : 0;
      await prisma.cuttingBed.update({
        where: { id: b.id },
        data: { laborCost: newLabor, packCost: newPack, shipCost: newShip, totalCost: total, unitCost: unit },
      });
    }

    return NextResponse.json({ success: true, message: '已更新，成本已重算' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '更新失败' }, { status: 400 });
  }
}
