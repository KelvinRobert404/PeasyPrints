import { NextRequest, NextResponse } from 'next/server';
import { campusErrorResponse, requireAdminPrincipal } from '@/lib/campus/auth';
import { isAllowedOrigin } from '@/lib/utils/origin';

export async function POST(request: NextRequest) {
  try {
    await requireAdminPrincipal();
  } catch (error) {
    return campusErrorResponse(error);
  }
  if (!isAllowedOrigin(request.url, request.headers.get('origin'), request.headers.get('x-forwarded-host'), request.headers.get('x-forwarded-proto'))) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  return NextResponse.json({
    error: 'This legacy operation is retired because it created permanent public document URLs. Migrate file paths with a reviewed one-off server script.',
  }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
