import { NextResponse } from 'next/server';

// 轻量健康检查 - 给定时 ping 用（cron-job.org 每几分钟戳一次防止 Railway 休眠）
// 不查数据库、不做任何业务逻辑，毫秒级返回
export async function GET() {
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
  });
}
