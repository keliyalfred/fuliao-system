import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const ADMIN_ROLES = ['BOSS', 'MANAGER', 'PURCHASER', 'FINANCE'];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get('categoryId');
  const keyword = searchParams.get('q');

  const where: any = { active: true };
  if (categoryId) where.categoryId = categoryId;
  if (keyword) {
    where.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { code: { contains: keyword, mode: 'insensitive' } },
      { color: { contains: keyword, mode: 'insensitive' } },
    ];
  }

  const materials = await prisma.material.findMany({
    where,
    include: { category: true, variants: { where: { active: true }, orderBy: { variantName: 'asc' } } },
    orderBy: [{ categoryId: 'asc' }, { code: 'asc' }],
    take: 200,
  });

  // 一次性查所有在途采购
  const materialIds = materials.map((m) => m.id);
  const inTransit = materialIds.length > 0
    ? await prisma.purchaseOrder.findMany({
        where: { materialId: { in: materialIds }, status: '在途' },
        orderBy: { purchaseDate: 'desc' },
      })
    : [];
  const transitMap: Record<string, typeof inTransit> = {};
  for (const po of inTransit) {
    const key = `${po.materialId}::${po.variantName || ''}`;
    if (!transitMap[key]) transitMap[key] = [];
    transitMap[key].push(po);
  }
  const formatPo = (po: typeof inTransit[number]) => ({
    id: po.id,
    quantity: Number(po.quantity),
    receivedQty: Number(po.receivedQty),
    remaining: Number(po.quantity) - Number(po.receivedQty),
    purchaseDate: po.purchaseDate.toISOString(),
    expectedDate: po.expectedDate ? po.expectedDate.toISOString() : null,
    note: po.note,
  });

  return NextResponse.json({
    materials: materials.map((m) => {
      const hasVariants = m.variants.length > 0;
      const totalStock = hasVariants ? m.variants.reduce((s, v) => s + Number(v.stock), 0) : Number(m.stock);
      const totalDefect = hasVariants ? m.variants.reduce((s, v) => s + Number(v.stockDefect), 0) : Number(m.stockDefect);
      const totalWaste = hasVariants ? m.variants.reduce((s, v) => s + Number(v.stockWaste), 0) : Number(m.stockWaste);
      const minStock = Number(m.minStock);
      const mainTransit = (transitMap[`${m.id}::`] || []).map(formatPo);
      return {
        id: m.id, code: m.code, name: m.name,
        category: m.category.name, categoryId: m.categoryId,
        spec: m.spec, color: m.color, unit: m.unit,
        unitPrice: Number(m.unitPrice),
        stock: totalStock, stockDefect: totalDefect, stockWaste: totalWaste, minStock,
        location: m.location, supplier: m.supplier,
        usage: m.usage, note: m.note,
        stockStatus: totalStock <= 0 ? 'out' : totalStock < minStock ? 'danger' : totalStock < minStock * 2 ? 'warn' : 'ok',
        inTransit: mainTransit,
        variants: m.variants.map((v) => {
          const vTransit = (transitMap[`${m.id}::${v.variantName}`] || []).map(formatPo);
          const vStock = Number(v.stock);
          const vMin = Number(v.minStock);
          const stockStatus = vStock <= 0 ? 'out' : vMin > 0 && vStock < vMin ? 'danger' : vMin > 0 && vStock < vMin * 2 ? 'warn' : 'ok';
          return {
            id: v.id, variantName: v.variantName,
            stock: vStock, stockDefect: Number(v.stockDefect), stockWaste: Number(v.stockWaste),
            minStock: vMin, stockStatus,
            unitPrice: v.unitPrice ? Number(v.unitPrice) : null, note: v.note,
            inTransit: vTransit,
          };
        }),
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { action } = body;

    // 新增辅料
    if (!action || action === 'create') {
      const { code, name, categoryId, spec, color, unit, unitPrice, stock, stockDefect, stockWaste, minStock, location, supplier, usage, note } = body;
      if (!code?.trim() || !name?.trim() || !categoryId) {
        return NextResponse.json({ error: '编码、名称、分类不能为空' }, { status: 400 });
      }
      // 允许同编码多个，不做重复检查
      const material = await prisma.material.create({
        data: {
          code: code.trim(), name: name.trim(), categoryId,
          spec: spec || null, color: color || null, unit: unit || '个',
          unitPrice: unitPrice || 0, stock: stock || 0,
          stockDefect: stockDefect || 0, stockWaste: stockWaste || 0,
          minStock: minStock || 0, location: location || null, supplier: supplier || null,
          usage: usage || null, note: note || null,
        },
      });
      return NextResponse.json({ success: true, material });
    }

    // 添加颜色/变体
    if (action === 'addVariant') {
      const { materialId, variantName, unitPrice, minStock, note } = body;
      if (!materialId || !variantName) return NextResponse.json({ error: '辅料ID和名称必填' }, { status: 400 });
      await prisma.materialVariant.upsert({
        where: { materialId_variantName: { materialId, variantName } },
        create: { materialId, variantName, unitPrice: unitPrice ? Number(unitPrice) : null, minStock: minStock ? Number(minStock) : 0, note: note || null },
        update: { active: true, unitPrice: unitPrice ? Number(unitPrice) : undefined, minStock: minStock !== undefined ? Number(minStock) : undefined, note: note || undefined },
      });
      return NextResponse.json({ success: true, message: `${variantName} 已添加` });
    }

    // 删除变体
    if (action === 'deleteVariant') {
      await prisma.materialVariant.update({ where: { id: body.variantId }, data: { active: false } });
      return NextResponse.json({ success: true, message: '已删除' });
    }

    // 修改变体名称和价格
    if (action === 'updateVariant') {
      const { variantId, variantName, unitPrice, minStock } = body;
      const updateData: any = {};
      if (variantName !== undefined) updateData.variantName = variantName;
      if (unitPrice !== undefined) updateData.unitPrice = Number(unitPrice) || 0;
      if (minStock !== undefined) updateData.minStock = Number(minStock) || 0;
      await prisma.materialVariant.update({ where: { id: variantId }, data: updateData });
      return NextResponse.json({ success: true, message: '已更新' });
    }

    // 变体入仓
    if (action === 'variantStockIn') {
      const { variantId, quantity, stockType } = body;
      if (!variantId || !quantity) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
      const qty = Number(quantity);
      const v = await prisma.materialVariant.findUnique({ where: { id: variantId }, include: { material: true } });
      if (!v) return NextResponse.json({ error: '不存在' }, { status: 400 });
      const field = stockType === 'defect' ? 'stockDefect' : stockType === 'waste' ? 'stockWaste' : 'stock';
      const unitPrice = v.unitPrice != null ? Number(v.unitPrice) : Number(v.material.unitPrice);
      let consumedMsg = '';
      await prisma.$transaction(async (tx) => {
        await tx.materialVariant.update({ where: { id: variantId }, data: { [field]: Number(v[field]) + qty } });
        // 记录入库流水（老板可查谁入的库）
        await tx.issue.create({
          data: {
            type: 'IN', materialId: v.materialId, quantity: qty, unitPrice, totalPrice: qty * unitPrice,
            userId: session.userId,
            note: `[${v.variantName}] 入仓${stockType === 'defect' ? '(次品)' : stockType === 'waste' ? '(废品)' : ''}`,
          },
        });
        // 自动核销在途采购
        if (field === 'stock') {
          const orders = await tx.purchaseOrder.findMany({
            where: { materialId: v.materialId, status: '在途', variantName: v.variantName },
            orderBy: { purchaseDate: 'asc' },
          });
          let remaining = qty;
          let totalConsumed = 0;
          for (const o of orders) {
            if (remaining <= 0) break;
            const open = Number(o.quantity) - Number(o.receivedQty);
            if (open <= 0) continue;
            const take = Math.min(open, remaining);
            const newReceived = Number(o.receivedQty) + take;
            const fullyDone = newReceived >= Number(o.quantity);
            await tx.purchaseOrder.update({
              where: { id: o.id },
              data: { receivedQty: newReceived, status: fullyDone ? '已到货' : '在途' },
            });
            remaining -= take;
            totalConsumed += take;
          }
          if (totalConsumed > 0) consumedMsg = `（自动核销采购单 ${totalConsumed} ${v.material.unit}）`;
        }
      });
      return NextResponse.json({ success: true, message: `入仓 ${qty} 成功${consumedMsg}` });
    }

    // 主记录入仓（用于无颜色子项的辅料）
    if (action === 'materialStockIn') {
      const { materialId, quantity, stockType } = body;
      if (!materialId || !quantity) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
      const qty = Number(quantity);
      const m = await prisma.material.findUnique({ where: { id: materialId } });
      if (!m) return NextResponse.json({ error: '不存在' }, { status: 400 });
      const field = stockType === 'defect' ? 'stockDefect' : stockType === 'waste' ? 'stockWaste' : 'stock';
      const unitPrice = Number(m.unitPrice);
      let consumedMsg = '';
      await prisma.$transaction(async (tx) => {
        await tx.material.update({ where: { id: materialId }, data: { [field]: Number(m[field]) + qty } });
        // 记录入库流水
        await tx.issue.create({
          data: {
            type: 'IN', materialId, quantity: qty, unitPrice, totalPrice: qty * unitPrice,
            userId: session.userId,
            note: `入仓${stockType === 'defect' ? '(次品)' : stockType === 'waste' ? '(废品)' : ''}`,
          },
        });
        if (field === 'stock') {
          const orders = await tx.purchaseOrder.findMany({
            where: { materialId, status: '在途', variantName: null },
            orderBy: { purchaseDate: 'asc' },
          });
          let remaining = qty;
          let totalConsumed = 0;
          for (const o of orders) {
            if (remaining <= 0) break;
            const open = Number(o.quantity) - Number(o.receivedQty);
            if (open <= 0) continue;
            const take = Math.min(open, remaining);
            const newReceived = Number(o.receivedQty) + take;
            const fullyDone = newReceived >= Number(o.quantity);
            await tx.purchaseOrder.update({
              where: { id: o.id },
              data: { receivedQty: newReceived, status: fullyDone ? '已到货' : '在途' },
            });
            remaining -= take;
            totalConsumed += take;
          }
          if (totalConsumed > 0) consumedMsg = `（自动核销采购单 ${totalConsumed} ${m.unit}）`;
        }
      });
      return NextResponse.json({ success: true, message: `入仓 ${qty} 成功${consumedMsg}` });
    }

    // 变体领取
    if (action === 'variantStockOut') {
      const { variantId, quantity, stockType } = body;
      if (!variantId || !quantity) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
      const qty = Number(quantity);
      const v = await prisma.materialVariant.findUnique({ where: { id: variantId } });
      if (!v) return NextResponse.json({ error: '不存在' }, { status: 400 });
      const field = stockType === 'defect' ? 'stockDefect' : stockType === 'waste' ? 'stockWaste' : 'stock';
      if (Number(v[field]) < qty) return NextResponse.json({ error: `库存不足（当前 ${Number(v[field])}）` }, { status: 400 });
      await prisma.materialVariant.update({ where: { id: variantId }, data: { [field]: Number(v[field]) - qty } });
      return NextResponse.json({ success: true, message: `领取 ${qty} 成功` });
    }

    // 直接设置变体库存数量
    if (action === 'setVariantStock') {
      const { variantId, field, value } = body;
      if (!variantId || !field) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
      const validFields = ['stock', 'stockDefect', 'stockWaste'];
      if (!validFields.includes(field)) return NextResponse.json({ error: '无效字段' }, { status: 400 });
      await prisma.materialVariant.update({ where: { id: variantId }, data: { [field]: Number(value) || 0 } });
      const labels: Record<string, string> = { stock: '良品', stockDefect: '次品', stockWaste: '废品' };
      return NextResponse.json({ success: true, message: `${labels[field]}数量已更新为 ${Number(value) || 0}` });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '创建失败' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { id, name, spec, color, unit, unitPrice, stock, stockDefect, stockWaste, minStock, location, supplier, usage, note } = body;
    if (!id) return NextResponse.json({ error: '缺少ID' }, { status: 400 });

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (spec !== undefined) data.spec = spec || null;
    if (color !== undefined) data.color = color || null;
    if (unit !== undefined) data.unit = unit;
    if (unitPrice !== undefined) data.unitPrice = unitPrice;
    if (stock !== undefined) data.stock = stock;
    if (stockDefect !== undefined) data.stockDefect = stockDefect;
    if (stockWaste !== undefined) data.stockWaste = stockWaste;
    if (minStock !== undefined) data.minStock = minStock;
    if (location !== undefined) data.location = location || null;
    if (supplier !== undefined) data.supplier = supplier || null;
    if (usage !== undefined) data.usage = usage || null;
    if (note !== undefined) data.note = note || null;

    const material = await prisma.material.update({ where: { id }, data });
    return NextResponse.json({ success: true, material });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '更新失败' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: '缺少ID' }, { status: 400 });
    await prisma.material.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '删除失败' }, { status: 400 });
  }
}
