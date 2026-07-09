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
  const view = searchParams.get('view') || 'list';
  const month = searchParams.get('month');
  const category = searchParams.get('category');
  const payStatus = searchParams.get('payStatus');
  const invoiceStatus = searchParams.get('invoiceStatus');
  const payMethod = searchParams.get('payMethod');
  const supplier = searchParams.get('supplier');

  const where: any = {};
  if (month) {
    const [y, m] = month.split('-').map(Number);
    where.expenseDate = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }
  if (category) where.category = category;
  if (payStatus) where.payStatus = payStatus;
  if (invoiceStatus) where.invoiceStatus = invoiceStatus;
  if (payMethod) where.payMethod = payMethod;
  if (supplier) where.supplier = supplier;

  // 分类+供应商列表
  if (view === 'categories') {
    const expenses = await prisma.expense.findMany({
      select: { category: true, subCategory: true, supplier: true },
    });
    const customCats: Record<string, Set<string>> = {};
    const suppliers = new Set<string>();
    for (const e of expenses) {
      if (!customCats[e.category]) customCats[e.category] = new Set();
      customCats[e.category].add(e.subCategory);
      if (e.supplier && e.supplier.trim()) suppliers.add(e.supplier.trim());
    }
    return NextResponse.json({
      categories: Object.fromEntries(
        Object.entries(customCats).map(([k, v]) => [k, Array.from(v)])
      ),
      suppliers: Array.from(suppliers).sort(),
    });
  }

  if (view === 'list') {
    const expenses = await prisma.expense.findMany({
      where, orderBy: { expenseDate: 'desc' }, take: 200,
      select: {
        id: true, category: true, subCategory: true, amount: true,
        payStatus: true, payMethod: true, invoiceStatus: true,
        supplier: true, description: true, note: true,
        expenseDate: true, createdBy: true, createdAt: true,
        images: true, invoiceImages: true,
      },
    });

    const userIds = [...new Set(expenses.map((e) => e.createdBy))];
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    const countImgs = (s: string | null) => { if (!s) return 0; try { const a = JSON.parse(s); return Array.isArray(a) ? a.length : 0; } catch { return 0; } };

    return NextResponse.json({
      expenses: expenses.map((e) => ({
        id: e.id, category: e.category, subCategory: e.subCategory,
        amount: Number(e.amount),
        payStatus: e.payStatus, payMethod: e.payMethod,
        invoiceStatus: e.invoiceStatus,
        // 列表只返回数量，图片按需加载
        imageCount: countImgs(e.images),
        invoiceCount: countImgs(e.invoiceImages),
        supplier: e.supplier, description: e.description, note: e.note,
        expenseDate: e.expenseDate.toISOString(),
        createdBy: userMap[e.createdBy] || '未知',
        createdAt: e.createdAt.toISOString(),
      })),
    });
  }

  // 按需加载单条凭证图片
  if (view === 'images') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: '缺少ID' }, { status: 400 });
    const e = await prisma.expense.findUnique({ where: { id }, select: { images: true, invoiceImages: true } });
    if (!e) return NextResponse.json({ error: '凭证不存在' }, { status: 404 });
    const parse = (s: string | null) => { if (!s) return []; try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch { return []; } };
    return NextResponse.json({ images: parse(e.images), invoiceImages: parse(e.invoiceImages) });
  }

  if (view === 'summary') {
    const expenses = await prisma.expense.findMany({
      where,
      select: { amount: true, category: true, payMethod: true, payStatus: true, invoiceStatus: true, expenseDate: true },
    });

    const byCategory: Record<string, { total: number; count: number }> = {};
    const byPayMethod: Record<string, number> = {};
    const byPayStatus: Record<string, number> = {};
    const byInvoice: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    let grandTotal = 0;

    for (const e of expenses) {
      const amt = Number(e.amount);
      grandTotal += amt;
      const catKey = `${e.category} - ${e.subCategory}`;
      if (!byCategory[catKey]) byCategory[catKey] = { total: 0, count: 0 };
      byCategory[catKey].total += amt;
      byCategory[catKey].count += 1;
      byPayMethod[e.payMethod] = (byPayMethod[e.payMethod] || 0) + amt;
      byPayStatus[e.payStatus] = (byPayStatus[e.payStatus] || 0) + amt;
      byInvoice[e.invoiceStatus] = (byInvoice[e.invoiceStatus] || 0) + amt;
      const mk = `${e.expenseDate.getFullYear()}-${String(e.expenseDate.getMonth() + 1).padStart(2, '0')}`;
      byMonth[mk] = (byMonth[mk] || 0) + amt;
    }

    return NextResponse.json({
      grandTotal, count: expenses.length,
      byCategory: Object.entries(byCategory).map(([k, v]) => ({ name: k, ...v })).sort((a, b) => b.total - a.total),
      byPayMethod: Object.entries(byPayMethod).map(([k, v]) => ({ method: k, total: v })),
      byPayStatus: Object.entries(byPayStatus).map(([k, v]) => ({ status: k, total: v })),
      byInvoice: Object.entries(byInvoice).map(([k, v]) => ({ status: k, total: v })),
      byMonth: Object.entries(byMonth).map(([k, v]) => ({ month: k, total: v })).sort((a, b) => b.month.localeCompare(a.month)),
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
    const { action, ...data } = await req.json();

    if (action === 'create') {
      const expense = await prisma.expense.create({
        data: {
          category: data.category, subCategory: data.subCategory,
          amount: Number(data.amount) || 0,
          payStatus: data.payStatus || '已付款',
          payMethod: data.payMethod || '公账',
          invoiceStatus: data.invoiceStatus || '未开票',
          invoiceImages: data.invoiceImages?.length ? JSON.stringify(data.invoiceImages) : null,
          supplier: data.supplier || null,
          description: data.description || null,
          note: data.note || null,
          expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
          images: data.images?.length ? JSON.stringify(data.images) : null,
          createdBy: session.userId,
        },
      });
      return NextResponse.json({ success: true, id: expense.id, message: '费用记录已添加' });
    }

    if (action === 'update') {
      const updateData: any = {};
      if (data.payStatus !== undefined) updateData.payStatus = data.payStatus;
      if (data.payMethod !== undefined) updateData.payMethod = data.payMethod;
      if (data.invoiceStatus !== undefined) updateData.invoiceStatus = data.invoiceStatus;
      if (data.invoiceImages !== undefined) updateData.invoiceImages = data.invoiceImages?.length ? JSON.stringify(data.invoiceImages) : null;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.subCategory !== undefined) updateData.subCategory = data.subCategory;
      if (data.amount !== undefined) updateData.amount = Number(data.amount);
      if (data.supplier !== undefined) updateData.supplier = data.supplier || null;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.note !== undefined) updateData.note = data.note || null;
      if (data.images !== undefined) updateData.images = data.images?.length ? JSON.stringify(data.images) : null;

      await prisma.expense.update({ where: { id: data.id }, data: updateData });
      return NextResponse.json({ success: true, message: '已更新' });
    }

    if (action === 'delete') {
      await prisma.expense.delete({ where: { id: data.id } });
      return NextResponse.json({ success: true, message: '已删除' });
    }

    // 直接切换开票状态（不必上传图片）
    if (action === 'toggleInvoiceStatus') {
      const exp = await prisma.expense.findUnique({ where: { id: data.id }, select: { invoiceStatus: true } });
      if (!exp) return NextResponse.json({ error: '凭证不存在' }, { status: 400 });
      const newStatus = exp.invoiceStatus === '已开票' ? '未开票' : '已开票';
      await prisma.expense.update({ where: { id: data.id }, data: { invoiceStatus: newStatus } });
      return NextResponse.json({ success: true, message: `已改为${newStatus}` });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失败' }, { status: 400 });
  }
}
