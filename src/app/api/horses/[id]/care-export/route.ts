import { NextResponse } from 'next/server';
import { getFarmAccess } from '@/lib/farm-access';
import { careExport, careCsv } from '@/lib/care-export';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getFarmAccess();
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status, headers });
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return NextResponse.json({ error: 'Horse not found.' }, { status: 404, headers });
  const query = new URL(request.url).searchParams;
  try {
    const data = await careExport(id, access.farmId, query.get('from'), query.get('to'));
    if (!data) return NextResponse.json({ error: 'Horse not found.' }, { status: 404, headers });
    return new Response(careCsv(data), { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="reinwell-care-${id}.csv"` } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('Choose valid') || message.startsWith('This export')) return NextResponse.json({ error: message }, { status: 400, headers });
    console.error('Care history export failed.');
    return NextResponse.json({ error: 'Care history could not be exported. Try again.' }, { status: 503, headers });
  }
}
