import { prisma } from './prisma';
import { validCalendarDate } from './care-calendar';
import { displayCost } from './completion-details';

export function careExportDates(from?: string | null, to?: string | null) {
  if ((from && !validCalendarDate(from)) || (to && !validCalendarDate(to)) || (from && to && from > to)) throw new Error('Choose valid dates with From on or before To.');
  return { ...(from ? { gte: validCalendarDate(from)! } : {}), ...(to ? { lt: new Date(validCalendarDate(to)!.getTime() + 86_400_000) } : {}) };
}

export async function careExport(horseId: string, farmId: string, from?: string | null, to?: string | null) {
  const range = careExportDates(from, to);
  const horse = await prisma.horse.findFirst({ where: { id: horseId, farmId }, select: { id: true, name: true, breed: true, age: true, farm: { select: { name: true } } } });
  if (!horse) return null;
  const scope = { horseId, horse: { farmId } };
  const [completed, legacy] = await Promise.all([
    prisma.careCompletion.findMany({ where: { ...scope, completedAt: range }, orderBy: [{ completedAt: 'desc' }, { id: 'asc' }], take: 1001 }),
    prisma.vetItem.findMany({ where: { ...scope, lastDoneDate: { not: null, ...range }, completions: { none: {} } }, orderBy: [{ lastDoneDate: 'desc' }, { id: 'asc' }], take: 1001 }),
  ]);
  if (completed.length + legacy.length > 1000) throw new Error('This export exceeds 1,000 records. Choose a smaller date range.');
  const records = [
    ...completed.map(item => ({ id: item.id, date: item.completedAt, name: item.itemName, type: item.itemType, provider: item.vetName ?? '', instructions: item.notes ?? '', notes: item.completionNotes ?? '', product: item.productUsed ?? '', costCents: item.costCents, currency: item.costCurrency, by: item.completedByName ?? '', legacy: item.legacy })),
    ...legacy.map(item => ({ id: item.id, date: item.lastDoneDate!, name: item.itemName, type: item.itemType, provider: item.vetName ?? '', instructions: item.notes ?? '', notes: '', product: '', costCents: null, currency: null, by: '', legacy: true })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime() || a.id.localeCompare(b.id));
  return { horse, records };
}

function csvCell(value: string) {
  // Spreadsheet formulas must remain literal text, including leading whitespace.
  const safe = /^[\s]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function careCsv(data: NonNullable<Awaited<ReturnType<typeof careExport>>>) {
  const rows = [['Horse', 'Farm', 'Completed at (UTC)', 'Care', 'Type', 'Provider', 'Completed by', 'Product used', 'Cost', 'Currency', 'Completion notes', 'Care instructions', 'Earlier record'],
    ...data.records.map(item => [data.horse.name, data.horse.farm?.name ?? '', item.date.toISOString(), item.name, item.type, item.provider, item.by, item.product, item.costCents === null ? '' : (item.costCents / 100).toFixed(2), item.currency ?? '', item.notes, item.instructions, item.legacy ? 'Yes' : 'No'])];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export { displayCost };
