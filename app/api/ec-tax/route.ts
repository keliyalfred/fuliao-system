import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const ALLOWED = ['BOSS', 'FINANCE'];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role)) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const view = searchParams.get('view') || 'shops'; // shops | records | summary
  const month = searchParams.get('month');
  const shopId = searchParams.get('shopId');

  if (view === 'shops') {
    const shops = await prisma.ecShop.findMany({
      where: { active: true },
      include: { _count: { select: { records: true } } },
      orderBy: [{ platform: 'asc' }, { shopName: 'asc' }],
    });
    return NextResponse.json({
      shops: shops.map((s) => ({
        id: s.id, platform: s.platform, shopName: s.shopName,
        currency: s.currency, note: s.note, recordCount: s._count.records,
      })),
    });
  }

  if (view === 'records') {
    const where: any = {};
    if (shopId) where.shopId = shopId;
    if (month) where.yearMonth = month;

    const records = await prisma.ecMonthlyRecord.findMany({
      where,
      include: { shop: true },
      orderBy: [{ yearMonth: 'desc' }, { shop: { platform: 'asc' } }],
      take: 200,
    });

    return NextResponse.json({
      records: records.map((r) => ({
        id: r.id, shopId: r.shopId,
        platform: r.shop.platform, shopName: r.shop.shopName,
        yearMonth: r.yearMonth,
        grossSales: Number(r.grossSales), refunds: Number(r.refunds),
        platformFee: Number(r.platformFee), adsFee: Number(r.adsFee),
        otherFee: Number(r.otherFee), netIncome: Number(r.netIncome),
        orderCount: r.orderCount, returnCount: r.returnCount,
        currency: r.currency,
        withdrawAmount: Number(r.withdrawAmount), cnyAmount: Number(r.cnyAmount),
        exchangeRate: Number(r.exchangeRate),
        incomeImages: r.incomeImages ? JSON.parse(r.incomeImages) : [],
        orderImages: r.orderImages ? JSON.parse(r.orderImages) : [],
        withdrawImages: r.withdrawImages ? JSON.parse(r.withdrawImages) : [],
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  }

  if (view === 'summary') {
    const where: any = {};
    if (month) where.yearMonth = month;

    const records = await prisma.ecMonthlyRecord.findMany({
      where,
      include: { shop: true },
    });

    // 按平台汇总
    const byPlatform: Record<string, { grossSales: number; netIncome: number; cnyAmount: number; orders: number; shops: Set<string> }> = {};
    // 按月汇总
    const byMonth: Record<string, { grossCny: number; netCny: number; orders: number }> = {};

    let totalCny = 0;

    for (const r of records) {
      const p = r.shop.platform;
      if (!byPlatform[p]) byPlatform[p] = { grossSales: 0, netIncome: 0, cnyAmount: 0, orders: 0, shops: new Set() };
      byPlatform[p].grossSales += Number(r.grossSales);
      byPlatform[p].netIncome += Number(r.netIncome);
      byPlatform[p].cnyAmount += Number(r.cnyAmount);
      byPlatform[p].orders += r.orderCount;
      byPlatform[p].shops.add(r.shop.shopName);

      totalCny += Number(r.cnyAmount);

      if (!byMonth[r.yearMonth]) byMonth[r.yearMonth] = { grossCny: 0, netCny: 0, orders: 0 };
      byMonth[r.yearMonth].grossCny += Number(r.grossSales) * Number(r.exchangeRate);
      byMonth[r.yearMonth].netCny += Number(r.cnyAmount);
      byMonth[r.yearMonth].orders += r.orderCount;
    }

    return NextResponse.json({
      totalCny, recordCount: records.length,
      byPlatform: Object.entries(byPlatform).map(([k, v]) => ({
        platform: k, ...v, shopCount: v.shops.size, shops: undefined,
      })).sort((a, b) => b.cnyAmount - a.cnyAmount),
      byMonth: Object.entries(byMonth).map(([k, v]) => ({ month: k, ...v }))
        .sort((a, b) => b.month.localeCompare(a.month)),
    });
  }

  return NextResponse.json({ error: '未知视图' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role)) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'addShop') {
      const { platform, shopName, currency, note } = body;
      if (!platform || !shopName) return NextResponse.json({ error: '平台和店铺名必填' }, { status: 400 });
      const shop = await prisma.ecShop.create({
        data: { platform, shopName, currency: currency || 'USD', note: note || null },
      });
      return NextResponse.json({ success: true, id: shop.id, message: `${platform} - ${shopName} 添加成功` });
    }

    if (action === 'deleteShop') {
      await prisma.ecShop.update({ where: { id: body.shopId }, data: { active: false } });
      return NextResponse.json({ success: true, message: '已删除' });
    }

    if (action === 'saveRecord') {
      const { shopId, yearMonth, grossSales, refunds, platformFee, adsFee, otherFee,
        orderCount, returnCount, currency, withdrawAmount, cnyAmount, exchangeRate,
        incomeImages, orderImages, withdrawImages, note } = body;

      if (!shopId || !yearMonth) return NextResponse.json({ error: '店铺和月份必填' }, { status: 400 });

      const gross = Number(grossSales) || 0;
      const ref = Number(refunds) || 0;
      const pf = Number(platformFee) || 0;
      const af = Number(adsFee) || 0;
      const of2 = Number(otherFee) || 0;
      const net = gross - ref - pf - af - of2;

      // 汇率计算：如果有提款外币和人民币到账，自动算汇率
      let rate = Number(exchangeRate) || 0;
      const wa = Number(withdrawAmount) || 0;
      const ca = Number(cnyAmount) || 0;
      if (wa > 0 && ca > 0 && rate === 0) {
        rate = ca / wa;
      }

      const data = {
        grossSales: gross, refunds: ref, platformFee: pf, adsFee: af, otherFee: of2,
        netIncome: net, orderCount: Number(orderCount) || 0, returnCount: Number(returnCount) || 0,
        currency: currency || 'USD',
        withdrawAmount: wa, cnyAmount: ca, exchangeRate: rate,
        incomeImages: incomeImages?.length ? JSON.stringify(incomeImages) : null,
        orderImages: orderImages?.length ? JSON.stringify(orderImages) : null,
        withdrawImages: withdrawImages?.length ? JSON.stringify(withdrawImages) : null,
        note: note || null, createdBy: session.userId,
      };

      // upsert: 同店铺同月份只有一条
      await prisma.ecMonthlyRecord.upsert({
        where: { shopId_yearMonth: { shopId, yearMonth } },
        create: { shopId, yearMonth, ...data },
        update: data,
      });

      return NextResponse.json({ success: true, message: `${yearMonth} 数据已保存` });
    }

    if (action === 'deleteRecord') {
      await prisma.ecMonthlyRecord.delete({ where: { id: body.recordId } });
      return NextResponse.json({ success: true, message: '已删除' });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失败' }, { status: 400 });
  }
}
