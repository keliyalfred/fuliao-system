import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const onlyPending = searchParams.get('pending') === '1';
  const styleId = searchParams.get('styleId');

  const where: any = {};
  if (onlyPending) where.fulfilled = false;
  if (styleId) where.styleId = styleId;

  const demands = await prisma.materialDemand.findMany({
    where,
    include: {
      material: { include: { category: true } },
      bed: { include: { style: true, styleColor: true, bundles: true } },
      style: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({
    demands: demands.map((d) => ({
      id: d.id, bedNo: d.bedNo,
      styleId: d.styleId,
      styleCode: d.style.code, styleName: d.style.name,
      colorName: d.bed.styleColor.colorName,
      totalPieces: d.bed.totalPieces,
      bundles: d.bed.bundles.map((b) => ({ bundleNo: b.bundleNo, size: b.size, quantity: b.quantity })),
      materialId: d.materialId,
      materialName: d.material.name, materialCode: d.material.code,
      categoryName: d.material.category.name,
      currentStock: Number(d.material.stock),
      qtyNeeded: Number(d.qtyNeeded), qtyIssued: Number(d.qtyIssued),
      qtyRemaining: Number(d.qtyNeeded) - Number(d.qtyIssued),
      unit: d.unit, role: d.role, fulfilled: d.fulfilled,
      shortage: Number(d.qtyNeeded) > Number(d.material.stock),
      createdAt: d.createdAt.toISOString(),
    })),
  });
}

// 领取辅料
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  try {
    const { demandId, quantity, bundleNo } = await req.json();
    if (!demandId || !quantity) return NextResponse.json({ error: '参数不完整' }, { status: 400 });

    const qty = Number(quantity);
    if (qty <= 0) return NextResponse.json({ error: '数量必须大于0' }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const demand = await tx.materialDemand.findUnique({
        where: { id: demandId },
        include: { material: true, bed: { include: { style: true } } },
      });
      if (!demand) throw new Error('需求不存在');

      const mat = demand.material;
      const currentStock = Number(mat.stock);
      if (qty > currentStock) throw new Error(`库存不足（当前 ${currentStock} ${demand.unit}）`);

      await tx.material.update({ where: { id: mat.id }, data: { stock: currentStock - qty } });

      await tx.issue.create({
        data: {
          type: 'OUT', materialId: mat.id,
          quantity: qty, unitPrice: Number(mat.unitPrice),
          totalPrice: qty * Number(mat.unitPrice),
          userId: session.userId,
          styleId: demand.styleId,
          bedNo: demand.bedNo,
          bundleNo: bundleNo || null,
          issueMode: 'worker',
          demandId: demandId,
          note: `裁床 ${demand.bedNo} 辅料领取`,
        },
      });

      const newIssued = Number(demand.qtyIssued) + qty;
      await tx.materialDemand.update({
        where: { id: demandId },
        data: { qtyIssued: newIssued, fulfilled: newIssued >= Number(demand.qtyNeeded) },
      });

      return { newStock: currentStock - qty, mat };
    });

    return NextResponse.json({
      success: true,
      message: `领取成功 | ${result.mat.name} 库存 ${result.newStock} ${result.mat.unit}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失败' }, { status: 400 });
  }
}
