import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const ADMIN_ROLES = ['BOSS', 'MANAGER', 'PURCHASER'];

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
    include: { category: true },
    orderBy: [{ categoryId: 'asc' }, { code: 'asc' }],
    take: 200,
  });

  return NextResponse.json({
    materials: materials.map((m) => {
      const stock = Number(m.stock);
      const minStock = Number(m.minStock);
      const stockDefect = Number(m.stockDefect);
      const stockWaste = Number(m.stockWaste);
      return {
        id: m.id, code: m.code, name: m.name,
        category: m.category.name, categoryId: m.categoryId,
        spec: m.spec, color: m.color, unit: m.unit,
        unitPrice: Number(m.unitPrice),
        stock, stockDefect, stockWaste, minStock,
        location: m.location, supplier: m.supplier,
        stockStatus: stock <= 0 ? 'out' : stock < minStock ? 'danger' : stock < minStock * 2 ? 'warn' : 'ok',
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
    const { code, name, categoryId, spec, color, unit, unitPrice, stock, stockDefect, stockWaste, minStock, location, supplier } = body;
    if (!code?.trim() || !name?.trim() || !categoryId) {
      return NextResponse.json({ error: '编码、名称、分类不能为空' }, { status: 400 });
    }
    const exists = await prisma.material.findUnique({ where: { code: code.trim() } });
    if (exists) return NextResponse.json({ error: '该编码已存在' }, { status: 400 });

    const material = await prisma.material.create({
      data: {
        code: code.trim(), name: name.trim(), categoryId,
        spec: spec || null, color: color || null,
        unit: unit || '个',
        unitPrice: unitPrice || 0,
        stock: stock || 0,
        stockDefect: stockDefect || 0,
        stockWaste: stockWaste || 0,
        minStock: minStock || 0,
        location: location || null,
        supplier: supplier || null,
      },
    });
    return NextResponse.json({ success: true, material });
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
    const { id, name, spec, color, unit, unitPrice, stock, stockDefect, stockWaste, minStock, location, supplier } = body;
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
