'use server';
import { invalidateTeamRevision } from '@/lib/team-revision';
import { validateFormData } from '@/lib/request-limits';
import { parseCareDate } from '@/lib/care-dates';

import { canManageFarm } from '@/lib/permissions';
import { requireFarm } from '@/lib/farm-access';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { recordCareCompletion } from '@/lib/task-completion';

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || undefined);

const createCareItemSchema = z.object({
  horseId: z.string().min(1).max(100),
  itemType: z.string().trim().min(1).max(40),
  itemName: z.string().trim().min(1).max(100),
  nextDueDate: z.string().length(10),
  intervalDays: z.coerce.number().int().positive().max(3650).optional(),
  vetName: optionalText(100),
  notes: optionalText(10000),
  assignedMemberId: optionalText(100),
});

function refreshCareViews(horseId: string, farmId: string) {
  invalidateTeamRevision(farmId);
  revalidatePath('/care');
  revalidatePath('/team');
  revalidatePath('/dashboard');
  revalidatePath('/horses');
  revalidatePath(`/horses/${horseId}`);
}

export async function createCareItem(formData: FormData) {
  validateFormData(formData);
  const intervalValue = formData.get('intervalDays')?.toString().trim();
  const parsed = createCareItemSchema.parse({
    horseId: formData.get('horseId'),
    itemType: formData.get('itemType'),
    itemName: formData.get('itemName'),
    nextDueDate: formData.get('nextDueDate'),
    intervalDays: intervalValue ? intervalValue : undefined,
    vetName: formData.get('vetName') ?? '',
    notes: formData.get('notes') ?? '',
    assignedMemberId: formData.get('assignedMemberId') ?? '',
  });

  const { farmId, membership } = await requireFarm();
  if (!canManageFarm(membership.role)) throw new Error('Only farm managers can schedule or reschedule care.');
  if (parsed.assignedMemberId) {
    if (!['MANAGER', 'SUPER_ADMIN'].includes(membership.role)) throw new Error('Only managers can assign care');
    if (!await prisma.farmMember.findFirst({ where: { id: parsed.assignedMemberId, farmId, status: 'ACTIVE' } })) throw new Error('Select an active farm member');
  }
  if (!await prisma.horse.findFirst({ where: { id: parsed.horseId, farmId } })) throw new Error('Horse not found');
  await prisma.vetItem.create({
    data: {
      horseId: parsed.horseId,
      itemType: parsed.itemType,
      itemName: parsed.itemName,
      nextDueDate: parseCareDate(parsed.nextDueDate),
      intervalDays: parsed.intervalDays,
      vetName: parsed.vetName,
      notes: parsed.notes,
      assignedMemberId: parsed.assignedMemberId,
    },
  });

  refreshCareViews(parsed.horseId, farmId);
}

export async function completeCareItem(formData: FormData) {
  const { farmId, user } = await requireFarm();
  const horseId = await recordCareCompletion(formData, { farmId, user });
  refreshCareViews(horseId, farmId);
}

export async function assignCareItem(formData: FormData) {
  validateFormData(formData);
  const { farmId, membership } = await requireFarm();
  if (!['MANAGER', 'SUPER_ADMIN'].includes(membership.role)) throw new Error('Only managers can assign care');
  const id = z.string().min(1).max(100).parse(formData.get('id'));
  const assignedMemberId = formData.get('assignedMemberId')?.toString() || null;
  const item = await prisma.vetItem.findFirst({ where: { id, horse: { farmId } } });
  if (!item) throw new Error('Care item not found');
  await prisma.$transaction(async tx => {
    if (assignedMemberId && !await tx.farmMember.findFirst({ where: { id: assignedMemberId, farmId, status: 'ACTIVE' } })) throw new Error('Select an active farm member');
    await tx.vetItem.update({ where: { id, horse: { farmId } }, data: { assignedMemberId } });
  });
  refreshCareViews(item.horseId, farmId);
}

export async function rescheduleCareItem(formData: FormData) {
  validateFormData(formData);
  const { farmId, membership } = await requireFarm();
  if (!canManageFarm(membership.role)) throw new Error('Only farm managers can schedule or reschedule care.');
  const id = z.string().min(1).max(100).parse(formData.get('id'));
  const dueDate = z.string().min(1).max(100).parse(formData.get('nextDueDate'));
  const item = await prisma.vetItem.findFirst({ where: { id, horse: { farmId } } });
  if (!item) throw new Error('Care item not found');
  await prisma.vetItem.update({ where: { id, horse: { farmId } }, data: { nextDueDate: parseCareDate(dueDate) } });

  refreshCareViews(item.horseId, farmId);
}
