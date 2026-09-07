import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  try {
    await getAdminDb().collection('_health').doc('readiness').get();
    return NextResponse.json({ status: 'ok', database: 'reachable', latencyMs: Date.now() - started }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Readiness check failed:', error instanceof Error ? error.message : 'unknown database error');
    return NextResponse.json({ status: 'degraded', database: 'unreachable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
