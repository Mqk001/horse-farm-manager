import { loadManagerPriorities } from '@/lib/manager-priorities';
import { WorkspaceLink as Link } from '@/components/WorkspaceLink';
import { prisma } from '@/lib/prisma';
import { startOfDay, displayDate } from '@/lib/care-dates';
import { displayCost } from '@/lib/completion-details';
import { dismissCompletedTask, restoreDismissedTask } from '@/app/team/actions';
import { OptimisticTaskRow } from './OptimisticTaskRow';
import { CareTaskForm } from './CareTaskForm';
import { DismissalUndoNotice } from './DismissalUndoNotice';

// Only the manager dashboard renders this server component, after requireFarm.
export async function ManagerDailyOverview({ farmId, userId }: { farmId: string; userId: string }) {
  const today = startOfDay();
  const { totals, groups } = await loadManagerPriorities(prisma, farmId, today);
  const careCount = totals.overdueCare, farmCount = totals.overdueFarm;
  const unassignedCareCount = totals.unassignedCare, unassignedFarmCount = totals.unassignedFarm;
  const reviewCareCount = totals.reviewCare, reviewFarmCount = totals.reviewFarm;
  const title = (item: (typeof groups.overdueCare)[number]) => item.horseId ? `${item.horseName} · ${item.title}` : item.title;
  const overdue = [...groups.overdueCare, ...groups.overdueFarm].map(item => ({ id: `${item.category}:${item.id}`, title: title(item), due: item.date, href: item.horseId ? `/care?horseId=${item.horseId}` : '/team#team-tasks-heading' })).sort((a, b) => a.due.getTime() - b.due.getTime()).slice(0, 5);
  const unassigned = [...groups.unassignedCare, ...groups.unassignedFarm].map(item => ({ id: `${item.category}:${item.id}`, title: title(item), href: item.horseId ? `/care?horseId=${item.horseId}&assigned=unassigned` : '/team#team-tasks-heading' })).slice(0, 5);
  const reviews = [...groups.reviewCare, ...groups.reviewFarm].map(item => ({ ...item, kind: item.category === 'reviewCare' ? 'care' as const : 'farm' as const, title: title(item), cost: displayCost(item.costCents, item.costCurrency) })).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);
  const scope = `${userId}:${farmId}`;
  return <section aria-label="Manager daily overview" className="mb-8">
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-3xl">Today’s priorities</h2><p className="mt-1 text-xs text-[#68736b]">Overdue work, open assignments, and completions waiting for review. Dates use UTC.</p></div><a href="/dashboard" className="text-sm font-semibold underline">Refresh overview</a></header>
    <div className="grid items-start gap-4 xl:grid-cols-3">
      <section aria-label="Overdue work" className="premium-card min-w-0 rounded-2xl p-5"><h3 className="font-bold text-[#a24b35]">Overdue work <span className="ml-2">{careCount + farmCount}</span></h3>
        {overdue.length ? <ul className="mt-4 space-y-3">{overdue.map(item => <li key={item.id}><Link className="break-words text-sm font-semibold underline" href={item.href}>{item.title}</Link><p className="mt-1 text-xs text-[#68736b]">Due {displayDate(item.due)}</p></li>)}</ul> : <p className="mt-4 text-sm text-[#68736b]">No overdue work.</p>}
        <Link href="/care" className="mt-5 inline-block text-xs font-bold text-[#315c47]">Open care schedule</Link>
      </section>
      <section aria-label="Unassigned work" className="premium-card min-w-0 rounded-2xl p-5"><h3 className="font-bold text-[#806537]">Unassigned work <span className="ml-2">{unassignedCareCount + unassignedFarmCount}</span></h3>
        {unassigned.length ? <ul className="mt-4 space-y-3">{unassigned.map(item => <li key={item.id}><Link className="break-words text-sm font-semibold underline" href={item.href}>{item.title}</Link></li>)}</ul> : <p className="mt-4 text-sm text-[#68736b]">All scheduled work is assigned.</p>}
        <Link href="/team#team-tasks-heading" className="mt-5 inline-block text-xs font-bold text-[#315c47]">Assign work in Team</Link>
      </section>
      <section aria-label="Awaiting review" className="premium-card min-w-0 rounded-2xl p-5"><h3 className="font-bold text-[#315c47]">Awaiting review <span className="ml-2">{reviewCareCount + reviewFarmCount}</span></h3>
        {reviews.length ? <ul className="mt-4 space-y-4">{reviews.map(item => <OptimisticTaskRow as="li" taskKey={`review:${item.kind}:${item.id}`} label={item.title} key={`${item.kind}:${item.id}`} className="break-words border-b border-[#dedbd1] pb-4 last:border-0">
          <p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-[#68736b]">{item.by || 'Recorded completion'} · {displayDate(item.date)}</p>
          {(item.notes || item.product || item.cost) && <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Completion details</summary>{item.product && <p className="mt-2">Product: {item.product}</p>}{item.cost && <p className="mt-2">Cost: {item.cost}</p>}{item.notes && <p className="mt-2 whitespace-pre-wrap">{item.notes}</p>}</details>}
          <CareTaskForm action={dismissCompletedTask} optimistic="dismiss" className="mt-3" dismissalUndo={{ scope, id: item.id, kind: item.kind, title: item.title }}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="kind" value={item.kind} /><button className="button-secondary !px-3 !py-2 !text-xs" aria-label={`Dismiss ${item.title}`}>Reviewed · dismiss</button></CareTaskForm>
        </OptimisticTaskRow>)}</ul> : <p className="mt-4 text-sm text-[#68736b]">No completed work waiting for review.</p>}
        <p className="mt-3 text-xs text-[#68736b]">Dismissing keeps the history record.</p><Link href="/team#completed-work" className="mt-3 inline-block text-xs font-bold text-[#315c47]">Review all completed work</Link>
      </section>
    </div>
    <p className="mt-3 text-xs text-[#68736b]">Showing up to five items in each section; totals include all matching work.</p>
    <DismissalUndoNotice scope={scope} action={restoreDismissedTask} />
  </section>;
}
