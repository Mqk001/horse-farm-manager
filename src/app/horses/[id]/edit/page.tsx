import { canManageFarm } from '@/lib/permissions';
import { requireFarm } from '@/lib/farm-access';
import { HorseForm } from '@/components/HorseForm';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function EditHorsePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { farmId, membership } = await requireFarm();
  const horse = await prisma.horse.findUnique({ where: { id: params.id, farmId } });
  if (!horse) notFound();
  if (!canManageFarm(membership.role)) return <main className="page-shell"><h1 className="font-display text-3xl">Manager access required</h1><p className="mt-4">Only farm managers can edit horse profiles.</p></main>;
  const { id, name, breed, age, colorMarkings, notes, status, rideIntervalDays, washIntervalDays } = horse;
  return <HorseForm horse={{ id, name, breed, age, colorMarkings, notes, status, rideIntervalDays, washIntervalDays }} />;
}
