import { canManageFarm } from '@/lib/permissions';
import { requireFarm } from '@/lib/farm-access';
import { HorseForm } from '@/components/HorseForm';
export default async function NewHorsePage() { const { membership } = await requireFarm(); if (!canManageFarm(membership.role)) return <main className="page-shell"><h1 className="font-display text-3xl">Manager access required</h1><p className="mt-4">Only farm managers can add horses.</p></main>; return <HorseForm />; }
