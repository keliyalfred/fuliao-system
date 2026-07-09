import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  try {
    const { materialId, type, quantity, variantId, stockSource, deductAmount, styleId, bedNo, bundleNo, issueMode, demandId, note } = await req.json();

    if (!materialId || !type || !quantity) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const validTypes = ['IN', 'OUT', 'RETURN', 'DEFECT', 'WASTE', 'DEFECT_TO_WASTE', 'DEFECT_RETURN_SUPPLIER', 'RESHELF', 'SPECIAL'];
    if (!validTypes.includes(type)) return NextResponse.json({ error: '类型错误' }, { status: 400 });

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) return NextResponse.json({ error: '数量必须大于0' }, { status: 400 });

    const actualType = type === 'SPECIAL' ? 'OUT' : type;

    const result = await prisma.$transaction(async (tx) => {
      const m = await tx.material.findUnique({ where: { id: materialId } });
      if (!m) throw new Error('辅料不存在');

      const unitPrice = Number(m.unitPrice);

      // 如果有variantId，操作variant的库存
      if (variantId) {
        const v = await tx.materialVariant.findUnique({ where: { id: variantId } });
        if (!v) throw new Error('颜色子项不存在');

        let vGood = Number(v.stock), vDefect = Number(v.stockDefect), vWaste = Number(v.stockWaste);
        const src = stockSource || 'good';

        switch (actualType) {
          case 'IN': vGood += qty; break;
          case 'OUT':
            if (src === 'defect') { if (qty > vDefect) throw new Error(`次品库存不足（当前 ${vDefect}）`); vDefect -= qty; }
            else if (src === 'waste') { if (qty > vWaste) throw new Error(`废品库存不足（当前 ${vWaste}）`); vWaste -= qty; }
            else { if (qty > vGood) throw new Error(`良品库存不足（当前 ${vGood}）`); vGood -= qty; }
            break;
          case 'RETURN': vGood += qty; break;
          case 'DEFECT': if (qty > vGood) throw new Error('良品不足'); vGood -= qty; vDefect += qty; break;
          case 'WASTE': if (qty > vGood) throw new Error('良品不足'); vGood -= qty; vWaste += qty; break;
          case 'DEFECT_TO_WASTE': if (qty > vDefect) throw new Error('次品不足'); vDefect -= qty; vWaste += qty; break;
          case 'DEFECT_RETURN_SUPPLIER': if (qty > vDefect) throw new Error('次品不足'); vDefect -= qty; break;
          case 'RESHELF': vGood += qty; break;
        }

        await tx.materialVariant.update({ where: { id: variantId }, data: { stock: vGood, stockDefect: vDefect, stockWaste: vWaste } });

        const srcLabels: Record<string, string> = { good: '良品', defect: '次品', waste: '废品' };
        let finalNote = note || '';
        if (actualType === 'OUT' && src !== 'good') finalNote = `[领${srcLabels[src]}] ${finalNote}`;
        if (actualType === 'WASTE' && Number(deductAmount) > 0) finalNote = `[抵扣¥${Number(deductAmount).toFixed(2)}] ${finalNote}`;
        finalNote = `[${v.variantName}] ${finalNote}`;

        await tx.issue.create({
          data: {
            type: actualType as any, materialId, quantity: qty, unitPrice,
            totalPrice: actualType === 'WASTE' && Number(deductAmount) > 0 ? Number(deductAmount) : qty * unitPrice,
            userId: session.userId, styleId: styleId || null, bedNo: bedNo || null,
            bundleNo: bundleNo || null, issueMode: issueMode || null, demandId: demandId || null,
            note: finalNote || null,
          },
        });

        return { newGood: vGood, newDefect: vDefect, newWaste: vWaste, material: m };
      }

      // 没有variantId，操作主记录库存
      const good = Number(m.stock);
      const defect = Number(m.stockDefect);
      const waste = Number(m.stockWaste);

      let newGood = good, newDefect = defect, newWaste = waste;
      const src = stockSource || 'good';

      switch (actualType) {
        case 'IN': newGood = good + qty; break;
        case 'OUT':
          // 根据选择的库存来源扣减
          if (src === 'defect') {
            if (qty > defect) throw new Error(`次品库存不足（当前 ${defect} ${m.unit}）`);
            newDefect = defect - qty;
          } else if (src === 'waste') {
            if (qty > waste) throw new Error(`废品库存不足（当前 ${waste} ${m.unit}）`);
            newWaste = waste - qty;
          } else {
            if (qty > good) throw new Error(`良品库存不足（当前 ${good} ${m.unit}）`);
            newGood = good - qty;
          }
          break;
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

      // 构建备注
      const srcLabels: Record<string, string> = { good: '良品', defect: '次品', waste: '废品' };
      let finalNote = note || '';
      if (actualType === 'OUT' && src !== 'good') finalNote = `[领${srcLabels[src]}] ${finalNote}`;
      if (actualType === 'WASTE' && Number(deductAmount) > 0) finalNote = `[抵扣¥${Number(deductAmount).toFixed(2)}] ${finalNote}`;

      const issue = await tx.issue.create({
        data: {
          type: actualType as any, materialId, quantity: qty, unitPrice,
          totalPrice: actualType === 'WASTE' && Number(deductAmount) > 0 ? Number(deductAmount) : qty * unitPrice,
          userId: session.userId,
          styleId: styleId || null,
          bedNo: bedNo || null,
          bundleNo: bundleNo || null,
          issueMode: issueMode || null,
          demandId: demandId || null,
          note: finalNote || null,
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
      SPECIAL: '专机领料',
    };

    let resultMsg = `${labels[type] || labels[actualType]}成功 | 良品 ${result.newGood} · 次品 ${result.newDefect} · 废品 ${result.newWaste} ${result.material.unit}`;
    if (actualType === 'WASTE' && Number(deductAmount) > 0) {
      resultMsg += ` | 抵扣货款 ¥${Number(deductAmount).toFixed(2)}`;
    }

    return NextResponse.json({ success: true, message: resultMsg });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失败' }, { status: 400 });
  }
}
