import { PrismaClient, Role, FabricType, BomKind } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 安全检查：如果已经有用户数据，跳过seed避免干扰正式数据
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log(`数据库已有 ${existingUsers} 个用户，跳过初始化`);
    return;
  }

  console.log('首次初始化数据...');

  const users = [
    { username: 'boss', password: '123456', name: '李老板', role: Role.BOSS },
    { username: 'manager', password: '123456', name: '王厂长', role: Role.MANAGER },
    { username: 'finance', password: '123456', name: '刘会计', role: Role.FINANCE },
    { username: 'purchase', password: '123456', name: '陈采购', role: Role.PURCHASER },
    { username: 'worker1', password: '123456', name: '张师傅', role: Role.WORKER },
    { username: 'worker2', password: '123456', name: '赵师傅', role: Role.WORKER },
    { username: 'cutter1', password: '123456', name: '孙裁床', role: Role.CUTTER },
    { username: 'packer1', password: '123456', name: '周打包', role: Role.PACKER },
    { username: 'warehouse1', password: '123456', name: '吴仓库', role: Role.WAREHOUSE },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { username: u.username, password: hash, name: u.name, role: u.role },
    });
  }
  console.log('✓ 账号已创建（9 个，密码都是 123456）');

  const categories = [
    { name: '纽扣', icon: '⬤', sortOrder: 1 },
    { name: '拉链', icon: '▥', sortOrder: 2 },
    { name: '花边', icon: '≋', sortOrder: 3 },
    { name: '缝纫线', icon: '~', sortOrder: 4 },
    { name: '针', icon: '⌇', sortOrder: 5 },
    { name: '标签吊牌', icon: '▭', sortOrder: 6 },
    { name: '松紧带', icon: '═', sortOrder: 7 },
    { name: '里衬', icon: '▢', sortOrder: 8 },
    { name: '包装袋', icon: '▢', sortOrder: 9 },
    { name: '打包带', icon: '═', sortOrder: 10 },
    { name: '胶带', icon: '═', sortOrder: 11 },
    { name: '纸箱', icon: '▢', sortOrder: 12 },
  ];
  for (const c of categories) {
    await prisma.category.upsert({ where: { name: c.name }, update: {}, create: c });
  }
  console.log('✓ 辅料分类 12 个');

  const btn = await prisma.category.findUnique({ where: { name: '纽扣' } });
  const lace = await prisma.category.findUnique({ where: { name: '花边' } });
  const thread = await prisma.category.findUnique({ where: { name: '缝纫线' } });

  if (btn && lace && thread) {
    const materials = [
      { code: 'BTN-R-4', name: '红色纽扣 4号', categoryId: btn.id, spec: '直径10mm', color: '红色', unit: '个', unitPrice: 0.15, stock: 3200, minStock: 500, location: 'A1-01' },
      { code: 'BTN-B-4', name: '黑色纽扣 4号', categoryId: btn.id, spec: '直径10mm', color: '黑色', unit: '个', unitPrice: 0.15, stock: 2800, minStock: 500, location: 'A1-02' },
      { code: 'BTN-W-5', name: '白色纽扣 5号', categoryId: btn.id, spec: '直径12mm', color: '白色', unit: '个', unitPrice: 0.2, stock: 450, minStock: 500, location: 'A1-03' },
      { code: 'LACE-W-2', name: '白色蕾丝花边 2cm', categoryId: lace.id, spec: '宽2cm', color: '白色', unit: '米', unitPrice: 2.5, stock: 280, minStock: 100, location: 'C1-01' },
      { code: 'LACE-M-3', name: '米白绣花花边 3cm', categoryId: lace.id, spec: '宽3cm', color: '米白', unit: '米', unitPrice: 4.2, stock: 156, minStock: 80, location: 'C1-02' },
      { code: 'LACE-P-2', name: '粉色蕾丝花边 2.5cm', categoryId: lace.id, spec: '宽2.5cm', color: '粉色', unit: '米', unitPrice: 3.0, stock: 8, minStock: 50, location: 'C1-03' },
      { code: 'THR-W-40', name: '白色缝纫线 40S', categoryId: thread.id, spec: '40支', color: '白色', unit: '卷', unitPrice: 8, stock: 120, minStock: 30, location: 'D1-01' },
      { code: 'THR-B-40', name: '黑色缝纫线 40S', categoryId: thread.id, spec: '40支', color: '黑色', unit: '卷', unitPrice: 8, stock: 95, minStock: 30, location: 'D1-02' },
    ];
    for (const m of materials) {
      await prisma.material.upsert({ where: { code: m.code }, update: {}, create: m });
    }
    console.log('✓ 辅料 8 个');
  }

  const fabrics = [
    { code: 'FB-001', name: '红色雪纺', type: FabricType.MAIN, composition: '100%涤纶', width: 1.5, color: '红色', unitPriceM: 18, stock: 520, minStock: 100, supplier: '顺丰纺织' },
    { code: 'FB-002', name: '蓝色雪纺', type: FabricType.MAIN, composition: '100%涤纶', width: 1.5, color: '蓝色', unitPriceM: 18, stock: 480, minStock: 100, supplier: '顺丰纺织' },
    { code: 'FB-003', name: '黑色雪纺', type: FabricType.MAIN, composition: '100%涤纶', width: 1.5, color: '黑色', unitPriceM: 18, stock: 310, minStock: 100, supplier: '顺丰纺织' },
    { code: 'FB-101', name: '白色珠地布', type: FabricType.MAIN, composition: '95%棉5%氨纶', width: 1.8, color: '白色', unitPriceM: 32, stock: 260, minStock: 80, supplier: '兴隆针织' },
    { code: 'FB-201', name: '白色平纹里衬', type: FabricType.LINING, composition: '100%涤纶', width: 1.5, color: '白色', unitPriceM: 6, stock: 890, minStock: 200, supplier: '辅料城A12' },
    { code: 'FB-202', name: '肤色网纱', type: FabricType.LINING, composition: '100%尼龙', width: 1.5, color: '肤色', unitPriceM: 8, stock: 156, minStock: 100, supplier: '辅料城A12' },
    { code: 'FB-301', name: '金色花边布', type: FabricType.LACE, composition: '涤纶+金丝', width: 0.05, color: '金色', unitPriceM: 12, stock: 68, minStock: 50, supplier: '广州蕾丝厂' },
  ];
  for (const f of fabrics) {
    await prisma.fabric.upsert({ where: { code: f.code }, update: {}, create: f });
  }
  console.log('✓ 布料 7 个');

  // 创建示例款式
  const style1 = await prisma.style.upsert({
    where: { code: 'SS26-083' },
    update: {},
    create: {
      code: 'SS26-083', name: '碎花雪纺连衣裙', season: '2026春夏',
      targetPrice: 199, sizes: '["S","M","L","XL","XXL"]', laborCost: 25,
    },
  });

  // 添加颜色
  const sc1 = await prisma.styleColor.upsert({
    where: { styleId_colorCode: { styleId: style1.id, colorCode: 'RED' } },
    update: {},
    create: { styleId: style1.id, colorCode: 'RED', colorName: '红色' },
  });
  await prisma.styleColor.upsert({
    where: { styleId_colorCode: { styleId: style1.id, colorCode: 'BLUE' } },
    update: {},
    create: { styleId: style1.id, colorCode: 'BLUE', colorName: '蓝色' },
  });

  const style2 = await prisma.style.upsert({
    where: { code: 'SS26-104' },
    update: {},
    create: {
      code: 'SS26-104', name: '珠地布T恤', season: '2026春夏',
      targetPrice: 89, sizes: '["S","M","L","XL"]', laborCost: 15,
    },
  });
  await prisma.styleColor.upsert({
    where: { styleId_colorCode: { styleId: style2.id, colorCode: 'WHITE' } },
    update: {},
    create: { styleId: style2.id, colorCode: 'WHITE', colorName: '白色' },
  });

  console.log('✓ 款式 2 个');
  console.log('初始化完成！');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
