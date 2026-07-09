import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const YARD_TO_METER = 0.9144;
const PRICE_ROLES = ['BOSS', 'FINANCE'];
const DELETE_MOVE_ROLES = ['BOSS', 'MANAGER', 'FINANCE'];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
  const fabricId = searchParams.get('fabricId');
  const type = searchParams.get('type');
  const showPrice = PRICE_ROLES.includes(session.role);
  const canDelete = DELETE_MOVE_ROLES.includes(session.role);

  const where: any = {};
  if (fabricId) where.fabricId = fabricId;
  if (type) where.type = type;

  const moves = await prisma.fabricMove.findMany({
    where,
    include: { fabric: true, user: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({
    moves: moves.map((m) => ({
      id: m.id, type: m.type,
      fabricName: m.fabric.name, fabricCode: m.fabric.code, fabricColor: m.fabric.color,
      colorName: m.colorName,
      quantityM: Number(m.quantityM),
      displayQty: m.displayQty ? Number(m.displayQty) : Number(m.quantityM),
      displayUnit: m.displayUnit || '米',
      unitPriceM: showPrice ? Number(m.unitPriceM) : null,
      totalPrice: showPrice ? Number(m.totalPrice) : null,
      dyeCost: showPrice ? Number(m.dyeCost) : null,
      userName: m.user.name,
      note: m.note,
      createdAt: m.createdAt.toISOString(),
    })),
    showPrice,
    canDelete,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  try {
    const { fabricId, type, quantity, unit, unitPrice, styleCode, note } = await req.json();

    if (!fabricId || !type || !quantity) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const validTypes = ['IN', 'CUT', 'RETURN', 'DEFECT'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: '类型错误' }, { status: 400 });
    }

    // 权限检查
    const canOperate = ['BOSS', 'MANAGER', 'PURCHASER', 'CUTTER'];
    if (!canOperate.includes(session.role)) {
      return NextResponse.json({ error: '无操作权限' }, { status: 403 });
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: '数量必须大于0' }, { status: 400 });
    }

    // 换算为米
    const displayUnit = unit || '米';
    const quantityM = displayUnit === '码' ? qty * YARD_TO_METER : qty;
    const priceM = Number(unitPrice) || 0;

    const result = await prisma.$transaction(async (tx) => {
      const f = await tx.fabric.findUnique({ where: { id: fabricId } });
      if (!f) throw new Error('布料不存在');

      const currentStock = Number(f.stock);
      const currentPrice = Number(f.unitPriceM);
      let newStock = currentStock;
      let newPrice = currentPrice;

      switch (type) {
        case 'IN':
          // 入库：加权平均计算单价
          if (priceM > 0 && currentStock > 0) {
            newPrice = (currentStock * currentPrice + quantityM * priceM) / (currentStock + quantityM);
          } else if (priceM > 0) {
            newPrice = priceM;
          }
          newStock = currentStock + quantityM;
          break;
        case 'CUT':
          if (quantityM > currentStock) throw new Error(`库存不足（当前 ${currentStock.toFixed(2)} 米）`);
          newStock = currentStock - quantityM;
          break;
        case 'RETURN':
          newStock = currentStock + quantityM;
          break;
        case 'DEFECT':
          if (quantityM > currentStock) throw new Error(`库存不足（当前 ${currentStock.toFixed(2)} 米）`);
          newStock = currentStock - quantityM;
          break;
      }

      await tx.fabric.update({
        where: { id: fabricId },
        data: { stock: newStock, unitPriceM: newPrice },
      });

      const usedPrice = type === 'IN' ? priceM : currentPrice;
      const move = await tx.fabricMove.create({
        data: {
          type: type as any,
          fabricId, quantityM,
          displayQty: qty, displayUnit,
          unitPriceM: usedPrice,
          totalPrice: quantityM * usedPrice,
          userId: session.userId,
          note: note || null,
        },
        include: { fabric: true },
      });

      return { move, newStock, fabric: f };
    });

    const labels: Record<string, string> = { IN: '入库', CUT: '领取', RETURN: '退回', DEFECT: '报次品' };

    return NextResponse.json({
      success: true,
      newStock: result.newStock,
      message: `布料${labels[type]}成功 | 当前库存 ${result.newStock.toFixed(2)} 米`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失败' }, { status: 400 });
  }
}
