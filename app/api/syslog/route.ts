// app/api/syslog/route.ts
import { NextResponse } from 'next/server';
import { saveSystemLog } from '@/lib/db';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    // Cloudflare Pages에서 제공하는 특수 헤더 추출
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'Unknown IP';
    const country = req.headers.get('cf-ipcountry') || 'Unknown';
    const userAgent = req.headers.get('user-agent') || 'Unknown Device';
    const clientHints = {
      brands: req.headers.get('sec-ch-ua'),
      mobile: req.headers.get('sec-ch-ua-mobile'),
      platform: req.headers.get('sec-ch-ua-platform'),
    };
    
    const body = await req.json();
    const action = body.action || '페이지 접속';

    await saveSystemLog(action, ip, country, userAgent, clientHints);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}