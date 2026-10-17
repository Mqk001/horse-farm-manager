'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireFarm } from '@/lib/farm-access';
import { prisma } from '@/lib/prisma';
import { canManageFarm } from '@/lib/permissions';
import { parseCareDate } from '@/lib/care-dates';

function refresh() { revalidatePath('/team'); revalidatePath('/dashboard'); }
export async function createFarmTask(data: FormData) {
  const { farmId, user } = await requireFarm();
  const title = z.string().trim().min(1).max(300).parse(data.get('title'));
  const assignedMemberId = z.string().min(1).parse(data.get('assignedMemberId'));
  const dueValue = data.get('dueDate')?.toString();
  const dueDate = dueValue ? parseCareDate(dueValue) : null;
  await prisma.$transaction(async tx => {
    await tx.farm.update({ where: { id: farmId }, data: { updatedAt: new Date() } });
    const actor = await tx.farmMember.findUnique({ where: { farmId_userId: { farmId, userId: user.id } } });
    if (actor?.status !== 'ACTIVE' || !canManageFarm(actor.role)) throw new Error('Only active managers can assign tasks.');
    if (!await tx.farmMember.findFirst({ where: { id: assignedMemberId, farmId, status: 'ACTIVE' } })) throw new Error('Select an active teammate.');
    await tx.farmTask.create({ data: { farmId, title, assignedMemberId, dueDate } });
  });
  refresh();
}
export async function completeFarmTask(data: FormData) {
  const { farmId, user } = await requireFarm();
  const id = z.string().min(1).parse(data.get('id'));
  await prisma.$transaction(async tx => {
    await tx.farm.update({ where: { id: farmId }, data: { updatedAt: new Date() } });
    const actor = await tx.farmMember.findUnique({ where: { farmId_userId: { farmId, userId: user.id } } });
    if (actor?.status !== 'ACTIVE') throw new Error('Active membership required.');
    const result = await tx.farmTask.updateMany({ where: { id, farmId, completedAt: null, ...(!canManageFarm(actor.role) ? { assignedMemberId: actor.id } : {}) }, data: { completedAt: new Date(), completedByName: user.name || user.email } });
    if (result.count !== 1) throw new Error('Task unavailable or already completed.');
  });
  refresh();
}
export async function assignFarmTask(data: FormData) {
  const { farmId, user } = await requireFarm();
  const id = z.string().min(1).parse(data.get('id'));
  const assignedMemberId = data.get('assignedMemberId')?.toString() || null;
  await prisma.$transaction(async tx => {
    await tx.farm.update({ where: { id: farmId }, data: { updatedAt: new Date() } });
    const actor = await tx.farmMember.findUnique({ where: { farmId_userId: { farmId, userId: user.id } } });
    if (actor?.status !== 'ACTIVE' || !canManageFarm(actor.role)) throw new Error('Only active managers can assign tasks.');
    if (assignedMemberId && !await tx.farmMember.findFirst({ where: { id: assignedMemberId, farmId, status: 'ACTIVE' } })) throw new Error('Select an active teammate.');
    const result = await tx.farmTask.updateMany({ where: { id, farmId, completedAt: null }, data: { assignedMemberId } });
    if (result.count !== 1) throw new Error('Open task not found.');
  });
  refresh();
}

export async function dismissCompletedTask(data: FormData) {
  const { farmId, user } = await requireFarm();
  const id = z.string().min(1).parse(data.get('id'));
  const kind = z.enum(['farm', 'care']).parse(data.get('kind'));
  await prisma.$transaction(async tx => {
    await tx.farm.update({ where: { id: farmId }, data: { updatedAt: new Date() } });
    const actor = await tx.farmMember.findUnique({ where: { farmId_userId: { farmId, userId: user.id } } });
    if (actor?.status !== 'ACTIVE' || !canManageFarm(actor.role)) throw new Error('Only active managers can dismiss completed work.');
    const result = kind === 'farm'
      ? await tx.farmTask.updateMany({ where: { id, farmId, completedAt: { not: null }, dismissedAt: null }, data: { dismissedAt: new Date() } })
      : await tx.careCompletion.updateMany({ where: { id, horse: { farmId }, dismissedAt: null }, data: { dismissedAt: new Date() } });
    if (result.count !== 1) throw new Error('Completed work unavailable or already dismissed.');
  });
  refresh();
}
