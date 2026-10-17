import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export type TimelineParams = { from?: string; to?: string; kind?: string; month?: string; page?: string };
const PAGE_SIZE = 25;
function validDate(value: string | undefined) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function HorseTimeline({ horseId, farmId, filters }: { horseId: string; farmId: string; filters: TimelineParams }) {
  const from = validDate(filters.from) ? filters.from! : '';
  const to = validDate(filters.to) ? filters.to! : '';
  const invalid = Boolean((filters.from && !from) || (filters.to && !to) || (from && to && from > to));
  const now = new Date();
  const month = typeof filters.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(filters.month) && Number(filters.month.slice(0, 4)) >= 1000 ? filters.month : now.toISOString().slice(0, 7);
  const monthStart = new Date(`${month}-01T00:00:00Z`);
  const monthEnd = new Date(monthStart); monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  const kind = ['ride', 'grooming', 'care'].includes(filters.kind ?? '') ? filters.kind! : '';
  const page = Math.min(1000, Math.max(1, Number.parseInt(filters.page ?? '1', 10) || 1));
  const dateRange = { ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}), ...(to ? { lt: new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400000) } : {}) };
  const scope = { horseId, horse: { farmId } };
  const limit = page * PAGE_SIZE + 1;
  const [rides, washes, care, legacyCare, monthly] = await Promise.all([
    !invalid && (!kind || kind === 'ride') ? prisma.rideLog.findMany({ where: { ...scope, dateTime: dateRange }, orderBy: [{ dateTime: 'desc' }, { id: 'asc' }], take: limit }) : [],
    !invalid && (!kind || kind === 'grooming') ? prisma.washLog.findMany({ where: { ...scope, dateTime: dateRange }, orderBy: [{ dateTime: 'desc' }, { id: 'asc' }], take: limit }) : [],
    !invalid && (!kind || kind === 'care') ? prisma.careCompletion.findMany({ where: { ...scope, completedAt: dateRange }, orderBy: [{ completedAt: 'desc' }, { id: 'asc' }], take: limit }) : [],
    !invalid && (!kind || kind === 'care') ? prisma.vetItem.findMany({ where: { ...scope, lastDoneDate: { not: null, ...dateRange }, completions: { none: {} } }, orderBy: [{ lastDoneDate: 'desc' }, { id: 'asc' }], take: limit }) : [],
    prisma.rideLog.aggregate({ where: { ...scope, dateTime: { gte: monthStart, lt: monthEnd } }, _count: { _all: true, durationMinutes: true }, _sum: { durationMinutes: true } }),
  ]);
  const events = [
    ...rides.map(r => ({ key: `ride-${r.id}`, date: r.dateTime, label: 'Ride', detail: [r.riderName, r.rideType.replaceAll('_', ' '), r.durationMinutes !== null ? `${r.durationMinutes} min` : null].filter(Boolean).join(' · '), notes: r.notes })),
    ...washes.map(w => ({ key: `groom-${w.id}`, date: w.dateTime, label: 'Grooming', detail: w.type.replaceAll('_', ' '), notes: w.notes })),
    ...care.map(c => ({ key: `care-${c.id}`, date: c.completedAt, label: c.legacy ? 'Earlier care record' : 'Care completed', detail: [c.itemName, c.vetName, c.completedByName ? `Recorded by ${c.completedByName}` : null].filter(Boolean).join(' · '), notes: c.notes })),
    ...legacyCare.map(c => ({ key: `legacy-${c.id}`, date: c.lastDoneDate!, label: 'Earlier care record', detail: [c.itemName, c.vetName].filter(Boolean).join(' · '), notes: c.notes })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime() || a.key.localeCompare(b.key));
  const visible = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  function pageLink(nextPage: number) {
    const query = new URLSearchParams({ from, to, kind, month, page: String(nextPage) });
    return `/horses/${horseId}?${query}#activity-timeline`;
  }
  return <section id="activity-timeline" className="premium-card overflow-hidden rounded-3xl">
    <header className="border-b border-[#e5e2d9] px-6 py-5"><p className="eyebrow">Stable log</p><h2 className="mt-1 font-display text-2xl">Activity timeline</h2><p className="mt-2 text-xs text-[#68736b]">Rides, grooming, and completed care. Dates use UTC. Earlier care records contain only the last completion saved before history tracking began.</p></header>
    <form action={`/horses/${horseId}#activity-timeline`} className="reinwell-form grid gap-4 border-b border-[#e5e2d9] p-6 sm:grid-cols-2">
      <label>From date<input name="from" type="date" defaultValue={from} /></label>
      <label>To date<input name="to" type="date" defaultValue={to} /></label>
      <label>Activity type<select name="kind" defaultValue={kind}><option value="">All activity</option><option value="ride">Rides</option><option value="grooming">Grooming</option><option value="care">Completed care</option></select></label>
      <label>Ride summary month<input name="month" type="month" defaultValue={month} min="1000-01" max="9999-12" /></label>
      <div className="flex flex-wrap gap-3 sm:col-span-2"><button className="button-primary">Apply timeline filters</button><a href={`/horses/${horseId}#activity-timeline`} className="button-secondary">Clear timeline filters</a></div>
    </form>
    <div aria-label="Monthly ride summary" className="border-b border-[#e5e2d9] px-6 py-5"><h3 className="text-sm font-bold">{monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })} rides</h3><p className="mt-2 text-sm">{monthly._count._all} rides · {monthly._sum.durationMinutes ?? 0} recorded minutes</p><p className="mt-1 text-xs text-[#68736b]">{monthly._count._all - monthly._count.durationMinutes} rides without a duration. Monthly totals are independent of timeline filters.</p></div>
    {invalid ? <p role="alert" className="form-error p-6">Enter valid dates with the from date on or before the to date.</p> : visible.length === 0 ? <p role="status" className="p-6 text-sm text-[#68736b]">No activity in this range. Try different filters.</p> : <ol className="divide-y divide-[#e8e5dc]">{visible.map(event => <li key={event.key} className="px-6 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">{event.label}</h3><time dateTime={event.date.toISOString()} className="text-xs text-[#68736b]">{event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</time></div><p className="mt-1 break-words text-xs text-[#68736b]">{event.detail}</p>{event.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#667169]">{event.notes}</p>}</li>)}</ol>}
    {!invalid && <nav aria-label="Timeline pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e2d9] p-6"><span className="text-xs text-[#68736b]">Page {page} · {visible.length} entries</span><div className="flex gap-3">{page > 1 && <Link href={pageLink(page - 1)} className="button-secondary">Newer activity</Link>}{events.length > page * PAGE_SIZE && page < 1000 && <Link href={pageLink(page + 1)} className="button-secondary">Older activity</Link>}</div></nav>}
  </section>;
}
