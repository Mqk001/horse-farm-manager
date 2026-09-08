'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, Clock3, MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { LogRideModal } from '@/components/LogRideModal';
import { LogGroomingModal } from '@/components/LogGroomingModal';
import { DeleteHorseModal } from '@/components/DeleteHorseModal';

function formatDate(date: string) { return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function since(days: number | null) { return days === null || days === undefined ? 'Not recorded' : days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`; }

export function HorseDetailClient({ horse, daysSinceRide, daysSinceWash, rideOverdue, washOverdue, activities }: any) {
  const [modal, setModal] = useState<'ride' | 'groom' | 'delete' | null>(null);
  const router = useRouter();
  const search = useSearchParams();
  const [notice, setNotice] = useState('');
  const success = () => { setModal(null); setNotice('Activity saved.'); router.refresh(); };
  const activeCare = horse.vetItems?.filter((item: any) => item.nextDueDate) ?? [];

  return (
    <main className="page-shell">
      {(notice || search.get("saved")) && <p role="status" className="form-success mb-5">{notice || "Horse profile saved."}</p>}
      <Link href="/horses" className="mb-7 inline-flex items-center gap-2 text-xs font-bold text-[#667169] hover:text-[#183d2f]"><ArrowLeft className="h-4 w-4" /> Stable directory</Link>

      <section className="premium-card relative mb-6 overflow-hidden rounded-[2rem]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#183d2f] via-[#75917c] to-[#b38a4a]" />
        <div className="flex flex-col gap-7 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.5rem] bg-[#dce7df] font-display text-4xl text-[#315c47] sm:h-24 sm:w-24">{horse.name.charAt(0).toUpperCase()}</div>
            <div><div className="mb-2 flex items-center gap-2"><span className="rounded-full bg-[#e4ece5] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#315c47]">{horse.status.replaceAll('_', ' ')}</span>{(rideOverdue || washOverdue) && <span className="rounded-full bg-[#f4e5df] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#a24b35]">Needs attention</span>}</div><h1 className="font-display text-4xl sm:text-5xl">{horse.name}</h1><p className="mt-2 text-sm text-[#737d75]">{[horse.breed, horse.age ? `${horse.age} years old` : null, horse.colorMarkings].filter(Boolean).join(' · ') || 'Horse profile'}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setModal('ride')} className="button-primary"><Plus className="h-4 w-4" /> Log ride</button>
            <button onClick={() => setModal('groom')} className="button-secondary"><ShieldCheck className="h-4 w-4" /> Log grooming</button>
            <details className="relative"><summary aria-label="More actions" className="button-secondary cursor-pointer list-none px-3"><MoreHorizontal className="h-4 w-4" /></summary><div className="absolute right-0 z-20 mt-2 w-44 rounded-2xl border border-[#dedbd1] bg-[#fbfaf6] p-2 shadow-xl"><Link href={`/horses/${horse.id}/edit`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-white"><Pencil className="h-3.5 w-3.5" /> Edit profile</Link><button onClick={() => setModal('delete')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#a24b35] hover:bg-[#f7ebe6]"><Trash2 className="h-3.5 w-3.5" /> Delete horse</button></div></details>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
        <div className="space-y-6">
          <section className="premium-card overflow-hidden rounded-3xl"><div className="border-b border-[#e5e2d9] px-6 py-5"><p className="eyebrow">Care rhythm</p><h2 className="mt-1 font-display text-2xl">Current wellbeing</h2></div><div className="grid sm:grid-cols-2">
            <div className="border-b border-[#e8e5dc] p-6 sm:border-b-0 sm:border-r"><div className="flex items-center gap-2 text-xs font-bold text-[#667169]"><Clock3 className="h-4 w-4 text-[#8fa896]" /> Riding cadence</div><p className={`mt-5 font-display text-3xl ${rideOverdue ? 'text-[#a24b35]' : ''}`}>{since(daysSinceRide)}</p><p className="mt-2 text-xs text-[#8a918b]">Target: every {horse.rideIntervalDays} days</p></div>
            <div className="p-6"><div className="flex items-center gap-2 text-xs font-bold text-[#667169]"><ShieldCheck className="h-4 w-4 text-[#8fa896]" /> Grooming cadence</div><p className={`mt-5 font-display text-3xl ${washOverdue ? 'text-[#a24b35]' : ''}`}>{since(daysSinceWash)}</p><p className="mt-2 text-xs text-[#8a918b]">Target: every {horse.washIntervalDays} days</p></div>
          </div></section>

          <section className="premium-card overflow-hidden rounded-3xl"><div className="flex items-center justify-between border-b border-[#e5e2d9] px-6 py-5"><div><p className="eyebrow">Stable log</p><h2 className="mt-1 font-display text-2xl">Activity history</h2></div><span className="text-xs text-[#8a918b]">{activities.length} recent</span></div>{activities.length === 0 ? <p className="px-6 py-12 text-center text-sm text-[#8a918b]">No activity has been recorded yet.</p> : <div className="divide-y divide-[#e8e5dc]">{activities.map((activity: any) => <div key={`${activity.type}-${activity.id}`} className="flex items-center gap-4 px-6 py-4"><div className={`flex h-10 w-10 items-center justify-center rounded-full ${activity.type === 'ride' ? 'bg-[#e4ece5] text-[#315c47]' : 'bg-[#eee7d8] text-[#806537]'}`}>{activity.type === 'ride' ? <Clock3 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="text-sm font-bold">{activity.type === 'ride' ? 'Ride' : 'Grooming'}</p><p className="mt-1 truncate text-xs text-[#858c86]">{activity.type === 'ride' ? [activity.riderName, activity.rideType?.replaceAll('_', ' '), activity.durationMinutes ? `${activity.durationMinutes} min` : null].filter(Boolean).join(' · ') : activity.washType?.replaceAll('_', ' ')}</p></div><time className="text-xs text-[#989e99]">{formatDate(activity.dateTime)}</time></div>)}</div>}</section>
        </div>

        <div className="space-y-6">
          <section className="premium-card rounded-3xl p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Profile</p><h2 className="mt-1 font-display text-2xl">Details</h2></div><Link href={`/horses/${horse.id}/edit`} className="text-xs font-bold text-[#315c47]">Edit</Link></div><dl className="mt-6 space-y-4 text-sm">{horse.breed && <div className="flex justify-between gap-4"><dt className="text-[#858c86]">Breed</dt><dd className="font-semibold">{horse.breed}</dd></div>}{horse.age && <div className="flex justify-between gap-4"><dt className="text-[#858c86]">Age</dt><dd className="font-semibold">{horse.age} years</dd></div>}{horse.colorMarkings && <div className="flex justify-between gap-4"><dt className="text-[#858c86]">Color & markings</dt><dd className="text-right font-semibold">{horse.colorMarkings}</dd></div>}</dl>{horse.notes && <div className="mt-6 border-t border-[#e5e2d9] pt-5"><p className="text-[10px] font-bold uppercase tracking-wider text-[#9a9f9a]">Notes</p><p className="mt-2 text-sm leading-6 text-[#667169]">{horse.notes}</p></div>}</section>

          <section className="premium-card overflow-hidden rounded-3xl"><div className="flex items-center justify-between border-b border-[#e5e2d9] px-6 py-5"><div><p className="eyebrow">Next up</p><h2 className="mt-1 font-display text-2xl">Scheduled care</h2></div><CalendarDays className="h-5 w-5 text-[#8fa896]" /></div>{activeCare.length ? <div className="divide-y divide-[#e8e5dc]">{activeCare.slice(0, 5).map((item: any) => <div key={item.id} className="flex items-center justify-between gap-4 px-6 py-4"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.itemName}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#929892]">{item.itemType.replaceAll('_', ' ')}</p></div><span className="whitespace-nowrap text-xs text-[#68736b]">{formatDate(item.nextDueDate)}</span></div>)}</div> : <p className="px-6 py-10 text-center text-sm text-[#8a918b]">No care scheduled.</p>}<Link href={`/care?horseId=${horse.id}`} className="flex items-center justify-center border-t border-[#e5e2d9] px-6 py-4 text-xs font-bold text-[#315c47] hover:bg-white">Manage care schedule</Link></section>
        </div>
      </div>

      {modal === 'ride' && <LogRideModal horseId={horse.id} horseName={horse.name} onClose={() => setModal(null)} onSuccess={success} />}
      {modal === 'groom' && <LogGroomingModal horseId={horse.id} horseName={horse.name} onClose={() => setModal(null)} onSuccess={success} />}
      {modal === 'delete' && <DeleteHorseModal horseId={horse.id} horseName={horse.name} onClose={() => setModal(null)} />}
    </main>
  );
}
