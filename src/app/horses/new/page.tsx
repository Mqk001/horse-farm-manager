import { requireFarm } from '@/lib/farm-access';
import { HorseForm } from '@/components/HorseForm';
export default async function NewHorsePage() { await requireFarm(); return <HorseForm />; }
