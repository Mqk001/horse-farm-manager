// Calendar dates use UTC across the schedule, dashboard and timeline.
const DAY_MS = 86_400_000;
export function startOfDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
export function endOfDay(date = new Date()) {
  return new Date(startOfDay(date).getTime() + DAY_MS - 1);
}
export function inputDate(date: Date) { return date.toISOString().slice(0, 10); }
export function displayDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
export function parseCareDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || inputDate(date) !== value) throw new Error('Invalid date');
  return date;
}
export function getDaysSince(value: Date | string, now = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}
export function activityOverdue(days: number | null, intervalDays: number) {
  return days !== null && days > intervalDays;
}
export function careStatus(due: Date, now = new Date()) {
  return due < startOfDay(now) ? 'overdue' : due <= endOfDay(now) ? 'today' : 'upcoming';
}
