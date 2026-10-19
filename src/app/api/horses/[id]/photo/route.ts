import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getFarmAccess } from '@/lib/farm-access';
import { canManageFarm } from '@/lib/permissions';
import { boundedBody, PayloadError } from '@/lib/request-limits';
import { normalizeHorsePhoto, horsePhotoUrl, PHOTO_MAX_BYTES } from '@/lib/horse-photo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const access = await getFarmAccess();
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status, headers: privateHeaders });
  const { id } = await params;
  const photo = await prisma.horsePhoto.findFirst({ where: { horseId: id, horse: { farmId: access.farmId } } });
  if (!photo) return new Response(null, { status: 404, headers: privateHeaders });
  return new Response(new Uint8Array(photo.data), { headers: { ...privateHeaders, 'Content-Type': 'image/webp', 'Content-Length': String(photo.data.length) } });
}

async function changePhoto(request: Request, { params }: Context, remove: boolean) {
  const access = await getFarmAccess();
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!canManageFarm(access.membership.role)) return NextResponse.json({ error: 'Only farm managers can change horse photos.' }, { status: 403 });
  const { id } = await params;
  if (!await prisma.horse.findFirst({ where: { id, farmId: access.farmId }, select: { id: true } })) return NextResponse.json({ error: 'Horse not found.' }, { status: 404 });
  let photo: Awaited<ReturnType<typeof normalizeHorsePhoto>> | null = null;
  if (!remove) {
    if (request.headers.get('content-type')?.toLowerCase() !== 'image/jpeg') return NextResponse.json({ error: 'Upload a cropped JPEG photo.' }, { status: 415 });
    try { photo = await normalizeHorsePhoto(await boundedBody(request, PHOTO_MAX_BYTES)); }
    catch (error) { return NextResponse.json({ error: error instanceof PayloadError ? error.message : 'This photo could not be read. Choose another image and crop it again.' }, { status: error instanceof PayloadError ? error.status : 400 }); }
  }
  try {
    const url = photo ? horsePhotoUrl(id, photo.version) : null;
    await prisma.$transaction(async tx => {
      await tx.farm.update({ where: { id: access.farmId }, data: { updatedAt: new Date() } });
      const actor = await tx.farmMember.findUnique({ where: { id: access.membership.id } });
      if (actor?.status !== 'ACTIVE' || !canManageFarm(actor.role)) throw new Error('Manager access changed.');
      const changed = await tx.horse.updateMany({ where: { id, farmId: access.farmId }, data: { photo: url } });
      if (changed.count !== 1) throw new Error('Horse unavailable.');
      if (photo) await tx.horsePhoto.upsert({ where: { horseId: id }, create: { horseId: id, ...photo }, update: photo });
      else await tx.horsePhoto.deleteMany({ where: { horseId: id } });
    });
    revalidatePath('/horses'); revalidatePath('/dashboard'); revalidatePath(`/horses/${id}`); revalidatePath(`/horses/${id}/edit`);
    return NextResponse.json({ photo: url }, { headers: privateHeaders });
  } catch {
    console.error('Horse photo could not be saved.');
    return NextResponse.json({ error: 'Could not save the photo. Refresh to check before trying again.' }, { status: 409, headers: privateHeaders });
  }
}
export async function POST(request: Request, context: Context) { return changePhoto(request, context, false); }
export async function DELETE(request: Request, context: Context) { return changePhoto(request, context, true); }
