import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getFarmAccess } from '@/lib/farm-access';
import { recordCareCompletion, recordFarmCompletion, TaskCompletionError } from '@/lib/task-completion';
import { invalidateTeamRevision } from '@/lib/team-revision';
import { PayloadError } from '@/lib/request-limits';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
  try {
    const access = await getFarmAccess();
    if ('error' in access) return reply({ error: access.error }, access.status);
    const payload = z.object({ kind: z.enum(['care', 'farm']), fields: z.record(z.string().max(10000)) }).strict().parse(await request.json());
    const data = new FormData();
    for (const [key, value] of Object.entries(payload.fields)) data.set(key, value);
    const horseId = payload.kind === 'care' ? await recordCareCompletion(data, access) : null;
    if (payload.kind === 'farm') await recordFarmCompletion(data, access);
    invalidateTeamRevision(access.farmId);
    for (const path of ['/dashboard', '/team', '/care', ...(horseId ? ['/horses', `/horses/${horseId}`] : [])]) revalidatePath(path);
    // Return the durable write result without rendering the entire dashboard.
    return reply({ completed: true });
  } catch (error) {
    if (error instanceof TaskCompletionError || error instanceof PayloadError) return reply({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return reply({ error: 'Check the task and completion details, then try again.' }, 400);
    console.error('Task completion failed', error instanceof Error ? error.name : 'Unknown error');
    return reply({ error: 'Could not confirm completion. Refresh to check the task before retrying.' }, 503);
  }
}
