import { NextResponse } from 'next/server';
import { getFarmContext } from '@/lib/farm-access';

export async function GET() {
  const context = await getFarmContext();
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!context) return NextResponse.json({ user: null }, { status: 401, headers });
  const { user, memberships, membership } = context;
  return NextResponse.json({
    user: { name: user.name, email: user.email },
    farm: membership ? { id: membership.farmId, name: membership.farm.name, role: membership.role } : null,
    farms: memberships.map(m => ({ id: m.farm.id, name: m.farm.name, role: m.role })),
  }, { headers });
}
