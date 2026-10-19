import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireFarm } from '@/lib/farm-access';
import { careExport, displayCost } from '@/lib/care-export';
import { singleParams } from '@/lib/input-validation';
import { displayDate } from '@/lib/care-dates';
import { PrintCareHistory } from '@/components/PrintCareHistory';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Care history export · Reinwell', robots: { index: false, follow: false } };
export default async function CareHistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const { farmId } = await requireFarm();
  const { id } = await params;
  const { from, to } = singleParams(await searchParams);
  let result: Awaited<ReturnType<typeof careExport>> = null, error = '';
  try { result = await careExport(id, farmId, from, to); }
  catch (reason) { if (reason instanceof Error && (reason.message.startsWith('Choose valid') || reason.message.startsWith('This export'))) error = reason.message; else throw reason; }
  if (!result && !error) notFound();
  const query = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
  return <main className="page-shell care-history-print">
    <header className="mb-6"><p className="eyebrow">Reinwell · Care records</p><h1 className="mt-3 font-display text-3xl">{result?.horse.name ?? 'Horse'} care history</h1><p className="mt-2 text-sm text-[#68736b]">{result?.horse.farm?.name} · Dates use UTC · {from || 'All dates'} to {to || 'present'}</p>
      {result && <p className="mt-1 text-sm">{[result.horse.breed, result.horse.age === null ? null : `${result.horse.age} years old`, `${result.records.length} ${result.records.length === 1 ? 'record' : 'records'}`].filter(Boolean).join(' · ')}</p>}
    </header>
    <div className="care-print-controls mb-6 space-y-4"><Link href={`/horses/${encodeURIComponent(id)}`} className="text-sm underline">Back to horse profile</Link>
      <form className="reinwell-form flex flex-wrap items-end gap-3" action={`/horses/${encodeURIComponent(id)}/care-history`}><label>From date<input name="from" type="date" defaultValue={from} /></label><label>To date<input name="to" type="date" defaultValue={to} /></label><button className="button-secondary">Filter history</button><a href={`/horses/${encodeURIComponent(id)}/care-history`} className="button-secondary">All dates</a></form>
      {result && <div className="flex flex-wrap gap-3"><a href={`/api/horses/${encodeURIComponent(id)}/care-export?${query}`} className="button-secondary">Download CSV</a><PrintCareHistory /></div>}
      <p className="text-xs text-[#68736b]">Use your browser’s Save as PDF option in the print dialog. Earlier records contain only the last completion saved before history tracking began.</p>
    </div>
    {error ? <p role="alert" className="form-error">{error}</p> : result?.records.length ? <ol className="space-y-4">{result.records.map(record => <li key={record.id} className="care-print-record premium-card rounded-2xl p-5">
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">{record.name}</h2><time dateTime={record.date.toISOString()}>{displayDate(record.date)}</time></div>
      <p className="mt-2 text-sm">{[record.type.replaceAll('_', ' '), record.provider, record.by ? `Recorded by ${record.by}` : '', record.legacy ? 'Earlier record' : ''].filter(Boolean).join(' · ')}</p>
      {record.product && <p className="mt-2 break-words text-sm">Product: {record.product}</p>}{record.costCents !== null && <p className="mt-2 text-sm">Cost: {displayCost(record.costCents, record.currency)}</p>}
      {record.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm">Completion notes: {record.notes}</p>}{record.instructions && <p className="mt-2 whitespace-pre-wrap break-words text-sm">Care instructions: {record.instructions}</p>}
    </li>)}</ol> : <p role="status">No completed care in this range.</p>}
    <footer className="mt-6 text-xs text-[#68736b]">Exported {new Date().toISOString().slice(0, 10)} (UTC).</footer>
  </main>;
}
