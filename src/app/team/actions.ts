'use server';
import { recordFarmCompletion } from '@/lib/task-completion';
import { invalidateTeamRevision } from '@/lib/team-revision';
import { validateFormData } from '@/lib/request-limits';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireFarm } from '@/lib/farm-access';
import { prisma } from '@/lib/prisma';
import { canManageFarm } from '@/lib/permissions';
import { parseCareDate } from '@/lib/care-dates';

function refresh(farmId: string) { invalidateTeamRevision(farmId); revalidatePath('/team'); revalidatePath('/dashboard'); }
export async function createFarmTask(data: FormData) {
  validateFormData(data);
  const { farmId, user } = await requireFarm();
  const title = z.string().trim().min(1).max(300).parse(data.get('title'));
  const assignedMemberId = z.string().min(1).max(100).parse(data.get('assignedMemberId'));
  const dueValue = data.get('dueDate')?.toString();
  const dueDate = dueValue ? parseCareDate(dueValue) : null;
  await prisma.$transaction(async tx => {
    await tx.farm.update({ where: { id: farmId }, data: { updatedAt: new Date() } });
    const actor = await tx.farmMember.findUnique({ where: { farmId_userId: { farmId, userId: user.id } } });
    if (actor?.status !== 'ACTIVE' || !canManageFarm(actor.role)) throw new Error('Only active managers can assign tasks.');
    if (!await tx.farmMember.findFirst({ where: { id: assignedMemberId, farmId, status: 'ACTIVE' } })) throw new Error('Select an active teammate.');
    await tx.farmTask.create({ data: { farmId, title, assignedMemberId, dueDate } });
  });
  refresh(farmId);
}
export async function completeFarmTask(data: FormData) {
  const { farmId, user } = await requireFarm();
  await recordFarmCompletion(data, { farmId, user });
  refresh(farmId);
}

export async function assignFarmTask(data: FormData) {
  validateFormData(data);
  const { farmId, user } = await requireFarm();
  const id = z.string().min(1).max(100).parse(data.get('id'));
  const assignedMemberId = data.get('assignedMemberId')?.toString() || null;
  await prisma.$transaction(async tx => {
    await tx.farm.update({ where: { id: farmId }, data: { updatedAt: new Date() } });
    const actor = await tx.farmMember.findUnique({ where: { farmId_userId: { farmId, userId: user.id } } });
    if (actor?.status !== 'ACTIVE' || !canManageFarm(actor.role)) throw new Error('Only active managers can assign tasks.');
    if (assignedMemberId && !await tx.farmMember.findFirst({ where: { id: assignedMemberId, farmId, status: 'ACTIVE' } })) throw new Error('Select an active teammate.');
    const result = await tx.farmTask.updateMany({ where: { id, farmId, completedAt: null }, data: { assignedMemberId } });
    if (result.count !== 1) throw new Error('Open task not found.');
  });
  refresh(farmId);
}

export async function dismissCompletedTask(data: FormData) {
  validateFormData(data);
  const { farmId, user } = await requireFarm();
  const id = z.string().min(1).max(100).parse(data.get('id'));
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
  refresh(farmId);
}

export async function restoreDismissedTask(data: FormData) {
  validateFormData(data);
  const { farmId, user } = await requireFarm();
  const id = z.string().min(1).max(100).parse(data.get('id'));
  const kind = z.enum(['farm', 'care']).parse(data.get('kind'));
  await prisma.$transaction(async tx => {
    await tx.farm.update({ where: { id: farmId }, data: { updatedAt: new Date() } });
    const actor = await tx.farmMember.findUnique({ where: { farmId_userId: { farmId, userId: user.id } } });
    if (actor?.status !== 'ACTIVE' || !canManageFarm(actor.role)) throw new Error('Only active managers can restore dismissed work.');
    const result = kind === 'farm'
      ? await tx.farmTask.updateMany({ where: { id, farmId, completedAt: { not: null }, dismissedAt: { not: null } }, data: { dismissedAt: null } })
      : await tx.careCompletion.updateMany({ where: { id, horse: { farmId }, dismissedAt: { not: null } }, data: { dismissedAt: null } });
    if (result.count !== 1) throw new Error('Dismissed work unavailable or already restored.');
  });
  refresh(farmId);
}
