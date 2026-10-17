import { groomingSchema } from '@/lib/input-validation';
import { getFarmAccess } from '@/lib/farm-access';
  import { NextResponse } from 'next/server';
  import { prisma } from '@/lib/prisma';
  import { revalidatePath } from 'next/cache';

  export async function POST(request: Request) {
    try {
    const access = await getFarmAccess();
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
      const parsed = groomingSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the form details.' }, { status: 400 });
    const body = parsed.data;
    if (typeof body.horseId !== 'string' || !await prisma.horse.findFirst({ where: { id: body.horseId, farmId: access.farmId } })) return NextResponse.json({ error: 'Horse not found' }, { status: 404 });

      const wash = await prisma.washLog.create({
        data: {
          horseId: body.horseId,
          dateTime: body.dateTime,
          type: body.type,
          notes: body.notes,
        },
      });

      // Force refresh of relevant pages
      revalidatePath('/horses');
      revalidatePath('/dashboard');
      revalidatePath(`/horses/${body.horseId}`);

      return NextResponse.json(wash);
    } catch (error) {
      console.error('Error creating wash:', error);
      return NextResponse.json({ error: 'Failed to log grooming' }, { status: 500 });
    }
  }