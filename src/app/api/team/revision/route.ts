import { NextResponse } from 'next/server';
import { getFarmAccess } from '@/lib/farm-access';
import { canManageFarm } from '@/lib/permissions';
import { teamRevision } from '@/lib/team-revision';
export const dynamic = 'force-dynamic';
export async function GET() {
  const access = await getFarmAccess();
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!canManageFarm(access.membership.role)) return NextResponse.json({ error: 'Manager access required.' }, { status: 403 });
  return NextResponse.json({ revision: await teamRevision(access.farmId) }, { headers: { 'Cache-Control': 'no-store' } });
}
