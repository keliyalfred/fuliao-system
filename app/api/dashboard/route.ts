import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const materials = await prisma.material.findMany({ where: { active: true } });

  let totalAssetValue = 0;
  let totalDefect = 0;
  let totalWaste = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  for (const m of materials) {
    totalAssetValue += Number(m.stock) * Number(m.unitPrice);
    totalDefect += Number(m.stockDefect);
    totalWaste += Number(m.stockWaste);
    if (Number(m.stock) <= 0) outOfStockCount++;
    else if (Number(m.stock) < Number(m.minStock)) lowStockCount++;
  }

  const monthIssues = await prisma.issue.findMany({
    where: { createdAt: { gte: monthStart } },
    select: { type: true, totalPrice: true, quantity: true, materialId: true },
  });

  let monthOut = 0, monthDefect = 0, monthWaste = 0, monthReturn = 0, monthIn = 0;
  for (const i of monthIssues) {
    const v = Number(i.totalPrice);
    if (i.type === 'OUT') monthOut += v;
    else if (i.type === 'DEFECT') monthDefect += v;
    else if (i.type === 'WASTE') monthWaste += v;
    else if (i.type === 'RETURN' || i.type === 'RESHELF') monthReturn += v;
    else if (i.type === 'IN') monthIn += v;
  }

  const todayIssues = await prisma.issue.count({
    where: { createdAt: { gte: todayStart } },
  });

  const recentIssues = await prisma.issue.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { material: true, user: true },
  });

  const lowStockItems = materials
    .filter((m) => Number(m.stock) < Number(m.minStock))
    .sort((a, b) => Number(a.stock) / Number(a.minStock) - Number(b.stock) / Number(b.minStock))
    .slice(0, 5)
    .map((m) => ({
      id: m.id, code: m.code, name: m.name,
      stock: Number(m.stock), minStock: Number(m.minStock), unit: m.unit,
    }));

  return NextResponse.json({
    summary: {
      totalMaterials: materials.length,
      totalAssetValue: Math.round(totalAssetValue * 100) / 100,
      totalDefect,
      totalWaste,
      lowStockCount,
      outOfStockCount,
      monthOut: Math.round(monthOut * 100) / 100,
      monthDefect: Math.round(monthDefect * 100) / 100,
      monthReturn: Math.round(monthReturn * 100) / 100,
      monthIn: Math.round(monthIn * 100) / 100,
      todayOperations: todayIssues,
    },
    lowStockItems,
    recentIssues: recentIssues.map((i) => ({
      id: i.id,
      type: i.type,
      materialName: i.material.name,
      quantity: Number(i.quantity),
      unit: i.material.unit,
      userName: i.user.name,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}
