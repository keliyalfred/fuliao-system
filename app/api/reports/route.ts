import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const PRICE_ROLES = ['BOSS', 'FINANCE'];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!PRICE_ROLES.includes(session.role)) {
    return NextResponse.json({ error: '无权限查看财务报表' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const view = searchParams.get('view') || 'style'; // style | bed | monthly
  const month = searchParams.get('month'); // YYYY-MM

  // === 按款号汇总 ===
  if (view === 'style') {
    const styles = await prisma.style.findMany({
      where: { active: true },
      include: {
        beds: {
          select: {
            totalPieces: true, fabricCost: true, materialCost: true,
            laborCost: true, packCost: true, shipCost: true,
            defectWasteCost: true, totalCost: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    const report = styles.map((s) => {
      const totalPieces = s.beds.reduce((sum, b) => sum + b.totalPieces, 0);
      const fabricCost = s.beds.reduce((sum, b) => sum + Number(b.fabricCost), 0);
      const materialCost = s.beds.reduce((sum, b) => sum + Number(b.materialCost), 0);
      const laborCost = s.beds.reduce((sum, b) => sum + Number(b.laborCost), 0);
      const packCost = s.beds.reduce((sum, b) => sum + Number(b.packCost), 0);
      const shipCost = s.beds.reduce((sum, b) => sum + Number(b.shipCost), 0);
      const defectWasteCost = s.beds.reduce((sum, b) => sum + Number(b.defectWasteCost), 0);
      const totalCost = s.beds.reduce((sum, b) => sum + Number(b.totalCost), 0);
      const unitCost = totalPieces > 0 ? totalCost / totalPieces : 0;
      const targetPrice = s.targetPrice ? Number(s.targetPrice) : 0;
      const profit = targetPrice > 0 ? targetPrice - unitCost : 0;
      const profitRate = targetPrice > 0 ? (profit / targetPrice) * 100 : 0;

      return {
        id: s.id, code: s.code, name: s.name,
        targetPrice, laborCostPerPiece: Number(s.laborCost),
        packCostPerPiece: Number(s.packCost), shipCostPerPiece: Number(s.shipCost),
        totalPieces, bedCount: s.beds.length,
        fabricCost, materialCost, laborCost, packCost, shipCost,
        defectWasteCost, totalCost, unitCost,
        profit, profitRate,
      };
    }).filter((s) => s.totalPieces > 0);

    const grandTotal = {
      totalPieces: report.reduce((s, r) => s + r.totalPieces, 0),
      fabricCost: report.reduce((s, r) => s + r.fabricCost, 0),
      materialCost: report.reduce((s, r) => s + r.materialCost, 0),
      laborCost: report.reduce((s, r) => s + r.laborCost, 0),
      packCost: report.reduce((s, r) => s + r.packCost, 0),
      shipCost: report.reduce((s, r) => s + r.shipCost, 0),
      defectWasteCost: report.reduce((s, r) => s + r.defectWasteCost, 0),
      totalCost: report.reduce((s, r) => s + r.totalCost, 0),
    };

    return NextResponse.json({ view: 'style', report, grandTotal });
  }

  // === 按批次汇总 ===
  if (view === 'bed') {
    const where: any = {};
    if (month) {
      const [y, m] = month.split('-').map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      where.createdAt = { gte: start, lt: end };
    }

    const beds = await prisma.cuttingBed.findMany({
      where,
      include: { style: true, styleColor: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({
      view: 'bed',
      beds: beds.map((b) => ({
        bedNo: b.bedNo, styleCode: b.style.code, styleName: b.style.name,
        colorName: b.styleColor.colorName, totalPieces: b.totalPieces,
        fabricCost: Number(b.fabricCost), materialCost: Number(b.materialCost),
        laborCost: Number(b.laborCost), packCost: Number(b.packCost),
        shipCost: Number(b.shipCost), defectWasteCost: Number(b.defectWasteCost),
        totalCost: Number(b.totalCost), unitCost: Number(b.unitCost),
        createdAt: b.createdAt.toISOString(),
      })),
    });
  }

  // === 按月度汇总 ===
  if (view === 'monthly') {
    const beds = await prisma.cuttingBed.findMany({
      include: { style: true },
      orderBy: { createdAt: 'desc' },
    });

    const monthMap: Record<string, any> = {};
    for (const b of beds) {
      const d = b.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key]) {
        monthMap[key] = {
          month: key, totalPieces: 0, bedCount: 0,
          fabricCost: 0, materialCost: 0, laborCost: 0,
          packCost: 0, shipCost: 0, defectWasteCost: 0, totalCost: 0,
          styles: new Set(),
        };
      }
      const m = monthMap[key];
      m.totalPieces += b.totalPieces;
      m.bedCount += 1;
      m.fabricCost += Number(b.fabricCost);
      m.materialCost += Number(b.materialCost);
      m.laborCost += Number(b.laborCost);
      m.packCost += Number(b.packCost);
      m.shipCost += Number(b.shipCost);
      m.defectWasteCost += Number(b.defectWasteCost);
      m.totalCost += Number(b.totalCost);
      m.styles.add(b.style.code);
    }

    const months = Object.values(monthMap)
      .map((m: any) => ({ ...m, styleCount: m.styles.size, styles: undefined }))
      .sort((a: any, b: any) => b.month.localeCompare(a.month));

    return NextResponse.json({ view: 'monthly', months });
  }

  return NextResponse.json({ error: '未知视图' }, { status: 400 });
}
