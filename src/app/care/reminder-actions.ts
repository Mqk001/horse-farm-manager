'use server';
import { requireFarm } from '@/lib/farm-access';
import { prisma } from '@/lib/prisma';
import { remindersAvailable } from '@/lib/reminder-security';
import { revalidatePath } from 'next/cache';
import { validateFormData } from '@/lib/request-limits';
import { reminderPreferencesSchema } from '@/lib/reminder-preferences';

export async function saveCareReminderPreferences(data: FormData) {
  validateFormData(data);
  const preference = reminderPreferencesSchema.parse({ leadDays: data.get('leadDays'), hourUTC: data.get('hourUTC') });
  const { membership, user } = await requireFarm();
  const updated = await prisma.farmMember.updateMany({ where: { id: membership.id, userId: user.id, status: 'ACTIVE', user: { emailVerifiedAt: { not: null } } },
    data: { careReminderLeadDays: preference.leadDays, careReminderHourUTC: preference.hourUTC, reminderVersion: { increment: 1 } } });
  if (!updated.count) throw new Error('Active membership required.');
  revalidatePath('/care');
}

export async function setCareReminders(enabled: boolean) {
  if (typeof enabled !== 'boolean') throw new Error('Invalid reminder preference.');
  const { membership, user } = await requireFarm();
  if (enabled && !remindersAvailable()) throw new Error('Reminder delivery is not yet available.');
  const result = await prisma.farmMember.updateMany({ where: { id: membership.id, userId: user.id, status: 'ACTIVE', user: { emailVerifiedAt: { not: null } } },
    data: { careReminderEnabled: enabled, reminderVersion: { increment: 1 } } });
  if (!result.count) throw new Error('An active membership and verified email are required.');
  revalidatePath('/care');
}
