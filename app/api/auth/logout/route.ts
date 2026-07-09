import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set('session', '', { maxAge: 0, path: '/' });
  return res;
}

export async function GET() {
  const res = NextResponse.redirect(new URL('/login', 'http://localhost'));
  res.cookies.set('session', '', { maxAge: 0, path: '/' });
  // Use relative redirect
  return new NextResponse(null, {
    status: 302,
    headers: {
      'Location': '/login',
      'Set-Cookie': 'session=; Max-Age=0; Path=/',
    },
  });
}
