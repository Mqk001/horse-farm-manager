import { NextResponse } from 'next/server';
import { googleConfig } from '@/lib/google-oauth';
export async function GET(request: Request) {
  const config = googleConfig();
  return NextResponse.json({ enabled: Boolean(config && new URL(request.url).origin === config.origin) }, { headers: { 'Cache-Control': 'no-store' } });
}
