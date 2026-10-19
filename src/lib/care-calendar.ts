import { inputDate, parseCareDate, startOfDay } from './care-dates';

const DAY = 86_400_000;
export function validCalendarDate(value: string | undefined) {
  if (!value || !/^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(value)) return null;
  try { return startOfDay(parseCareDate(value)); } catch { return null; }
}

export function careWeek(value?: string, now = new Date()) {
  const date = validCalendarDate(value) ?? startOfDay(now);
  const start = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY);
  const days = Array.from({ length: 7 }, (_, index) => new Date(start.getTime() + index * DAY));
  return { start, end: new Date(start.getTime() + 7 * DAY), days,
    previous: inputDate(new Date(start.getTime() - 7 * DAY)), next: inputDate(new Date(start.getTime() + 7 * DAY)) };
}

export function careHref({ view, week, horseId, assigned }: { view?: string; week?: string; horseId?: string; assigned?: string } = {}) {
  const query = new URLSearchParams();
  if (view === 'week') query.set('view', 'week');
  if (view === 'week' && validCalendarDate(week)) query.set('week', week!);
  if (horseId) query.set('horseId', horseId);
  if (assigned === 'mine' || assigned === 'unassigned') query.set('assigned', assigned);
  return `/care${query.size ? `?${query}` : ''}`;
}
