// app/api/syslog/route.ts
import { NextResponse } from 'next/server';
import { saveSystemLog } from '@/lib/googleSheets';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    // Cloudflare Pages에서 제공하는 특수 헤더 추출
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'Unknown IP';
    const country = req.headers.get('cf-ipcountry') || 'Unknown';
    const userAgent = req.headers.get('user-agent') || 'Unknown Device';
    
    const body = await req.json();
    const action = body.action || '페이지 접속';

    // 구글 시트에 기록
    await saveSystemLog(action, ip, country, userAgent);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}