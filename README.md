# 工厂管理系统

服装工厂 **辅料 · 布料 · 财务** 一体化管理 PWA。

一套代码 · 五个角色 · 手机电脑通用 · 可"添加到主屏幕"变成 App。

## 功能范围（当前 MVP）

| 模块 | 状态 | 说明 |
|---|---|---|
| 登录 + 5 角色权限 | ✅ 已完成 | 老板、厂长、财务、采购、车间师傅 |
| 辅料管理 | ✅ 已完成 | SKU、库存、领料、退料、报次品、流水、预警 |
| 老板看板 | ✅ 已完成 | 资产总值、月度消耗、缺货提醒 |
| 月度财务报表 | ✅ 基础版 | 按类型/类别汇总 |
| 布料 + 裁片 | 🔲 待开发 | 下一期 |
| 电商结算导入 | 🔲 待开发 | Amazon/WB/TikTok/Shein |
| 采购发票管理 | 🔲 基础版 | 数据结构已建好，界面待完善 |

## 测试账号（密码都是 `123456`）

| 账号 | 角色 | 用途 |
|---|---|---|
| `boss` | 老板 | 看经营看板 |
| `manager` | 厂长 | 看生产数据 |
| `finance` | 财务 | 看资产+流水+报表 |
| `purchase` | 采购 | 看采购建议 |
| `worker1` / `worker2` | 车间师傅 | 领料/退料/报次品 |

---

## 一、部署到 Railway（推荐方式）

### 步骤 1：上传到 GitHub
1. 在 GitHub 上新建一个仓库（比如 `fuliao-system`）
2. 把这个项目的所有文件推上去：
```bash
cd fuliao-system
git init
git add .
git commit -m "初始版本"
git branch -M main
git remote add origin https://github.com/你的用户名/fuliao-system.git
git push -u origin main
```

### 步骤 2：在 Railway 创建项目
1. 打开 https://railway.app ，用 GitHub 登录
2. 点击 **"New Project"** → **"Deploy from GitHub repo"** → 选择你刚才的仓库
3. Railway 会自动识别是 Next.js 项目，开始构建

### 步骤 3：添加 PostgreSQL 数据库
1. 在项目里点 **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. 数据库会自动创建一个 `DATABASE_URL` 变量

### 步骤 4：设置环境变量
进入你的应用服务 → **"Variables"** 标签 → 添加以下两个变量：

| 变量名 | 值 |
|---|---|
| `DATABASE_URL` | 点 "Add Reference" → 选 Postgres 的 DATABASE_URL |
| `JWT_SECRET` | 随意输一串至少 32 位的随机字符（比如 `jsdh8f73hf83hf83hf8jfh38fh383hf83`） |

### 步骤 5：等待部署
Railway 会自动：
1. 安装依赖
2. 生成 Prisma 客户端
3. 创建数据库表
4. 插入初始数据（账号 + 示例辅料）
5. 启动应用

等看到 **Active** 状态就说明成功了。

### 步骤 6：设置访问域名
点 **"Settings"** → **"Networking"** → **"Generate Domain"**

会得到一个形如 `your-app.up.railway.app` 的网址。

### 步骤 7：在手机上"安装"App
1. 用手机浏览器打开那个网址
2. **iPhone**：点底部分享按钮 → "添加到主屏幕"
3. **安卓**：点浏览器菜单 → "添加到主屏幕" 或 "安装应用"

图标会出现在手机桌面，点开就像 App 一样全屏运行。

---

## 二、本地开发（可选）

```bash
# 1. 安装依赖
npm install

# 2. 启动一个本地 Postgres（Docker 方式）
docker run -d --name fuliao-db -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:15

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，把 DATABASE_URL 改成 postgresql://postgres:dev@localhost:5432/postgres

# 4. 初始化数据库
npx prisma db push
npx tsx prisma/seed.ts

# 5. 启动开发服务器
npm run dev
```

打开 http://localhost:3000

---

## 三、上线前必须做的事

1. **改所有账号的默认密码**。所有人的密码都是 `123456`，上线前一定改掉。
2. **关掉 seed 自动运行**。首次部署后，编辑 `nixpacks.toml`，把 start 命令里的 `npx tsx prisma/seed.ts &&` 删掉，避免每次重启都重置账号。
3. **盘点现有库存**作为期初数据，用财务账号登录，通过后台录入（目前只能通过数据库直接改，下一期会做界面）。
4. **给每个车间师傅发一个独立账号**，不要共用。

---

## 四、文件结构

```
fuliao-system/
├── app/                      # Next.js 页面
│   ├── login/               # 登录页
│   ├── worker/              # 车间师傅（领料/退料/报次品）
│   ├── boss/                # 老板（看板）
│   ├── manager/             # 厂长
│   ├── finance/             # 财务（含月度报表）
│   ├── purchaser/           # 采购
│   └── api/                 # API 路由
├── components/              # 共享组件
├── lib/                     # 工具函数（认证、数据库）
├── prisma/
│   ├── schema.prisma        # 数据库结构
│   └── seed.ts              # 初始数据
└── public/                  # 静态文件（PWA 图标等）
```

---

## 五、后续开发建议

按痛点优先级：

1. **辅料入库界面**（让采购能在系统里登记到货，自动加库存）
2. **每款衣服的标准用量表**（防止车间超领）
3. **布料采购 + 裁片记录**（算每件衣服完整成本）
4. **月度电商结算导入**（Excel 上传 → 自动解析为财务数据）
5. **采购发票上传**（拍照/PDF，按月自动归档）

---

## 问题反馈

系统遇到问题时：
- 操作记录都在"流水"里能查到，不会丢数据
- Railway 可以看到运行日志和数据库状态
- 数据库可以导出备份，推荐每周做一次

**重要提醒**：系统涉及财务数据，上线前建议请会计事务所看一眼报表格式，确保符合一般纳税人申报要求。
