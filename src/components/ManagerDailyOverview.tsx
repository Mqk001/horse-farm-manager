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
  const careScope = { horse: { farmId }, nextDueDate: { lt: today } };
  const farmScope = { farmId, completedAt: null, dueDate: { lt: today } };
  const unassignedCare = { horse: { farmId }, nextDueDate: { not: null }, assignedMemberId: null };
  const unassignedFarm = { farmId, completedAt: null, assignedMemberId: null };
  const reviewCare = { horse: { farmId }, dismissedAt: null };
  const reviewFarm = { farmId, completedAt: { not: null }, dismissedAt: null };
  const [overdueCare, overdueFarm, careCount, farmCount, unassignedCareCount, unassignedFarmCount, unassignedCareRows, unassignedFarmRows, reviewCareCount, reviewFarmCount, careReviews, farmReviews] = await Promise.all([
    prisma.vetItem.findMany({ where: careScope, include: { horse: { select: { name: true } } }, orderBy: [{ nextDueDate: 'asc' }, { id: 'asc' }], take: 5 }),
    prisma.farmTask.findMany({ where: farmScope, orderBy: [{ dueDate: 'asc' }, { id: 'asc' }], take: 5 }),
    prisma.vetItem.count({ where: careScope }), prisma.farmTask.count({ where: farmScope }),
    prisma.vetItem.count({ where: unassignedCare }), prisma.farmTask.count({ where: unassignedFarm }),
    prisma.vetItem.findMany({ where: unassignedCare, include: { horse: { select: { name: true } } }, orderBy: [{ nextDueDate: 'asc' }, { id: 'asc' }], take: 5 }),
    prisma.farmTask.findMany({ where: unassignedFarm, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 5 }),
    prisma.careCompletion.count({ where: reviewCare }), prisma.farmTask.count({ where: reviewFarm }),
    prisma.careCompletion.findMany({ where: reviewCare, include: { horse: { select: { name: true } } }, orderBy: [{ completedAt: 'desc' }, { id: 'asc' }], take: 5 }),
    prisma.farmTask.findMany({ where: reviewFarm, orderBy: [{ completedAt: 'desc' }, { id: 'asc' }], take: 5 }),
  ]);
  const overdue = [...overdueCare.map(item => ({ id: `care:${item.id}`, title: `${item.horse.name} · ${item.itemName}`, due: item.nextDueDate!, href: `/care?horseId=${item.horseId}` })),
    ...overdueFarm.map(item => ({ id: `farm:${item.id}`, title: item.title, due: item.dueDate!, href: '/team#team-tasks-heading' }))].sort((a, b) => a.due.getTime() - b.due.getTime()).slice(0, 5);
  const unassigned = [...unassignedCareRows.map(item => ({ id: `care:${item.id}`, title: `${item.horse.name} · ${item.itemName}`, href: `/care?horseId=${item.horseId}&assigned=unassigned` })),
    ...unassignedFarmRows.map(item => ({ id: `farm:${item.id}`, title: item.title, href: '/team#team-tasks-heading' }))].slice(0, 5);
  const reviews = [...careReviews.map(item => ({ id: item.id, kind: 'care' as const, title: `${item.horse.name} · ${item.itemName}`, date: item.completedAt, by: item.completedByName, notes: item.completionNotes, product: item.productUsed, cost: displayCost(item.costCents, item.costCurrency) })),
    ...farmReviews.map(item => ({ id: item.id, kind: 'farm' as const, title: item.title, date: item.completedAt!, by: item.completedByName, notes: null, product: null, cost: '' }))].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);
  const scope = `${userId}:${farmId}`;
  return <section aria-label="Manager daily overview" className="mb-8">
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-3xl">Today’s priorities</h2><p className="mt-1 text-xs text-[#68736b]">Overdue work, open assignments, and completions waiting for review. Dates use UTC.</p></div><a href="/dashboard" className="text-sm font-semibold underline">Refresh overview</a></header>
    <div className="grid items-start gap-4 xl:grid-cols-3">
      <section aria-label="Overdue work" className="premium-card min-w-0 rounded-2xl p-5"><h3 className="font-bold text-[#a24b35]">Overdue work <span className="ml-2">{careCount + farmCount}</span></h3>
        {overdue.length ? <ul className="mt-4 space-y-3">{overdue.map(item => <li key={item.id}><a className="break-words text-sm font-semibold underline" href={item.href}>{item.title}</a><p className="mt-1 text-xs text-[#68736b]">Due {displayDate(item.due)}</p></li>)}</ul> : <p className="mt-4 text-sm text-[#68736b]">No overdue work.</p>}
        <a href="/care" className="mt-5 inline-block text-xs font-bold text-[#315c47]">Open care schedule</a>
      </section>
      <section aria-label="Unassigned work" className="premium-card min-w-0 rounded-2xl p-5"><h3 className="font-bold text-[#806537]">Unassigned work <span className="ml-2">{unassignedCareCount + unassignedFarmCount}</span></h3>
        {unassigned.length ? <ul className="mt-4 space-y-3">{unassigned.map(item => <li key={item.id}><a className="break-words text-sm font-semibold underline" href={item.href}>{item.title}</a></li>)}</ul> : <p className="mt-4 text-sm text-[#68736b]">All scheduled work is assigned.</p>}
        <a href="/team#team-tasks-heading" className="mt-5 inline-block text-xs font-bold text-[#315c47]">Assign work in Team</a>
      </section>
      <section aria-label="Awaiting review" className="premium-card min-w-0 rounded-2xl p-5"><h3 className="font-bold text-[#315c47]">Awaiting review <span className="ml-2">{reviewCareCount + reviewFarmCount}</span></h3>
        {reviews.length ? <ul className="mt-4 space-y-4">{reviews.map(item => <OptimisticTaskRow as="li" taskKey={`review:${item.kind}:${item.id}`} label={item.title} key={`${item.kind}:${item.id}`} className="break-words border-b border-[#dedbd1] pb-4 last:border-0">
          <p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-[#68736b]">{item.by || 'Recorded completion'} · {displayDate(item.date)}</p>
          {(item.notes || item.product || item.cost) && <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Completion details</summary>{item.product && <p className="mt-2">Product: {item.product}</p>}{item.cost && <p className="mt-2">Cost: {item.cost}</p>}{item.notes && <p className="mt-2 whitespace-pre-wrap">{item.notes}</p>}</details>}
          <CareTaskForm action={dismissCompletedTask} optimistic="dismiss" className="mt-3" dismissalUndo={{ scope, id: item.id, kind: item.kind, title: item.title }}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="kind" value={item.kind} /><button className="button-secondary !px-3 !py-2 !text-xs" aria-label={`Dismiss ${item.title}`}>Reviewed · dismiss</button></CareTaskForm>
        </OptimisticTaskRow>)}</ul> : <p className="mt-4 text-sm text-[#68736b]">No completed work waiting for review.</p>}
        <p className="mt-3 text-xs text-[#68736b]">Dismissing keeps the history record.</p><a href="/team#completed-work" className="mt-3 inline-block text-xs font-bold text-[#315c47]">Review all completed work</a>
      </section>
    </div>
    <p className="mt-3 text-xs text-[#68736b]">Showing up to five items in each section; totals include all matching work.</p>
    <DismissalUndoNotice scope={scope} action={restoreDismissedTask} />
  </section>;
}
