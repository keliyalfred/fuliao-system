import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const ADMIN_ROLES = ['BOSS', 'MANAGER', 'PURCHASER', 'FINANCE'];
const PRICE_ROLES = ['BOSS', 'FINANCE'];
const DELETE_MOVE_ROLES = ['BOSS', 'MANAGER', 'FINANCE'];

const M_PER_YARD = 0.9144;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const showPrice = PRICE_ROLES.includes(session.role);

  const fabrics = await prisma.fabric.findMany({
    where: { active: true },
    include: { colors: { where: { active: true }, orderBy: { colorName: 'asc' } } },
    orderBy: { code: 'asc' },
  });

  return NextResponse.json({
    fabrics: fabrics.map((f) => {
      const totalStock = f.colors.length > 0
        ? f.colors.reduce((s, c) => s + Number(c.stock), 0)
        : Number(f.stock);
      const mainDyePer = Number(f.dyePerUnitM);
      return {
        id: f.id, code: f.code, name: f.name, type: f.type,
        composition: f.composition, width: f.width ? Number(f.width) : null,
        unitPriceM: showPrice ? Number(f.unitPriceM) : null,
        dyeCostTotal: showPrice ? Number(f.dyeCostTotal) : null,
        dyePerUnitM: showPrice ? mainDyePer : null,
        effectivePriceM: showPrice ? Number(f.unitPriceM) + mainDyePer : null,
        totalStock,
        supplier: f.supplier, location: f.location,
        color: f.color,
        stock: Number(f.stock),
        unit: '米',
        colors: f.colors.map((c) => {
          const basePrice = Number(c.unitPriceM ?? f.unitPriceM);
          const dyePer = Number(c.dyePerUnitM);
          return {
            id: c.id, colorName: c.colorName,
            stock: Number(c.stock),
            unitPriceM: showPrice ? basePrice : null,
            dyeCostTotal: showPrice ? Number(c.dyeCostTotal) : null,
            dyePerUnit: showPrice ? dyePer : null,
            dyePerUnitM: showPrice ? dyePer : null,
            effectivePriceM: showPrice ? basePrice + dyePer : null,
            note: c.note,
          };
        }),
      };
    }),
    showPrice,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'create') {
      if (!ADMIN_ROLES.includes(session.role)) return NextResponse.json({ error: '无权限' }, { status: 403 });
      const { code, name, type, composition, width, unitPriceM, supplier, location } = body;
      if (!code || !name) return NextResponse.json({ error: '编号和名称必填' }, { status: 400 });
      const fabric = await prisma.fabric.create({
        data: {
          code, name, type: type || 'MAIN',
          composition: composition || null, width: width ? Number(width) : null,
          unitPriceM: Number(unitPriceM) || 0,
          supplier: supplier || null, location: location || null,
        },
      });
      return NextResponse.json({ success: true, id: fabric.id, message: `${name} 已添加` });
    }

    if (action === 'update') {
      if (!ADMIN_ROLES.includes(session.role)) return NextResponse.json({ error: '无权限' }, { status: 403 });
      const { id, name, composition, width, unitPriceM, supplier, location } = body;
      await prisma.fabric.update({
        where: { id },
        data: {
          name: name || undefined, composition: composition ?? undefined,
          width: width !== undefined ? (width ? Number(width) : null) : undefined,
          unitPriceM: unitPriceM !== undefined ? Number(unitPriceM) : undefined,
          supplier: supplier ?? undefined, location: location ?? undefined,
        },
      });
      return NextResponse.json({ success: true, message: '已更新' });
    }

    if (action === 'delete') {
      if (!['BOSS'].includes(session.role)) return NextResponse.json({ error: '只有老板可以删除' }, { status: 403 });
      const { id } = body;
      const moveCount = await prisma.fabricMove.count({ where: { fabricId: id } });
      if (moveCount > 0) {
        await prisma.fabric.update({ where: { id }, data: { active: false } });
        return NextResponse.json({ success: true, message: '已隐藏（有历史记录，不可硬删除）' });
      }
      await prisma.fabricColor.deleteMany({ where: { fabricId: id } });
      await prisma.fabric.delete({ where: { id } });
      return NextResponse.json({ success: true, message: '已删除' });
    }

    if (action === 'addColor') {
      if (!ADMIN_ROLES.includes(session.role)) return NextResponse.json({ error: '无权限' }, { status: 403 });
      const { fabricId, colorName, unitPriceM, note } = body;
      if (!fabricId || !colorName) return NextResponse.json({ error: '布料和颜色名必填' }, { status: 400 });
      await prisma.fabricColor.upsert({
        where: { fabricId_colorName: { fabricId, colorName } },
        create: {
          fabricId, colorName,
          unitPriceM: unitPriceM ? Number(unitPriceM) : null,
          note: note || null,
        },
        update: {
          active: true,
          unitPriceM: unitPriceM ? Number(unitPriceM) : undefined,
          note: note || undefined,
        },
      });
      return NextResponse.json({ success: true, message: `颜色 ${colorName} 已添加` });
    }

    if (action === 'updateColor') {
      if (!ADMIN_ROLES.includes(session.role)) return NextResponse.json({ error: '无权限' }, { status: 403 });
      const { colorId, unitPriceM } = body;
      if (!colorId) return NextResponse.json({ error: '缺少颜色ID' }, { status: 400 });
      await prisma.fabricColor.update({
        where: { id: colorId },
        data: { unitPriceM: Number(unitPriceM) || 0 },
      });
      return NextResponse.json({ success: true, message: '价格已更新' });
    }

    if (action === 'deleteColor') {
      if (!['BOSS'].includes(session.role)) return NextResponse.json({ error: '只有老板可以删除' }, { status: 403 });
      await prisma.fabricColor.update({ where: { id: body.colorId }, data: { active: false } });
      return NextResponse.json({ success: true, message: '颜色已删除' });
    }

    // 入仓：支持米/码输入(unit)，染费按批次加权平均到固定每米
    if (action === 'stockIn') {
      const { fabricId, colorId, quantity, unit, unitPriceM, priceIsPerYard, dyeCost, note } = body;
      if (!fabricId || !quantity) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
      const rawQty = Number(quantity);
      const qtyM = unit === '码' ? rawQty * M_PER_YARD : rawQty;
      const dye = Number(dyeCost) || 0;
      // 单价可以按 ¥/码 输入；系统内以 ¥/米 存
      let priceM: number | undefined;
      if (unitPriceM !== undefined && Number(unitPriceM) > 0) {
        priceM = priceIsPerYard ? Number(unitPriceM) / M_PER_YARD : Number(unitPriceM);
      }

      let msg = '';
      await prisma.$transaction(async (tx) => {
        const fabric = await tx.fabric.findUnique({ where: { id: fabricId } });
        if (!fabric) throw new Error('布料不存在');
        const finalPriceM = priceM !== undefined ? priceM : Number(fabric.unitPriceM);

        let colorName: string | null = null;
        if (colorId) {
          const fc = await tx.fabricColor.findUnique({ where: { id: colorId } });
          if (!fc) throw new Error('颜色不存在');
          colorName = fc.colorName;
          const updateData: any = { stock: Number(fc.stock) + qtyM };
          if (priceM !== undefined) updateData.unitPriceM = priceM;
          if (dye > 0) {
            const oldStock = Number(fc.stock);
            const oldPer = Number(fc.dyePerUnitM);
            const newPer = (oldStock * oldPer + dye) / (oldStock + qtyM);
            updateData.dyePerUnitM = newPer;
            updateData.dyeCostTotal = Number(fc.dyeCostTotal) + dye;
          }
          await tx.fabricColor.update({ where: { id: colorId }, data: updateData });
        } else {
          const fabricUpdate: any = { stock: Number(fabric.stock) + qtyM };
          if (dye > 0) {
            const oldStock = Number(fabric.stock);
            const oldPer = Number(fabric.dyePerUnitM);
            const newPer = (oldStock * oldPer + dye) / (oldStock + qtyM);
            fabricUpdate.dyePerUnitM = newPer;
            fabricUpdate.dyeCostTotal = Number(fabric.dyeCostTotal) + dye;
          }
          await tx.fabric.update({ where: { id: fabricId }, data: fabricUpdate });
        }

        if (priceM !== undefined) {
          await tx.fabric.update({ where: { id: fabricId }, data: { unitPriceM: finalPriceM } });
        }

        await tx.fabricMove.create({
          data: {
            type: 'IN', fabricId,
            colorId: colorId || null, colorName,
            quantityM: qtyM, displayQty: rawQty, displayUnit: unit || '米',
            unitPriceM: finalPriceM, totalPrice: qtyM * finalPriceM,
            dyeCost: dye,
            userId: session.userId, note: note || null,
          },
        });
        msg = `入仓 ${rawQty} ${unit || '米'} 成功${dye > 0 ? `（染费 ¥${dye.toFixed(2)}）` : ''}`;
      });
      return NextResponse.json({ success: true, message: msg });
    }

    if (action === 'stockOut') {
      const { fabricId, colorId, quantity, unit, styleId, bedNo, note } = body;
      if (!fabricId || !quantity) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
      const rawQty = Number(quantity);
      const qtyM = unit === '码' ? rawQty * M_PER_YARD : rawQty;

      await prisma.$transaction(async (tx) => {
        const fabric = await tx.fabric.findUnique({ where: { id: fabricId } });
        if (!fabric) throw new Error('布料不存在');
        const price = Number(fabric.unitPriceM);

        let colorName: string | null = null;
        if (colorId) {
          const fc = await tx.fabricColor.findUnique({ where: { id: colorId } });
          if (!fc) throw new Error('颜色不存在');
          colorName = fc.colorName;
          if (Number(fc.stock) < qtyM) throw new Error(`库存不足（当前 ${Number(fc.stock).toFixed(1)} 米）`);
          await tx.fabricColor.update({ where: { id: colorId }, data: { stock: Number(fc.stock) - qtyM } });
        } else {
          if (Number(fabric.stock) < qtyM) throw new Error(`库存不足（当前 ${Number(fabric.stock).toFixed(1)} 米）`);
          await tx.fabric.update({ where: { id: fabricId }, data: { stock: Number(fabric.stock) - qtyM } });
        }

        await tx.fabricMove.create({
          data: {
            type: 'CUT', fabricId,
            colorId: colorId || null, colorName,
            quantityM: qtyM, displayQty: rawQty, displayUnit: unit || '米',
            unitPriceM: price, totalPrice: qtyM * price,
            userId: session.userId, styleId: styleId || null, bedNo: bedNo || null, note: note || null,
          },
        });
      });

      return NextResponse.json({ success: true, message: `领取 ${rawQty} ${unit || '米'} 成功` });
    }

    if (action === 'stockReturn') {
      const { fabricId, colorId, quantity, unit, note } = body;
      if (!fabricId || !quantity) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
      const rawQty = Number(quantity);
      const qtyM = unit === '码' ? rawQty * M_PER_YARD : rawQty;

      await prisma.$transaction(async (tx) => {
        const fabric = await tx.fabric.findUnique({ where: { id: fabricId } });
        if (!fabric) throw new Error('布料不存在');
        const price = Number(fabric.unitPriceM);

        let colorName: string | null = null;
        if (colorId) {
          const fc = await tx.fabricColor.findUnique({ where: { id: colorId } });
          if (!fc) throw new Error('颜色不存在');
          colorName = fc.colorName;
          await tx.fabricColor.update({ where: { id: colorId }, data: { stock: Number(fc.stock) + qtyM } });
        } else {
          await tx.fabric.update({ where: { id: fabricId }, data: { stock: Number(fabric.stock) + qtyM } });
        }

        await tx.fabricMove.create({
          data: {
            type: 'RETURN', fabricId,
            colorId: colorId || null, colorName,
            quantityM: qtyM, displayQty: rawQty, displayUnit: unit || '米',
            unitPriceM: price, totalPrice: qtyM * price,
            userId: session.userId, note: note || null,
          },
        });
      });

      return NextResponse.json({ success: true, message: `退回 ${rawQty} ${unit || '米'} 成功` });
    }

    // 删除流水（回滚库存 + 回滚染费加权平均）
    if (action === 'deleteMove') {
      if (!DELETE_MOVE_ROLES.includes(session.role)) return NextResponse.json({ error: '无权限删除流水（仅老板/厂长/财务）' }, { status: 403 });
      const { moveId } = body;
      if (!moveId) return NextResponse.json({ error: '缺少流水ID' }, { status: 400 });

      await prisma.$transaction(async (tx) => {
        const move = await tx.fabricMove.findUnique({ where: { id: moveId } });
        if (!move) throw new Error('流水不存在');
        const qtyM = Number(move.quantityM);
        const dye = Number(move.dyeCost);
        const addedStock = move.type === 'IN' || move.type === 'RETURN';
        const delta = addedStock ? -qtyM : qtyM;

        if (move.colorId) {
          const fc = await tx.fabricColor.findUnique({ where: { id: move.colorId } });
          if (!fc) throw new Error('对应颜色已不存在，无法回滚');
          const newStock = Number(fc.stock) + delta;
          if (newStock < 0) throw new Error(`删除后库存会变成负数（当前 ${Number(fc.stock)} 米），请先核对`);
          const data: any = { stock: newStock };
          if (move.type === 'IN' && dye > 0) {
            const cur = Number(fc.stock); const curPer = Number(fc.dyePerUnitM);
            const prevPer = newStock > 0 ? Math.max(0, (cur * curPer - dye) / newStock) : 0;
            data.dyePerUnitM = prevPer;
            data.dyeCostTotal = Math.max(0, Number(fc.dyeCostTotal) - dye);
          }
          await tx.fabricColor.update({ where: { id: move.colorId }, data });
        } else {
          const f = await tx.fabric.findUnique({ where: { id: move.fabricId } });
          if (!f) throw new Error('对应布料已不存在，无法回滚');
          const newStock = Number(f.stock) + delta;
          if (newStock < 0) throw new Error(`删除后库存会变成负数（当前 ${Number(f.stock)} 米），请先核对`);
          const data: any = { stock: newStock };
          if (move.type === 'IN' && dye > 0) {
            const cur = Number(f.stock); const curPer = Number(f.dyePerUnitM);
            const prevPer = newStock > 0 ? Math.max(0, (cur * curPer - dye) / newStock) : 0;
            data.dyePerUnitM = prevPer;
            data.dyeCostTotal = Math.max(0, Number(f.dyeCostTotal) - dye);
          }
          await tx.fabric.update({ where: { id: move.fabricId }, data });
        }
        await tx.fabricMove.delete({ where: { id: moveId } });
      });

      return NextResponse.json({ success: true, message: '流水已删除，库存已回滚' });
    }

    // 直接修正染费（录错时）：填染费总额+对应数量，系统算固定每米染费
    if (action === 'setColorDye') {
      if (!PRICE_ROLES.includes(session.role)) {
        return NextResponse.json({ error: '无权限修改染费（仅老板/财务）' }, { status: 403 });
      }
      const { colorId, fabricId, dyeTotal, dyeQty } = body;
      const total = Number(dyeTotal);
      const qty = Number(dyeQty);
      if (isNaN(total) || total < 0) return NextResponse.json({ error: '染费总额无效' }, { status: 400 });
      if (isNaN(qty) || qty <= 0) return NextResponse.json({ error: '请填写对应数量（这批染了多少米）' }, { status: 400 });
      const perUnit = total / qty;
      if (colorId) {
        await prisma.fabricColor.update({ where: { id: colorId }, data: { dyePerUnitM: perUnit, dyeCostTotal: total } });
      } else if (fabricId) {
        await prisma.fabric.update({ where: { id: fabricId }, data: { dyePerUnitM: perUnit, dyeCostTotal: total } });
      } else {
        return NextResponse.json({ error: '缺少颜色或布料ID' }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: `染费已设为 ¥${perUnit.toFixed(2)}/米` });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失败' }, { status: 400 });
  }
}
