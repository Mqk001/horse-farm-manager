import { z } from 'zod';
export const REMINDER_LEAD_DAYS = [0, 1, 3, 7] as const;
export const REMINDER_HOURS = [0, 8, 13, 18] as const;
export const reminderPreferencesSchema = z.object({
  leadDays: z.preprocess(value => value === null || value === '' ? undefined : value, z.coerce.number().int().refine(value => REMINDER_LEAD_DAYS.includes(value as typeof REMINDER_LEAD_DAYS[number]))),
  hourUTC: z.preprocess(value => value === null || value === '' ? undefined : value, z.coerce.number().int().refine(value => REMINDER_HOURS.includes(value as typeof REMINDER_HOURS[number]))),
});
