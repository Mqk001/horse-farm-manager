'use server';

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
});

function parseDateInput(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
  return date;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
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
  });

  const { farmId } = await requireFarm();
  if (!await prisma.horse.findFirst({ where: { id: parsed.horseId, farmId } })) throw new Error('Horse not found');
  await prisma.vetItem.create({
    data: {
      horseId: parsed.horseId,
      itemType: parsed.itemType,
      itemName: parsed.itemName,
      nextDueDate: parseDateInput(parsed.nextDueDate),
      intervalDays: parsed.intervalDays,
      vetName: parsed.vetName,
      notes: parsed.notes,
    },
  });

  refreshCareViews(parsed.horseId);
}

export async function completeCareItem(formData: FormData) {
  const { farmId } = await requireFarm();
  const id = z.string().min(1).parse(formData.get('id'));
  const item = await prisma.vetItem.findFirst({ where: { id, horse: { farmId } } });
  if (!item) throw new Error('Care item not found');

  const completedAt = new Date();
  await prisma.vetItem.update({
    where: { id },
    data: {
      lastDoneDate: completedAt,
      nextDueDate: item.intervalDays
        ? addDays(completedAt, item.intervalDays)
        : null,
    },
  });

  refreshCareViews(item.horseId);
}

export async function rescheduleCareItem(formData: FormData) {
  const { farmId } = await requireFarm();
  const id = z.string().min(1).parse(formData.get('id'));
  const dueDate = z.string().min(1).parse(formData.get('nextDueDate'));
  const item = await prisma.vetItem.findFirst({ where: { id, horse: { farmId } } });
  if (!item) throw new Error('Care item not found');
  await prisma.vetItem.update({ where: { id }, data: { nextDueDate: parseDateInput(dueDate) } });

  refreshCareViews(item.horseId);
}
