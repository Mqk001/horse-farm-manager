'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter(); const [name, setName] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(''); const response = await fetch('/api/farms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); const data = await response.json().catch(() => null); if (!response.ok) { setError(data?.error ?? 'Could not create your farm.'); setLoading(false); return; } router.push('/dashboard'); router.refresh(); }
  return <main className="login-page"><div className="login-mark">R</div><section className="login-card"><div className="login-heading"><p className="eyebrow">Your workspace</p><h1>Set up your farm</h1><p>Create the farm workspace where your team will manage horses and care.</p></div><form onSubmit={submit} className="login-form"><label>Farm name<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={100} placeholder="Maple Ridge Farm" /></label>{error && <p className="form-error">{error}</p>}<button className="button-primary login-submit" disabled={loading}>{loading ? 'Creating farm…' : 'Create farm'}</button></form><p className="login-footer">You’ll become the farm manager and can invite your team next.</p></section></main>;
}
