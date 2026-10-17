import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
export const horseSchema = z.object({
  name: z.string().trim().min(1, 'Enter a horse name.').max(100),
  breed: optionalText(100), age: z.number().int().min(0).max(50).nullable().optional(),
  colorMarkings: optionalText(200), notes: optionalText(10000),
  status: z.enum(['ACTIVE', 'IN_TRAINING', 'RESTING', 'MEDICAL_HOLD', 'RETIRED']).optional(),
  rideIntervalDays: z.number().int().min(1).max(3650).optional(),
  washIntervalDays: z.number().int().min(1).max(3650).optional(),
});
const activityBase = {
  horseId: z.string().min(1),
  dateTime: z.string().datetime({ offset: true }).refine(value => {
    const calendar = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    return Number.isFinite(Date.parse(value)) && !Number.isNaN(calendar.getTime()) && calendar.toISOString().slice(0, 10) === value.slice(0, 10);
  }, 'Enter a valid date and time.').transform(value => new Date(value)),
  notes: optionalText(10000),
};
export const rideSchema = z.object({
  ...activityBase, riderName: z.string().trim().min(1, 'Enter a rider name.').max(100),
  rideType: z.enum(['FLAT', 'TRAIL', 'JUMP', 'TRAINING', 'OTHER']).default('FLAT'),
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
});
export const groomingSchema = z.object({
  ...activityBase, type: z.enum(['FULL_WASH', 'LEGS_ONLY', 'GROOM_ONLY', 'OTHER']).default('FULL_WASH'),
});

export function singleParams(params: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}
