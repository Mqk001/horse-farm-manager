  import { NextResponse } from 'next/server';
  import { prisma } from '@/lib/prisma';
  import { revalidatePath } from 'next/cache';

  export async function POST(request: Request) {
    try {
      const body = await request.json();

      const wash = await prisma.washLog.create({
        data: {
          horseId: body.horseId,
          dateTime: new Date(body.dateTime),
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