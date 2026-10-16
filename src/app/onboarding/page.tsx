'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter(); const [name, setName] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const [farms, setFarms] = useState<{ id: string; name: string; role: string }[]>([]);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  useEffect(() => { fetch('/api/me').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => { setFarms(d.farms ?? []); setActiveFarmId(d.farm?.id ?? null); }).catch(() => setError('Could not load your farms. Refresh to try again.')).finally(() => setFetching(false)); }, []);
  async function selectFarm(farmId: string) {
    if (loading) return;
    setLoading(true); setSelectedFarmId(farmId); setError('');
    try {
      const response = await fetch('/api/farms/active', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farmId }) });
      if (!response.ok) throw new Error('Could not select farm. Please try again.');
      router.push('/dashboard'); router.refresh();
    } catch (error) { setError(error instanceof TypeError ? 'Could not connect. Please try again.' : error instanceof Error ? error.message : 'Could not connect. Please try again.'); }
    finally { setLoading(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (loading) return;
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/farms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? 'Could not create your farm.');
      router.push('/dashboard'); router.refresh();
    } catch (error) { setError(error instanceof TypeError ? 'Could not connect. Please try again.' : error instanceof Error ? error.message : 'Could not connect. Please try again.'); }
    finally { setLoading(false); }
  }
  return <main className="login-page"><div className="login-mark">R</div><section className="login-card">
    <div className="login-heading"><p className="eyebrow">Your workspace</p><h1>{farms.length ? 'Choose your farm' : 'Set up your farm'}</h1><p>{farms.length ? 'Open a workspace to manage its horses and care.' : 'Create the farm workspace where your team will manage horses and care.'}</p></div>
    {fetching && <p role="status" className="mt-6 text-center text-sm text-[#657067]">Loading your farms…</p>}
    {farms.length > 0 && <nav aria-label="Your farms" className="mt-7 grid gap-3">
      {farms.map(farm => <button key={farm.id} type="button" disabled={loading} onClick={() => selectFarm(farm.id)} aria-label={`Open ${farm.name}, ${farm.role === 'STAFF' ? 'Staff' : farm.role === 'SUPER_ADMIN' ? 'Owner' : 'Manager'}${farm.id === activeFarmId ? ', current farm' : ''}`} className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition hover:border-[#244b38] hover:bg-[#f0f3ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#244b38] disabled:cursor-wait disabled:opacity-60 ${farm.id === activeFarmId ? 'border-[#244b38] bg-[#f0f3ec]' : 'border-[#dce2d9] bg-white'}`}>
        <span className="min-w-0"><span className="block break-words text-base font-semibold text-[#17201a]">{farm.name}</span><span className="mt-1 block text-sm text-[#657067]">{farm.role === 'STAFF' ? 'Staff' : farm.role === 'SUPER_ADMIN' ? 'Owner' : 'Manager'}{farm.id === activeFarmId ? ' · Current farm' : ''}</span></span>
        <span aria-hidden="true" className="shrink-0 text-[#244b38]">{loading && selectedFarmId === farm.id ? 'Opening…' : '→'}</span>
      </button>)}
    </nav>}
    {error && <p role="alert" className="form-error mt-4">{error}</p>}
    {!fetching && <details className={farms.length ? 'mt-8 border-t border-[#dce2d9] pt-5' : 'mt-6'} open={farms.length === 0}>
      <summary className="cursor-pointer text-sm font-semibold text-[#244b38]">Create a new farm</summary>
      <form onSubmit={submit} className="login-form mt-5"><label>Farm name<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={100} placeholder="Maple Ridge Farm" /></label><button className="button-primary login-submit" disabled={loading}>{loading && !selectedFarmId ? 'Creating farm…' : 'Create farm'}</button></form>
      <p className="login-footer">You’ll become the farm manager and can invite your team next.</p>
    </details>}
  </section></main>;
}
