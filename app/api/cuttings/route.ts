import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  url.pathname = '/api/beds';
  return NextResponse.redirect(url);
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  url.pathname = '/api/beds';
  return NextResponse.redirect(url, { status: 307 });
}
