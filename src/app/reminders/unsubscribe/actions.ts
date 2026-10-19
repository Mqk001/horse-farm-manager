'use server';
import { prisma } from '@/lib/prisma';
import { verifyUnsubscribeToken } from '@/lib/reminder-security';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { validateFormData } from '@/lib/request-limits';

export async function unsubscribeCareReminders(data: FormData) {
  validateFormData(data);
  const value = data.get('token');
  const verified = typeof value === 'string' ? verifyUnsubscribeToken(value) : null;
  if (!verified) redirect('/reminders/unsubscribe?invalid=1');
  const updated = await prisma.farmMember.updateMany({ where: { id: verified.memberId, reminderVersion: verified.version, careReminderEnabled: true },
    data: { careReminderEnabled: false, reminderVersion: { increment: 1 } } });
  revalidatePath('/care');
  redirect(`/reminders/unsubscribe?${updated.count ? 'done' : 'invalid'}=1`);
}
