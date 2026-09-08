import { getFarmAccess } from '@/lib/farm-access';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getFarmAccess();
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    const { id } = await params;
    if (!await prisma.horse.findFirst({ where: { id, farmId: access.farmId } })) return NextResponse.json({ error: 'Horse not found' }, { status: 404 });
    const horse = await prisma.horse.findUnique({
      where: { id, farmId: access.farmId },
    });

    if (!horse) {
      return NextResponse.json({ error: 'Horse not found' }, { status: 404 });
    }

    return NextResponse.json(horse);
  } catch (error) {
    console.error('Error fetching horse:', error);
    return NextResponse.json(
      { error: 'Failed to fetch horse' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getFarmAccess();
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    const { id } = await params;
    if (!await prisma.horse.findFirst({ where: { id, farmId: access.farmId } })) return NextResponse.json({ error: 'Horse not found' }, { status: 404 });
    const body = await request.json();

    const horse = await prisma.horse.update({
      where: { id, farmId: access.farmId },
      data: {
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
    revalidatePath(`/horses/${id}`);

    return NextResponse.json(horse);
  } catch (error) {
    console.error('Error updating horse:', error);
    return NextResponse.json(
      { error: 'Failed to update horse' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getFarmAccess();
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    const { id } = await params;
    if (!await prisma.horse.findFirst({ where: { id, farmId: access.farmId } })) return NextResponse.json({ error: 'Horse not found' }, { status: 404 });

    await prisma.horse.delete({
      where: { id, farmId: access.farmId },
    });

    // Force refresh
    revalidatePath('/horses');
    revalidatePath('/dashboard');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting horse:', error);
    return NextResponse.json(
      { error: 'Failed to delete horse' },
      { status: 500 }
    );
  }
}