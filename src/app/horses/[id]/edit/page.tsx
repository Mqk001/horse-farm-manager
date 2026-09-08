import { HorseForm } from '@/components/HorseForm';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function EditHorsePage({ params }: { params: { id: string } }) {
  const horse = await prisma.horse.findUnique({ where: { id: params.id } });
  if (!horse) notFound();
  const { id, name, breed, age, colorMarkings, notes, status, rideIntervalDays, washIntervalDays } = horse;
  return <HorseForm horse={{ id, name, breed, age, colorMarkings, notes, status, rideIntervalDays, washIntervalDays }} />;
}
