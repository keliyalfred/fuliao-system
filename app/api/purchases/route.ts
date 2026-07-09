import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const CAN_EDIT = ['BOSS', 'MANAGER', 'FINANCE', 'PURCHASER'];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const materialId = searchParams.get('materialId');

  const where: any = { status: '在途' };
  if (materialId) where.materialId = materialId;

  const orders = await prisma.purchaseOrder.findMany({
    where,
    orderBy: { purchaseDate: 'desc' },
    include: { material: { select: { code: true, name: true, unit: true } } },
  });

  const userIds = [...new Set(orders.map((o) => o.createdBy))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id, materialId: o.materialId, materialCode: o.material.code, materialName: o.material.name, unit: o.material.unit,
      variantName: o.variantName,
      quantity: Number(o.quantity),
      receivedQty: Number(o.receivedQty),
      remaining: Number(o.quantity) - Number(o.receivedQty),
      purchaseDate: o.purchaseDate.toISOString(),
      expectedDate: o.expectedDate ? o.expectedDate.toISOString() : null,
      note: o.note,
      status: o.status,
      createdBy: userMap[o.createdBy] || '未知',
      createdAt: o.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'create') {
      if (!CAN_EDIT.includes(session.role)) {
        return NextResponse.json({ error: '无权限录入采购（仅老板/厂长/财务/采购）' }, { status: 403 });
      }
      const { materialId, variantName, quantity, purchaseDate, expectedDate, note } = body;
      if (!materialId || !quantity || Number(quantity) <= 0) {
        return NextResponse.json({ error: '参数不完整（需要辅料和数量）' }, { status: 400 });
      }
      const order = await prisma.purchaseOrder.create({
        data: {
          materialId,
          variantName: variantName?.trim() || null,
          quantity: Number(quantity),
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          note: note?.trim() || null,
          createdBy: session.userId,
        },
      });
      return NextResponse.json({ success: true, message: '已记录采购', orderId: order.id });
    }

    if (action === 'cancel') {
      if (!CAN_EDIT.includes(session.role)) {
        return NextResponse.json({ error: '无权限取消' }, { status: 403 });
      }
      const { id } = body;
      if (!id) return NextResponse.json({ error: '缺少ID' }, { status: 400 });
      await prisma.purchaseOrder.update({ where: { id }, data: { status: '已取消' } });
      return NextResponse.json({ success: true, message: '已取消' });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失败' }, { status: 400 });
  }
}
