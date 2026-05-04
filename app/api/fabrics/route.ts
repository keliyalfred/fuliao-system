import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const ADMIN_ROLES = ['BOSS', 'MANAGER', 'PURCHASER', 'FINANCE'];
const PRICE_ROLES = ['BOSS', 'FINANCE'];

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
      return {
        id: f.id, code: f.code, name: f.name, type: f.type,
        composition: f.composition, width: f.width ? Number(f.width) : null,
        unitPriceM: showPrice ? Number(f.unitPriceM) : null,
        totalStock,
        supplier: f.supplier, location: f.location,
        color: f.color, // 旧字段兼容
        stock: Number(f.stock), // 旧字段兼容
        unit: '米',
        colors: f.colors.map((c) => ({
          id: c.id, colorName: c.colorName,
          stock: Number(c.stock),
          unitPriceM: showPrice ? Number(c.unitPriceM ?? f.unitPriceM) : null,
          note: c.note,
        })),
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

    // 新增布料
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

    // 编辑布料
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

    // 删除布料（软删除）
    if (action === 'delete') {
      if (!['BOSS'].includes(session.role)) return NextResponse.json({ error: '只有老板可以删除' }, { status: 403 });
      const { id } = body;
      // 检查是否有流水记录
      const moveCount = await prisma.fabricMove.count({ where: { fabricId: id } });
      if (moveCount > 0) {
        // 有记录的用软删除
        await prisma.fabric.update({ where: { id }, data: { active: false } });
        return NextResponse.json({ success: true, message: '已隐藏（有历史记录，不可硬删除）' });
      }
      // 没有记录的可以硬删除
      await prisma.fabricColor.deleteMany({ where: { fabricId: id } });
      await prisma.fabric.delete({ where: { id } });
      return NextResponse.json({ success: true, message: '已删除' });
    }

    // 添加颜色（如果已存在但被软删除则恢复）
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

    // 修改颜色价格
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

    // 删除颜色
    if (action === 'deleteColor') {
      if (!['BOSS'].includes(session.role)) return NextResponse.json({ error: '只有老板可以删除' }, { status: 403 });
      await prisma.fabricColor.update({ where: { id: body.colorId }, data: { active: false } });
      return NextResponse.json({ success: true, message: '颜色已删除' });
    }

    // 入仓（指定颜色）
    if (action === 'stockIn') {
      const { fabricId, colorId, quantity, unitPriceM, note } = body;
      if (!fabricId || !quantity) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
      const qty = Number(quantity);

      await prisma.$transaction(async (tx) => {
        const fabric = await tx.fabric.findUnique({ where: { id: fabricId } });
        if (!fabric) throw new Error('布料不存在');
        const price = unitPriceM !== undefined && Number(unitPriceM) > 0 ? Number(unitPriceM) : Number(fabric.unitPriceM);

        if (colorId) {
          const fc = await tx.fabricColor.findUnique({ where: { id: colorId } });
          if (!fc) throw new Error('颜色不存在');
          const updateData: any = { stock: Number(fc.stock) + qty };
          if (unitPriceM !== undefined && Number(unitPriceM) > 0) {
            updateData.unitPriceM = Number(unitPriceM);
          }
          await tx.fabricColor.update({ where: { id: colorId }, data: updateData });
        } else {
          await tx.fabric.update({ where: { id: fabricId }, data: { stock: Number(fabric.stock) + qty } });
        }

        if (unitPriceM !== undefined) {
          await tx.fabric.update({ where: { id: fabricId }, data: { unitPriceM: price } });
        }

        await tx.fabricMove.create({
          data: {
            type: 'IN', fabricId, quantityM: qty, displayQty: qty, displayUnit: '米',
            unitPriceM: price, totalPrice: qty * price,
            userId: session.userId, note: note || null,
          },
        });
      });

      return NextResponse.json({ success: true, message: `入仓 ${qty} 米成功` });
    }

    // 领取（指定颜色）
    if (action === 'stockOut') {
      const { fabricId, colorId, quantity, styleId, bedNo, note } = body;
      if (!fabricId || !quantity) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
      const qty = Number(quantity);

      await prisma.$transaction(async (tx) => {
        const fabric = await tx.fabric.findUnique({ where: { id: fabricId } });
        if (!fabric) throw new Error('布料不存在');
        const price = Number(fabric.unitPriceM);

        if (colorId) {
          const fc = await tx.fabricColor.findUnique({ where: { id: colorId } });
          if (!fc) throw new Error('颜色不存在');
          if (Number(fc.stock) < qty) throw new Error(`库存不足（当前 ${Number(fc.stock)} 米）`);
          await tx.fabricColor.update({ where: { id: colorId }, data: { stock: Number(fc.stock) - qty } });
        } else {
          if (Number(fabric.stock) < qty) throw new Error(`库存不足（当前 ${Number(fabric.stock)} 米）`);
          await tx.fabric.update({ where: { id: fabricId }, data: { stock: Number(fabric.stock) - qty } });
        }

        await tx.fabricMove.create({
          data: {
            type: 'CUT', fabricId, quantityM: qty, displayQty: qty, displayUnit: '米',
            unitPriceM: price, totalPrice: qty * price,
            userId: session.userId, styleId: styleId || null, bedNo: bedNo || null, note: note || null,
          },
        });
      });

      return NextResponse.json({ success: true, message: `领取 ${qty} 米成功` });
    }

    // 退回
    if (action === 'stockReturn') {
      const { fabricId, colorId, quantity, note } = body;
      if (!fabricId || !quantity) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
      const qty = Number(quantity);

      await prisma.$transaction(async (tx) => {
        const fabric = await tx.fabric.findUnique({ where: { id: fabricId } });
        if (!fabric) throw new Error('布料不存在');
        const price = Number(fabric.unitPriceM);

        if (colorId) {
          const fc = await tx.fabricColor.findUnique({ where: { id: colorId } });
          if (!fc) throw new Error('颜色不存在');
          await tx.fabricColor.update({ where: { id: colorId }, data: { stock: Number(fc.stock) + qty } });
        } else {
          await tx.fabric.update({ where: { id: fabricId }, data: { stock: Number(fabric.stock) + qty } });
        }

        await tx.fabricMove.create({
          data: {
            type: 'RETURN', fabricId, quantityM: qty, displayQty: qty, displayUnit: '米',
            unitPriceM: price, totalPrice: qty * price,
            userId: session.userId, note: note || null,
          },
        });
      });

      return NextResponse.json({ success: true, message: `退回 ${qty} 米成功` });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失败' }, { status: 400 });
  }
}
