import { requireFarm } from '@/lib/farm-access';
import TeamForm from './TeamForm';
export default async function TeamPage() {
  const { membership } = await requireFarm();
  if (!['MANAGER', 'SUPER_ADMIN'].includes(membership.role)) return <main className="page-shell"><h1 className="font-display text-4xl">Your team</h1><p className="mt-4">Only farm managers can invite team members.</p></main>;
  return <TeamForm />;
}
