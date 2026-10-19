import { CareDialog } from './CareDialog';
import { createCareItem } from '@/app/care/actions';
import { inputDate } from '@/lib/care-dates';

type Props = { horses: { id: string; name: string }[]; members: { id: string; user: { name: string | null; email: string } }[]; selectedHorseId?: string; defaultDueDate?: string };
export function ScheduleCareDialog({ horses, members, selectedHorseId, defaultDueDate }: Props) {
  return <CareDialog action={createCareItem} disabled={!horses.length}>
          <label className="text-xs font-bold text-[#59645c]">Horse<select name="horseId" required defaultValue={selectedHorseId ?? ''} className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal"><option value="" disabled>Select a horse</option>{horses.map(horse => <option key={horse.id} value={horse.id}>{horse.name}</option>)}</select></label>
          <label className="text-xs font-bold text-[#59645c]">Care type<select name="itemType" className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal"><option value="VACCINATION">Vaccination</option><option value="FARRIER">Farrier</option><option value="DENTAL">Dental</option><option value="DEWORMING">Deworming</option><option value="MEDICATION">Medication</option><option value="VET_VISIT">Vet visit</option><option value="OTHER">Other</option></select></label>
          <label className="text-xs font-bold text-[#59645c]">Task name<input name="itemName" required maxLength={100} placeholder="Spring vaccinations" className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-[#59645c]">Next due<input name="nextDueDate" type="date" required defaultValue={defaultDueDate ?? inputDate(new Date())} className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-[#59645c]">Repeat every (days)<input name="intervalDays" type="number" min={1} max={3650} placeholder="Optional" className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal" /></label>
          {<label className="text-xs font-bold text-[#59645c]">Assign to<select name="assignedMemberId" className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal"><option value="">Unassigned</option>{members.map(member => <option key={member.id} value={member.id}>{member.user.name ?? member.user.email}</option>)}</select></label>}
          <label className="text-xs font-bold text-[#59645c]">Provider<input name="vetName" maxLength={100} placeholder="Vet, farrier, or clinic" className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-[#59645c] sm:col-span-2">Notes<textarea name="notes" rows={3} className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal" /></label>
        </CareDialog>;
}
