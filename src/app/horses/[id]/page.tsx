import { canManageFarm } from '@/lib/permissions';
import { singleParams } from '@/lib/input-validation';
import { requireFarm } from '@/lib/farm-access';
import { prisma } from '@/lib/prisma';
import { getDaysSince, activityOverdue } from '@/lib/care-dates';
import { HorseTimeline, type TimelineParams } from './timeline';
import { notFound } from 'next/navigation';
import { HorseDetailClient } from './client';

export const dynamic = 'force-dynamic';

export default async function HorseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<TimelineParams> }) {
  const resolvedParams = await params;
  const { farmId, membership } = await requireFarm();
  const horse = await prisma.horse.findUnique({
    where: { id: resolvedParams.id, farmId },
    include: {
      rides: { orderBy: { dateTime: 'desc' }, take: 20 },
      washes: { orderBy: { dateTime: 'desc' }, take: 20 },
      vetItems: { orderBy: { nextDueDate: 'asc' } },
    },
  });

  if (!horse) notFound();

  const lastRide = horse.rides[0];
  const lastWash = horse.washes[0];
  const daysSinceRide = lastRide ? getDaysSince(lastRide.dateTime) : null;
  const daysSinceWash = lastWash ? getDaysSince(lastWash.dateTime) : null;
  const rideOverdue = activityOverdue(daysSinceRide, horse.rideIntervalDays);
  const washOverdue = activityOverdue(daysSinceWash, horse.washIntervalDays);

  const { rides, washes, ...profile } = horse;

  return (
    <HorseDetailClient
      canManage={canManageFarm(membership.role)}
      horse={JSON.parse(JSON.stringify(profile))}
      daysSinceRide={daysSinceRide}
      daysSinceWash={daysSinceWash}
      rideOverdue={rideOverdue}
      washOverdue={washOverdue}
      timeline={<HorseTimeline horseId={horse.id} farmId={farmId} filters={singleParams(await searchParams)} />}
    />
  );
}
