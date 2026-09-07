import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPrincipal } from '@/lib/campus/auth';
import { isAllowedOrigin } from '@/lib/utils/origin';

export async function POST(request: NextRequest) {
  await requireAdminPrincipal();
  if (!isAllowedOrigin(request.url, request.headers.get('origin'), request.headers.get('x-forwarded-host'), request.headers.get('x-forwarded-proto'))) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  return NextResponse.json({
    error: 'This legacy operation is retired because it created permanent public storage tokens.',
  }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
