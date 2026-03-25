import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const ride = await prisma.rideLog.create({
      data: {
        horseId: body.horseId,
        dateTime: new Date(body.dateTime),
        riderName: body.riderName,
        rideType: body.rideType,
        durationMinutes: body.durationMinutes,
        notes: body.notes,
      },
    });

    // Force refresh of relevant pages
    revalidatePath('/horses');
    revalidatePath('/dashboard');
    revalidatePath(`/horses/${body.horseId}`);

    return NextResponse.json(ride);
  } catch (error) {
    console.error('Error creating ride:', error);
    return NextResponse.json({ error: 'Failed to log ride' }, { status: 500 });
  }
}