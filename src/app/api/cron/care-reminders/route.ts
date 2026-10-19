import { NextResponse } from 'next/server';
import { validCronAuthorization, remindersAvailable } from '@/lib/reminder-security';
import { runCareReminders } from '@/lib/care-reminders';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!validCronAuthorization(request.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers });
  if (!remindersAvailable()) return NextResponse.json({ error: 'Care reminders are not configured.' }, { status: 503, headers });
  try {
    const result = await runCareReminders();
    console.info('Care reminder run', result);
    return NextResponse.json(result, { status: result.failed || result.incomplete ? 503 : 200, headers });
  } catch {
    console.error('Care reminder job failed.');
    return NextResponse.json({ error: 'Care reminders could not be processed.' }, { status: 503, headers });
  }
}
