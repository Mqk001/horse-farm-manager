import { requireFarm } from '@/lib/farm-access';
import { prisma } from '@/lib/prisma';
import { getDaysSince } from '@/lib/utils';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HorseDetailClient } from './client';

export const dynamic = 'force-dynamic';

export default async function HorseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { farmId } = await requireFarm();
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
  const rideOverdue = daysSinceRide && daysSinceRide > horse.rideIntervalDays;
  const washOverdue = daysSinceWash && daysSinceWash > horse.washIntervalDays;

  const activities = [
    ...horse.rides.map(r => ({ 
      id: r.id,
      dateTime: r.dateTime.toISOString(),
      type: 'ride' as const,
      riderName: r.riderName,
      rideType: r.rideType,
      durationMinutes: r.durationMinutes,
      notes: r.notes,
    })),
    ...horse.washes.map(w => ({ 
      id: w.id,
      dateTime: w.dateTime.toISOString(),
      type: 'wash' as const,
      washType: w.type,
      notes: w.notes,
    })),
  ].sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()).slice(0, 15);

  return (
    <HorseDetailClient
      horse={JSON.parse(JSON.stringify(horse))}
      daysSinceRide={daysSinceRide}
      daysSinceWash={daysSinceWash}
      rideOverdue={rideOverdue}
      washOverdue={washOverdue}
      activities={activities}
    />
  );
}
