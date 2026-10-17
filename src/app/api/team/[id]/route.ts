import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getFarmAccess } from '@/lib/farm-access';
import { changeFarmMember, TeamError } from '@/lib/team-management';

const roleSchema = z.object({ role: z.enum(['STAFF', 'MANAGER']) }).strict();
type Context = { params: Promise<{ id: string }> };
async function change(request: Request, context: Context, remove: boolean) {
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  // Check here as well as middleware, including requests with no Origin.
  try {
    const parsed = new URL(origin ?? '');
    if (parsed.origin !== origin || parsed.host !== (request.headers.get('host') ?? url.host) || parsed.protocol !== url.protocol) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  } catch { return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 }); }
  const access = await getFarmAccess();
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
  let role: 'STAFF' | 'MANAGER' | undefined;
  if (!remove) {
    const parsed = roleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Choose Staff or Manager.' }, { status: 400 });
    role = parsed.data.role;
  }
  try {
    const member = await changeFarmMember({ farmId: access.farmId, actorId: access.user.id, memberId: (await context.params).id, role });
    for (const path of ['/team', '/care', '/dashboard']) revalidatePath(path);
    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof TeamError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
export async function PATCH(request: Request, context: Context) { return change(request, context, false); }
export async function DELETE(request: Request, context: Context) { return change(request, context, true); }
