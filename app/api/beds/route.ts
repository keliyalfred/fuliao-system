import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const CAN_EDIT = ['BOSS', 'CUTTER'];
const PRICE_ROLES = ['BOSS', 'FINANCE'];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const styleId = searchParams.get('styleId');
  const batchId = searchParams.get('batchId');
  const showPrice = PRICE_ROLES.includes(session.role);

  const where: any = {};
  if (styleId) where.styleId = styleId;
  if (batchId) where.batchId = batchId;

  const beds = await prisma.cuttingBed.findMany({
    where,
    include: {
      style: true, styleColor: true, user: true,
      batch: true,
      sizeItems: { orderBy: { size: 'asc' } },
      fabricItems: { include: { fabric: true } },
      bundles: { orderBy: { bundleNo: 'asc' } },
      demands: { include: { material: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({
    beds: beds.map((b) => ({
      id: b.id, bedNo: b.bedNo,
      styleCode: b.style.code, styleName: b.style.name,
      colorName: b.styleColor.colorName,
      batchNo: b.batch?.batchNo || null,
      totalPieces: b.totalPieces, status: b.status,
      sizes: b.sizeItems.map((s) => ({ size: s.size, quantity: s.quantity })),
      fabricItems: b.fabricItems.map((fi) => ({
        fabricName: fi.fabric.name, role: fi.role,
        totalUsed: Number(fi.totalUsed),
        unitPriceM: showPrice ? Number(fi.unitPriceM) : null,
        totalCost: showPrice ? Number(fi.totalCost) : null,
      })),
      bundles: b.bundles.map((bu) => ({
        id: bu.id, bundleNo: bu.bundleNo, color: bu.color, size: bu.size, quantity: bu.quantity, status: bu.status, note: bu.note,
      })),
      demands: b.demands.map((d) => ({
        id: d.id, materialName: d.material.name,
        qtyNeeded: Number(d.qtyNeeded), qtyIssued: Number(d.qtyIssued),
        unit: d.unit, role: d.role, fulfilled: d.fulfilled,
      })),
      fabricCost: showPrice ? Number(b.fabricCost) : null,
      materialCost: showPrice ? Number(b.materialCost) : null,
      laborCost: showPrice ? Number(b.laborCost) : null,
      totalCost: showPrice ? Number(b.totalCost) : null,
      unitCost: showPrice ? Number(b.unitCost) : null,
      userName: b.user.name, note: b.note,
      createdAt: b.createdAt.toISOString(),
    })),
    showPrice,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;

    // 创建和扎号需要编辑权限
    if ((action === 'createBed' || action === 'addBundle') && !CAN_EDIT.includes(session.role)) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    if (action === 'createBed') return await createBed(body, session);
    if (action === 'addBundle') return await addBundle(body, session);
    if (action === 'completeBed') return await completeBed(body);
    if (action === 'completeBundle') return await completeBundle(body);

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失败' }, { status: 400 });
  }
}

async function createBed(body: any, session: any) {
  const { styleColorId, batchId, sizes, fabricItems, materialItems, bundles, note } = body;

  if (!styleColorId || !sizes?.length) {
    return NextResponse.json({ error: '请选择颜色并填写尺码数量' }, { status: 400 });
  }

  const totalPieces = sizes.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0);
  if (totalPieces <= 0) {
    return NextResponse.json({ error: '裁片总数必须大于0' }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const sc = await tx.styleColor.findUnique({
      where: { id: styleColorId },
      include: { style: true, bomItems: { include: { material: true } } },
    });
    if (!sc) throw new Error('颜色不存在');

    // Generate bed number: 款号-年份-序号 (东纺格式)
    const today = new Date();
    const year = today.getFullYear();
    const styleCode = sc.style.code;
    const prefix = `${styleCode}-${year}`;
    const count = await tx.cuttingBed.count({ where: { bedNo: { startsWith: prefix } } });
    const bedNo = `${prefix}-${String(count + 1).padStart(3, '0')}`;

    // Process fabric items
    let fabricCost = 0;
    const processedFabrics = [];

    if (fabricItems?.length) {
      for (const fi of fabricItems) {
        if (!fi.fabricId) continue;
        const fabric = await tx.fabric.findUnique({ where: { id: fi.fabricId } });
        if (!fabric) throw new Error('布料不存在');

        const totalUsed = Number(fi.layerLength) * Number(fi.layerCount);
        const currentStock = Number(fabric.stock);
        const unitPrice = Number(fabric.unitPriceM);

        if (totalUsed > currentStock) {
          throw new Error(`布料"${fabric.name}"库存不足（需 ${totalUsed.toFixed(2)} 米，有 ${currentStock.toFixed(2)} 米）`);
        }

        await tx.fabric.update({ where: { id: fi.fabricId }, data: { stock: currentStock - totalUsed } });

        await tx.fabricMove.create({
          data: {
            type: 'CUT', fabricId: fi.fabricId,
            quantityM: totalUsed, displayQty: totalUsed, displayUnit: '米',
            unitPriceM: unitPrice, totalPrice: totalUsed * unitPrice,
            userId: session.userId, styleId: sc.styleId, bedNo,
          },
        });

        const itemCost = totalUsed * unitPrice;
        fabricCost += itemCost;
        processedFabrics.push({
          fabricId: fi.fabricId, role: fi.role || '主布',
          layerLength: Number(fi.layerLength), layerCount: Number(fi.layerCount),
          totalUsed, unitPriceM: unitPrice, totalCost: itemCost,
        });
      }
    }

    // Material demands (不扣减)
    const materialWarnings: string[] = [];
    const demandData: any[] = [];

    if (materialItems?.length) {
      for (const mi of materialItems) {
        if (!mi.materialId) continue;
        const mat = await tx.material.findUnique({ where: { id: mi.materialId } });
        if (!mat) continue;
        const needed = Number(mi.qtyPerPiece) * totalPieces;
        if (needed > Number(mat.stock)) {
          materialWarnings.push(`${mat.name}: 需 ${needed} ${mi.unit}，库存 ${Number(mat.stock)} ${mi.unit}`);
        }
        demandData.push({
          materialId: mi.materialId, styleId: sc.styleId, bedNo,
          qtyNeeded: needed, unit: mi.unit || mat.unit, role: mi.role || null,
        });
      }
    }

    // BOM auto demands
    const manualIds = new Set((materialItems || []).map((m: any) => m.materialId));
    for (const bom of sc.bomItems.filter((b) => b.kind === 'MATERIAL' && b.materialId && !manualIds.has(b.materialId))) {
      const mat = await tx.material.findUnique({ where: { id: bom.materialId! } });
      if (!mat) continue;
      const needed = Number(bom.qtyPerPiece) * totalPieces;
      if (needed > Number(mat.stock)) {
        materialWarnings.push(`${mat.name}: 需 ${needed} ${bom.unit}，库存 ${Number(mat.stock)} ${bom.unit}`);
      }
      demandData.push({
        materialId: bom.materialId!, styleId: sc.styleId, bedNo,
        qtyNeeded: needed, unit: bom.unit, role: bom.role || null,
      });
    }

    // Cost
    let materialCostEst = 0;
    for (const d of demandData) {
      const mat = await tx.material.findUnique({ where: { id: d.materialId } });
      if (mat) materialCostEst += d.qtyNeeded * Number(mat.unitPrice);
    }
    const laborCost = Number(sc.style.laborCost) * totalPieces;
    const packCost = Number(sc.style.packCost) * totalPieces;
    const shipCost = Number(sc.style.shipCost) * totalPieces;

    const allMats = await tx.material.findMany({ where: { active: true } });
    let dv = 0, wv = 0, gv = 0;
    for (const m of allMats) { const p = Number(m.unitPrice); dv += Number(m.stockDefect) * p; wv += Number(m.stockWaste) * p; gv += Number(m.stock) * p; }
    const tv = gv + dv + wv;
    const ratio = tv > 0 ? (fabricCost + materialCostEst) / tv : 0;
    const defectWasteCost = (dv + wv) * ratio;
    const totalCost = fabricCost + materialCostEst + laborCost + packCost + shipCost + defectWasteCost;
    const unitCost = totalPieces > 0 ? totalCost / totalPieces : 0;

    const bed = await tx.cuttingBed.create({
      data: {
        bedNo, styleId: sc.styleId, styleColorId: sc.id,
        batchId: batchId || null,
        totalPieces, userId: session.userId, note: note || null,
        fabricCost, materialCost: materialCostEst, laborCost, packCost, shipCost, defectWasteCost, totalCost, unitCost,
        sizeItems: { create: sizes.map((s: any) => ({ size: s.size, quantity: Number(s.quantity) || 0 })) },
        fabricItems: { create: processedFabrics },
        demands: { create: demandData },
      },
    });

    // Create bundles if provided
    if (bundles?.length) {
      // 查现有扎号数量，接着编号
      const existingCount = await tx.bundle.count({ where: { bedId: bed.id } });
      for (let i = 0; i < bundles.length; i++) {
        const b = bundles[i];
        const num = existingCount + i + 1;
        await tx.bundle.create({
          data: {
            bundleNo: `${num}`,
            bedId: bed.id,
            size: b.size || null,
            color: b.color || null,
            quantity: Number(b.quantity) || 0,
            note: b.note || null,
          },
        });
      }
    }

    return { bed, bedNo, materialWarnings };
  });

  return NextResponse.json({
    success: true, bedNo: result.bedNo,
    materialWarnings: result.materialWarnings,
    message: result.materialWarnings.length > 0
      ? `裁床 ${result.bedNo} 录入成功，辅料有不足预警！`
      : `裁床 ${result.bedNo} 录入成功`,
  });
}

async function addBundle(body: any, session: any) {
  const { bedId, color, size, quantity, note } = body;
  if (!bedId) return NextResponse.json({ error: '缺少裁床ID' }, { status: 400 });

  const bed = await prisma.cuttingBed.findUnique({ where: { id: bedId }, include: { bundles: true } });
  if (!bed) return NextResponse.json({ error: '裁床不存在' }, { status: 400 });

  const letter = String.fromCharCode(65 + bed.bundles.length);
  const existingCount = await prisma.bundle.count({ where: { bedId } });
  const num = existingCount + 1;
  const bundle = await prisma.bundle.create({
    data: {
      bundleNo: `${num}`,
      bedId, size: size || null,
      color: color || null,
      quantity: Number(quantity) || 0,
      note: note || null,
    },
  });

  return NextResponse.json({ success: true, bundleNo: `第${num}扎` });
}

// 整床完工
async function completeBed(body: any) {
  const { bedId } = body;
  if (!bedId) return NextResponse.json({ error: '缺少裁床ID' }, { status: 400 });

  await prisma.cuttingBed.update({
    where: { id: bedId },
    data: { status: 'done' },
  });

  // 同时标记所有扎完工
  await prisma.bundle.updateMany({
    where: { bedId },
    data: { status: 'done' },
  });

  return NextResponse.json({ success: true, message: '整床已标记完工' });
}

// 单扎完工
async function completeBundle(body: any) {
  const { bundleId } = body;
  if (!bundleId) return NextResponse.json({ error: '缺少扎ID' }, { status: 400 });

  await prisma.bundle.update({
    where: { id: bundleId },
    data: { status: 'done' },
  });

  // 检查该床所有扎是否都完工
  const bundle = await prisma.bundle.findUnique({ where: { id: bundleId } });
  if (bundle) {
    const pending = await prisma.bundle.count({
      where: { bedId: bundle.bedId, status: { not: 'done' } },
    });
    if (pending === 0) {
      await prisma.cuttingBed.update({
        where: { id: bundle.bedId },
        data: { status: 'done' },
      });
    }
  }

  return NextResponse.json({ success: true, message: '该扎已标记完工' });
}
