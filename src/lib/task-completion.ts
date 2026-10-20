import { z } from 'zod';
import { prisma } from './prisma';
import { canManageFarm } from './permissions';
import { completionDetails } from './completion-details';
import { validateFormData } from './request-limits';

type Actor = { farmId: string; user: { id: string; name: string | null; email: string } };
export class TaskCompletionError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

export async function recordFarmCompletion(data: FormData, { farmId, user }: Actor) {
  validateFormData(data);
  const id = z.string().min(1).max(100).parse(data.get('id'));
  await prisma.$transaction(async tx => {
    await tx.farm.update({ where: { id: farmId }, data: { updatedAt: new Date() } });
    const actor = await tx.farmMember.findUnique({ where: { farmId_userId: { farmId, userId: user.id } } });
    if (actor?.status !== 'ACTIVE') throw new TaskCompletionError('Active membership required.', 403);
    const task = await tx.farmTask.findFirst({ where: { id, farmId, ...(!canManageFarm(actor.role) ? { assignedMemberId: actor.id } : {}) } });
    if (!task) throw new TaskCompletionError('This task is no longer assigned to you or is unavailable.', 404);
    // A retry after a lost response must not overwrite the original completion.
    if (task.completedAt) return;
    await tx.farmTask.update({ where: { id }, data: { completedAt: new Date(), completedByName: user.name || user.email } });
  });
}

export async function recordCareCompletion(data: FormData, { farmId, user }: Actor) {
  validateFormData(data);
  let details: ReturnType<typeof completionDetails>;
  try { details = completionDetails(data); }
  catch { throw new TaskCompletionError('Check the completion notes, product, and cost.', 400); }
  const id = z.string().min(1).max(100).parse(data.get('id'));
  const expectedDue = z.string().datetime().parse(data.get('expectedDueDate'));
  return prisma.$transaction(async tx => {
    await tx.farm.update({ where: { id: farmId }, data: { updatedAt: new Date() } });
    const actor = await tx.farmMember.findUnique({ where: { farmId_userId: { farmId, userId: user.id } } });
    if (actor?.status !== 'ACTIVE') throw new TaskCompletionError('Active membership required.', 403);
    const item = await tx.vetItem.findFirst({ where: { id, horse: { farmId } } });
    if (!item) throw new TaskCompletionError('Care task unavailable.', 404);
    if (!item.nextDueDate || item.nextDueDate.toISOString() !== expectedDue) throw new TaskCompletionError('This occurrence was already completed or changed. Refresh to see the current schedule.');
    const completedAt = new Date();
    const nextDueDate = item.intervalDays ? new Date(completedAt.getTime() + item.intervalDays * 86400000) : null;
    const updated = await tx.vetItem.updateMany({ where: { id, updatedAt: item.updatedAt, nextDueDate: item.nextDueDate }, data: { lastDoneDate: completedAt, nextDueDate } });
    if (updated.count !== 1) throw new TaskCompletionError('This task changed. Refresh before completing it.');
    if (item.lastDoneDate && !await tx.careCompletion.findFirst({ where: { careItemId: id } })) {
      await tx.careCompletion.create({ data: { horseId: item.horseId, careItemId: id, completedAt: item.lastDoneDate, itemName: item.itemName, itemType: item.itemType, vetName: item.vetName, notes: item.notes, legacy: true } });
    }
    await tx.careCompletion.create({ data: { horseId: item.horseId, careItemId: id, completedAt, itemName: item.itemName, itemType: item.itemType, vetName: item.vetName, notes: item.notes, completedByName: user.name || user.email, ...details } });
    return item.horseId;
  });
}
