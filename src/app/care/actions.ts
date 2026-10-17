'use server';
import { parseCareDate } from '@/lib/care-dates';

import { canManageFarm } from '@/lib/permissions';
import { requireFarm } from '@/lib/farm-access';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const optionalText = z.string().trim().transform((value) => value || undefined);

const createCareItemSchema = z.object({
  horseId: z.string().min(1),
  itemType: z.string().trim().min(1).max(40),
  itemName: z.string().trim().min(1).max(100),
  nextDueDate: z.string().min(1),
  intervalDays: z.coerce.number().int().positive().max(3650).optional(),
  vetName: optionalText,
  notes: optionalText,
  assignedMemberId: optionalText,
});

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function refreshCareViews(horseId: string) {
  revalidatePath('/care');
  revalidatePath('/dashboard');
  revalidatePath('/horses');
  revalidatePath(`/horses/${horseId}`);
}

export async function createCareItem(formData: FormData) {
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

  refreshCareViews(parsed.horseId);
}

export async function completeCareItem(formData: FormData) {
  const { farmId, user } = await requireFarm();
  const id = z.string().min(1).parse(formData.get('id'));
  const item = await prisma.vetItem.findFirst({ where: { id, horse: { farmId } } });
  if (!item || !item.nextDueDate) throw new Error('Scheduled care item not found');
  const expectedDue = formData.get('expectedDueDate')?.toString();
  if (expectedDue && expectedDue !== item.nextDueDate.toISOString()) throw new Error('This task changed. Refresh before completing it.');
  const completedAt = new Date();
  await prisma.$transaction(async tx => {
    const updated = await tx.vetItem.updateMany({
      where: { id, horse: { farmId }, updatedAt: item.updatedAt, nextDueDate: item.nextDueDate },
      data: { lastDoneDate: completedAt, nextDueDate: item.intervalDays ? addDays(completedAt, item.intervalDays) : null },
    });
    if (updated.count !== 1) throw new Error('This task changed. Refresh before completing it.');
    // Preserve the existing latest completion when upgrading a local database
    // without the PostgreSQL migration's backfill.
    if (item.lastDoneDate && !await tx.careCompletion.findFirst({ where: { careItemId: id } })) {
      await tx.careCompletion.create({ data: { horseId: item.horseId, careItemId: id, completedAt: item.lastDoneDate, itemName: item.itemName, itemType: item.itemType, vetName: item.vetName, notes: item.notes, legacy: true } });
    }
    await tx.careCompletion.create({ data: { horseId: item.horseId, careItemId: id, completedAt, itemName: item.itemName, itemType: item.itemType, vetName: item.vetName, notes: item.notes, completedByName: user.name ?? user.email } });
  });
  refreshCareViews(item.horseId);
}

export async function assignCareItem(formData: FormData) {
  const { farmId, membership } = await requireFarm();
  if (!['MANAGER', 'SUPER_ADMIN'].includes(membership.role)) throw new Error('Only managers can assign care');
  const id = z.string().min(1).parse(formData.get('id'));
  const assignedMemberId = formData.get('assignedMemberId')?.toString() || null;
  const item = await prisma.vetItem.findFirst({ where: { id, horse: { farmId } } });
  if (!item) throw new Error('Care item not found');
  await prisma.$transaction(async tx => {
    if (assignedMemberId && !await tx.farmMember.findFirst({ where: { id: assignedMemberId, farmId, status: 'ACTIVE' } })) throw new Error('Select an active farm member');
    await tx.vetItem.update({ where: { id, horse: { farmId } }, data: { assignedMemberId } });
  });
  refreshCareViews(item.horseId);
}

export async function rescheduleCareItem(formData: FormData) {
  const { farmId, membership } = await requireFarm();
  if (!canManageFarm(membership.role)) throw new Error('Only farm managers can schedule or reschedule care.');
  const id = z.string().min(1).parse(formData.get('id'));
  const dueDate = z.string().min(1).parse(formData.get('nextDueDate'));
  const item = await prisma.vetItem.findFirst({ where: { id, horse: { farmId } } });
  if (!item) throw new Error('Care item not found');
  await prisma.vetItem.update({ where: { id, horse: { farmId } }, data: { nextDueDate: parseCareDate(dueDate) } });

  refreshCareViews(item.horseId);
}
