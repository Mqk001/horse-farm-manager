import { canManageFarm } from '@/lib/permissions';
import { horseSchema } from '@/lib/input-validation';
import { getFarmAccess } from '@/lib/farm-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const access = await getFarmAccess();
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!canManageFarm(access.membership.role)) return NextResponse.json({ error: 'Only farm managers can change horse profiles.' }, { status: 403 });
    const parsed = horseSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the form details.' }, { status: 400 });
    const body = parsed.data;

    const horse = await prisma.horse.create({
      data: {
        farmId: access.farmId,
        name: body.name,
        breed: body.breed,
        age: body.age,
        colorMarkings: body.colorMarkings,
        notes: body.notes,
        rideIntervalDays: body.rideIntervalDays,
        washIntervalDays: body.washIntervalDays,
        status: body.status,
      },
    });

    // Force refresh
    revalidatePath('/horses');
    revalidatePath('/dashboard');

    return NextResponse.json(horse);
  } catch (error) {
    console.error('Error creating horse:', error);
    return NextResponse.json(
      { error: 'Failed to create horse' },
      { status: 500 }
    );
  }
}