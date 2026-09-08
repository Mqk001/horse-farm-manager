import { getFarmAccess } from '@/lib/farm-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const access = await getFarmAccess();
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    const body = await request.json();

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