import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const CAN_EDIT = ['BOSS', 'CUTTER'];
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
        demands: c.demands.map((md) => ({
          id: md.id, materialName: md.material.name,
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
    const { action, colorId, colorCode, colorName, bomItems, bomItemId } = await req.json();

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
