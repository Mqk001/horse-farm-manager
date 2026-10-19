import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { verifyUnsubscribeToken } from '@/lib/reminder-security';
import { singleParams } from '@/lib/input-validation';
import { unsubscribeCareReminders } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Email reminders · Reinwell', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token, done } = singleParams(await searchParams);
  const verified = token ? verifyUnsubscribeToken(token) : null;
  const member = verified ? await prisma.farmMember.findFirst({ where: { id: verified.memberId, reminderVersion: verified.version, careReminderEnabled: true }, select: { farm: { select: { name: true } } } }) : null;
  return <main className="login-page"><section className="premium-card mx-auto max-w-lg rounded-3xl p-8">
    <h1 className="font-display text-3xl">{done === '1' ? 'Reminders turned off' : 'Email reminders'}</h1>
    {member ? <><p className="my-5 text-sm">Turn off daily care emails for {member.farm.name}? Your account and assignments stay the same.</p>
      <form action={unsubscribeCareReminders}><input type="hidden" name="token" value={token} /><button className="button-primary">Turn off reminders</button></form></> :
      <p className="my-5 text-sm">{done === '1' ? 'You can turn them back on from the Care page.' : 'This link is no longer valid. You can manage reminders from the Care page.'}</p>}
    <Link href="/care" className="mt-5 inline-block text-sm underline">Go to Care</Link>
  </section></main>;
}
