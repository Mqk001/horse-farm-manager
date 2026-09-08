import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getDaysSince } from '@/lib/utils';
import { AlertCircle, ArrowUpRight, CalendarDays, CheckCircle2, Clock3, ShieldCheck, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function timeAgo(date: Date) {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export default async function Dashboard() {
  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const nextWeek = new Date(now); nextWeek.setDate(now.getDate() + 7);
  const today = new Date(now); today.setHours(0, 0, 0, 0);

  const [horses, ridesThisWeek, recentRides, recentWashes, careItems] = await Promise.all([
    prisma.horse.findMany({
      where: { status: { not: 'RETIRED' } },
      orderBy: { name: 'asc' },
      include: { rides: { orderBy: { dateTime: 'desc' }, take: 1 }, washes: { orderBy: { dateTime: 'desc' }, take: 1 } },
    }),
    prisma.rideLog.count({ where: { dateTime: { gte: weekAgo } } }),
    prisma.rideLog.findMany({ orderBy: { dateTime: 'desc' }, take: 5, include: { horse: true } }),
    prisma.washLog.findMany({ orderBy: { dateTime: 'desc' }, take: 5, include: { horse: true } }),
    prisma.vetItem.findMany({ where: { nextDueDate: { not: null, lte: nextWeek } }, include: { horse: true }, orderBy: { nextDueDate: 'asc' } }),
  ]);

  const overdueHorses = horses.filter((horse) => {
    const rideDays = horse.rides[0] ? getDaysSince(horse.rides[0].dateTime) : null;
    const washDays = horse.washes[0] ? getDaysSince(horse.washes[0].dateTime) : null;
    return (rideDays !== null && rideDays > horse.rideIntervalDays) || (washDays !== null && washDays > horse.washIntervalDays);
  });
  const overdueCare = careItems.filter((item) => item.nextDueDate! < today);
  const upcomingCare = careItems.filter((item) => item.nextDueDate! >= today);
  const attentionCount = overdueHorses.length + overdueCare.length;
  const activities = [
    ...recentRides.map((item) => ({ id: item.id, kind: 'Ride', horse: item.horse.name, detail: item.riderName, date: item.dateTime })),
    ...recentWashes.map((item) => ({ id: item.id, kind: 'Grooming', horse: item.horse.name, detail: item.type.replaceAll('_', ' '), date: item.dateTime })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);

  return (
    <main className="page-shell">
      <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{formatDate(now)}</p>
          <h1 className="mt-3 font-display text-4xl text-[#17201a] sm:text-5xl">{greeting()}.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#657067]">A considered view of your stable—what needs attention, what is scheduled, and how every horse is doing.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#d8d7cd] bg-white/60 px-4 py-2 text-xs font-semibold text-[#516057]">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Live stable overview
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Active horses', value: horses.length, icon: Sparkles, tone: 'text-[#315c47]', bg: 'bg-[#e4ece5]' },
          { label: 'Needs attention', value: attentionCount, icon: AlertCircle, tone: attentionCount ? 'text-[#a24b35]' : 'text-[#315c47]', bg: attentionCount ? 'bg-[#f4e5df]' : 'bg-[#e4ece5]' },
          { label: 'Rides this week', value: ridesThisWeek, icon: Clock3, tone: 'text-[#725f39]', bg: 'bg-[#eee7d8]' },
          { label: 'Due next 7 days', value: upcomingCare.length, icon: CalendarDays, tone: 'text-[#556a78]', bg: 'bg-[#e5eaec]' },
        ].map(({ label, value, icon: Icon, tone, bg }) => (
          <div key={label} className="premium-card rounded-2xl p-4 sm:p-5">
            <div className={`mb-5 flex h-9 w-9 items-center justify-center rounded-xl ${bg} ${tone}`}><Icon className="h-[18px] w-[18px]" strokeWidth={1.8} /></div>
            <p className="font-display text-3xl text-[#17201a] sm:text-4xl">{value}</p>
            <p className="mt-1 text-xs font-medium text-[#778078]">{label}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_.85fr]">
        <section className="premium-card overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between border-b border-[#e5e2d9] px-5 py-5 sm:px-7">
            <div><p className="eyebrow">Priority</p><h2 className="mt-1 font-display text-2xl">Today’s attention</h2></div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${attentionCount ? 'bg-[#f4e5df] text-[#97442f]' : 'bg-[#e4ece5] text-[#315c47]'}`}>{attentionCount ? `${attentionCount} open` : 'All clear'}</span>
          </div>
          {attentionCount === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e4ece5] text-[#315c47]"><ShieldCheck className="h-6 w-6" /></div>
              <h3 className="mt-5 font-display text-2xl">Everything is on schedule</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#778078]">No overdue activity or care is waiting for your attention today.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#ebe8df]">
              {overdueCare.slice(0, 4).map((item) => (
                <Link key={item.id} href={`/care?horseId=${item.horseId}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-white sm:px-7">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4e5df] text-[#a24b35]"><CalendarDays className="h-[18px] w-[18px]" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#26332a]">{item.itemName}</p><p className="mt-1 text-xs text-[#7b837c]">{item.horse.name} · overdue care</p></div>
                  <ArrowUpRight className="h-4 w-4 text-[#a9afa9] transition group-hover:text-[#183d2f]" />
                </Link>
              ))}
              {overdueHorses.slice(0, Math.max(0, 5 - overdueCare.length)).map((horse) => (
                <Link key={horse.id} href={`/horses/${horse.id}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-white sm:px-7">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eee7d8] font-display text-lg text-[#725f39]">{horse.name.charAt(0)}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#26332a]">{horse.name}</p><p className="mt-1 text-xs text-[#7b837c]">Ride or grooming schedule needs review</p></div>
                  <ArrowUpRight className="h-4 w-4 text-[#a9afa9] transition group-hover:text-[#183d2f]" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="premium-card overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between border-b border-[#e5e2d9] px-5 py-5 sm:px-6">
            <div><p className="eyebrow">Coming up</p><h2 className="mt-1 font-display text-2xl">Care schedule</h2></div>
            <Link href="/care" className="text-xs font-bold text-[#315c47] hover:text-[#183d2f]">View all</Link>
          </div>
          <div className="p-3">
            {upcomingCare.length === 0 ? <p className="px-3 py-12 text-center text-sm text-[#7b837c]">No care due this week.</p> : upcomingCare.slice(0, 5).map((item) => (
              <Link key={item.id} href={`/care?horseId=${item.horseId}`} className="flex items-center gap-4 rounded-2xl px-3 py-3 hover:bg-white">
                <div className="w-11 shrink-0 text-center"><p className="text-[10px] font-bold uppercase tracking-wider text-[#a17c42]">{item.nextDueDate!.toLocaleDateString('en-US', { month: 'short' })}</p><p className="font-display text-2xl leading-none">{item.nextDueDate!.getDate()}</p></div>
                <div className="h-8 w-px bg-[#e2dfd5]" />
                <div className="min-w-0"><p className="truncate text-sm font-bold">{item.itemName}</p><p className="mt-1 truncate text-xs text-[#7b837c]">{item.horse.name} · {item.itemType.replaceAll('_', ' ')}</p></div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="premium-card mt-6 overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between border-b border-[#e5e2d9] px-5 py-5 sm:px-7"><div><p className="eyebrow">Stable log</p><h2 className="mt-1 font-display text-2xl">Recent activity</h2></div><CheckCircle2 className="h-5 w-5 text-[#8fa896]" /></div>
        {activities.length === 0 ? <p className="px-7 py-12 text-center text-sm text-[#7b837c]">Activity will appear here as your team records it.</p> : (
          <div className="grid divide-y divide-[#ebe8df] md:grid-cols-2 md:divide-x md:divide-y-0">
            {activities.map((activity) => (
              <div key={`${activity.kind}-${activity.id}`} className="flex items-center gap-4 px-5 py-4 sm:px-7">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d9ded8] bg-[#eef2ed] font-display text-lg text-[#315c47]">{activity.horse.charAt(0)}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{activity.horse} <span className="font-normal text-[#7b837c]">· {activity.kind}</span></p><p className="mt-1 truncate text-xs text-[#8b918c]">{activity.detail}</p></div>
                <span className="whitespace-nowrap text-[11px] text-[#9ba09b]">{timeAgo(activity.date)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
