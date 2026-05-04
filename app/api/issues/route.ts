import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  try {
    const { materialId, type, quantity, styleId, bedNo, bundleNo, issueMode, demandId, note } = await req.json();

    if (!materialId || !type || !quantity) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const validTypes = ['IN', 'OUT', 'RETURN', 'DEFECT', 'WASTE', 'DEFECT_TO_WASTE', 'DEFECT_RETURN_SUPPLIER', 'RESHELF'];
    if (!validTypes.includes(type)) return NextResponse.json({ error: '类型错误' }, { status: 400 });

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) return NextResponse.json({ error: '数量必须大于0' }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const m = await tx.material.findUnique({ where: { id: materialId } });
      if (!m) throw new Error('辅料不存在');

      const good = Number(m.stock);
      const defect = Number(m.stockDefect);
      const waste = Number(m.stockWaste);
      const unitPrice = Number(m.unitPrice);

      let newGood = good, newDefect = defect, newWaste = waste;

      switch (type) {
        case 'IN': newGood = good + qty; break;
        case 'OUT':
          if (qty > good) throw new Error(`良品库存不足（当前 ${good} ${m.unit}）`);
          newGood = good - qty; break;
        case 'RETURN': newGood = good + qty; break;
        case 'DEFECT':
          if (qty > good) throw new Error(`良品库存不足`);
          newGood = good - qty; newDefect = defect + qty; break;
        case 'WASTE':
          if (qty > good) throw new Error(`良品库存不足`);
          newGood = good - qty; newWaste = waste + qty; break;
        case 'DEFECT_TO_WASTE':
          if (qty > defect) throw new Error(`次品库存不足`);
          newDefect = defect - qty; newWaste = waste + qty; break;
        case 'DEFECT_RETURN_SUPPLIER':
          if (qty > defect) throw new Error(`次品库存不足`);
          newDefect = defect - qty; break;
        case 'RESHELF': newGood = good + qty; break;
      }

      await tx.material.update({
        where: { id: materialId },
        data: { stock: newGood, stockDefect: newDefect, stockWaste: newWaste },
      });

      const issue = await tx.issue.create({
        data: {
          type: type as any, materialId, quantity: qty, unitPrice,
          totalPrice: qty * unitPrice, userId: session.userId,
          styleId: styleId || null,
          bedNo: bedNo || null,
          bundleNo: bundleNo || null,
          issueMode: issueMode || null,
          demandId: demandId || null,
          note: note || null,
        },
      });

      // Update demand if linked
      if (demandId && type === 'OUT') {
        const demand = await tx.materialDemand.findUnique({ where: { id: demandId } });
        if (demand) {
          const newIssued = Number(demand.qtyIssued) + qty;
          await tx.materialDemand.update({
            where: { id: demandId },
            data: { qtyIssued: newIssued, fulfilled: newIssued >= Number(demand.qtyNeeded) },
          });
        }
      }

      return { newGood, newDefect, newWaste, material: m };
    });

    const labels: Record<string, string> = {
      IN: '良品入库', OUT: '领料', RETURN: '退料', DEFECT: '报次品', WASTE: '报废品',
      DEFECT_TO_WASTE: '次品转废品', DEFECT_RETURN_SUPPLIER: '次品退供应商', RESHELF: '返修上架',
    };

    return NextResponse.json({
      success: true,
      message: `${labels[type]}成功 | 良品 ${result.newGood} · 次品 ${result.newDefect} · 废品 ${result.newWaste} ${result.material.unit}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失败' }, { status: 400 });
  }
}
