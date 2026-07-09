import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const CAN_EDIT = ['BOSS', 'CUTTER', 'FINANCE'];
const PRICE_ROLES = ['BOSS', 'FINANCE'];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const showPrice = PRICE_ROLES.includes(session.role);

  const style = await prisma.style.findUnique({
    where: { id: params.id },
    include: {
      colors: {
        include: { bomItems: { include: { fabric: true, material: true } } },
      },
      beds: {
        include: {
          styleColor: true, user: true,
          sizeItems: { orderBy: { size: 'asc' } },
          bundles: { orderBy: { bundleNo: 'asc' } },
          demands: { include: { material: true } },
          fabricItems: { include: { fabric: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!style) return NextResponse.json({ error: '款式不存在' }, { status: 404 });

  return NextResponse.json({
    style: {
      id: style.id, code: style.code, name: style.name,
      season: style.season,
      targetPrice: style.targetPrice ? Number(style.targetPrice) : null,
      laborCost: Number(style.laborCost),
      processesJson: style.processesJson,
      packCost: Number(style.packCost),
      shipCost: Number(style.shipCost),
      sizes: style.sizes ? JSON.parse(style.sizes) : [],
      colors: style.colors.map((c) => ({
        id: c.id, colorCode: c.colorCode, colorName: c.colorName,
        bomItems: c.bomItems.map((b) => ({
          id: b.id, kind: b.kind, role: b.role,
          qtyPerPiece: Number(b.qtyPerPiece), unit: b.unit, note: b.note,
          fabricId: b.fabricId, fabricName: b.fabric?.name || null,
          materialId: b.materialId, materialName: b.material?.name || null,
        })),
      })),
      beds: style.beds.map((c) => ({
        id: c.id, bedNo: c.bedNo,
        colorName: c.styleColor.colorName,
        totalPieces: c.totalPieces, status: c.status,
        sizes: c.sizeItems.map((s) => ({ size: s.size, quantity: s.quantity })),
        bundles: c.bundles.map((b) => ({ id: b.id, bundleNo: b.bundleNo, color: b.color, size: b.size, quantity: b.quantity, status: b.status, note: b.note })),
        fabricItems: c.fabricItems.map((fi) => ({
          fabricId: fi.fabricId, fabricName: fi.fabric.name, fabricColorId: fi.fabricColorId,
          role: fi.role,
          layerLength: Number(fi.layerLength), layerCount: fi.layerCount,
          totalUsed: Number(fi.totalUsed),
          unitPriceM: showPrice ? Number(fi.unitPriceM) : null,
          totalCost: showPrice ? Number(fi.totalCost) : null,
        })),
        demands: c.demands.map((md) => ({
          id: md.id, materialId: md.materialId, materialName: md.material.name,
          qtyNeeded: Number(md.qtyNeeded), qtyIssued: Number(md.qtyIssued),
          unit: md.unit, role: md.role, fulfilled: md.fulfilled,
        })),
        fabricCost: showPrice ? Number(c.fabricCost) : null,
        materialCost: showPrice ? Number(c.materialCost) : null,
        laborCost: showPrice ? Number(c.laborCost) : null,
        totalCost: showPrice ? Number(c.totalCost) : null,
        unitCost: showPrice ? Number(c.unitCost) : null,
        userName: c.user.name,
        createdAt: c.createdAt.toISOString(),
      })),
    },
    showPrice,
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !CAN_EDIT.includes(session.role)) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, colorId, colorCode, colorName, bomItems, bomItemId } = body;

    if (action === 'addColor') {
      if (!colorCode || !colorName) return NextResponse.json({ error: '颜色编码和名称必填' }, { status: 400 });
      const color = await prisma.styleColor.create({
        data: { styleId: params.id, colorCode, colorName },
      });
      return NextResponse.json({ success: true, color });
    }

    if (action === 'deleteColor') {
      if (!colorId) return NextResponse.json({ error: '缺少颜色ID' }, { status: 400 });
      await prisma.styleColor.delete({ where: { id: colorId } });
      return NextResponse.json({ success: true });
    }

    // 删除款式（软删除）
    if (action === 'deleteStyle') {
      if (session.role !== 'BOSS') return NextResponse.json({ error: '只有老板可以删除款式' }, { status: 403 });
      const bedCount = await prisma.cuttingBed.count({ where: { styleId: params.id } });
      if (bedCount > 0) {
        await prisma.style.update({ where: { id: params.id }, data: { active: false } });
        return NextResponse.json({ success: true, message: '款式已隐藏（有裁床记录，不可硬删除）' });
      }
      await prisma.style.delete({ where: { id: params.id } });
      return NextResponse.json({ success: true, message: '款式已删除' });
    }

    // 删除裁床
    if (action === 'deleteBed') {
      if (session.role !== 'BOSS') return NextResponse.json({ error: '只有老板可以删除裁床' }, { status: 403 });
      const { bedId } = body;
      if (!bedId) return NextResponse.json({ error: '缺少裁床ID' }, { status: 400 });
      // 删除关联的扎号、辅料需求、尺码、布料明细
      await prisma.bundle.deleteMany({ where: { bedId } });
      await prisma.materialDemand.deleteMany({ where: { bedId } });
      await prisma.bedSizeItem.deleteMany({ where: { bedId } });
      await prisma.bedFabricItem.deleteMany({ where: { bedId } });
      await prisma.cuttingBed.delete({ where: { id: bedId } });
      return NextResponse.json({ success: true, message: '裁床已删除' });
    }

    if (action === 'saveBom') {
      if (!colorId || !bomItems?.length) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
      await prisma.bomItem.deleteMany({ where: { styleColorId: colorId } });
      await prisma.bomItem.createMany({
        data: bomItems.map((b: any) => ({
          styleColorId: colorId,
          kind: b.kind,
          fabricId: b.kind === 'FABRIC' ? b.itemId : null,
          materialId: b.kind === 'MATERIAL' ? b.itemId : null,
          role: b.role || null,
          qtyPerPiece: Number(b.qtyPerPiece) || 0,
          unit: b.unit || '个',
          note: b.note || null,
        })),
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失败' }, { status: 400 });
  }
}
