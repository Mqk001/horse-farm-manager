import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const farmSchema = z.object({ name: z.string().trim().min(2, 'Enter a farm name.').max(100) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  const parsed = farmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the farm name.' }, { status: 400 });

  const farm = await prisma.$transaction(async (tx) => {
    const created = await tx.farm.create({
      data: {
      name: parsed.data.name,
      code: `RW-${randomBytes(4).toString('hex').toUpperCase()}`,
      memberships: { create: { userId: user.id, role: 'MANAGER' } },
      },
    });
    await tx.horse.updateMany({ where: { farmId: null }, data: { farmId: created.id } });
    await tx.trainer.updateMany({ where: { farmId: null }, data: { farmId: created.id } });
    await tx.settings.updateMany({ where: { farmId: null }, data: { farmId: created.id } });
    return created;
  });
  return NextResponse.json({ farm }, { status: 201 });
}
