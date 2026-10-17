'use client';
import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
const statuses = { ACTIVE: 'Active', IN_TRAINING: 'In training', RESTING: 'Resting', MEDICAL_HOLD: 'Medical hold', RETIRED: 'Retired' };
export function HorseSearchFilters({ query, status, overdue, sort, scope }: { query: string; status: string; overdue: string; sort: string; scope: string }) {
  const router = useRouter();
  const [text, setText] = useState(query);
  const [pending, startTransition] = useTransition();
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const suggestions = useRef<HTMLDivElement>(null);
  const lastRequested = useRef('');
  const storageKey = `reinwell-horse-search:${scope}`;
  function remember(value: string) {
    const clean = value.trim().slice(0, 100);
    if (!clean) return;
    setRecent(previous => {
      const next = [clean, ...previous.filter(item => item !== clean)].slice(0, 5);
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Search works without browser storage. */ }
      return next;
    });
  }
  function navigate(values: { q?: string; status?: string; overdue?: string; sort?: string } = {}, record = true) {
    const params = new URLSearchParams();
    const fields = { q: text.trim().slice(0, 100), status, overdue, sort, ...values };
    for (const [key, value] of Object.entries(fields)) if (value) params.set(key, value);
    const url = '/horses' + (params.size ? '?' + params.toString() : '');
    if (record) remember(fields.q ?? '');
    if (url === window.location.pathname + window.location.search || lastRequested.current === url) return;
    lastRequested.current = url;
    startTransition(() => router.replace(url, { scroll: false }));
  }
  useEffect(() => {
    try { const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]'); setRecent(Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string' && item.length <= 100).slice(0, 5) : []); } catch { setRecent([]); }
  }, [storageKey]);
  useEffect(() => { lastRequested.current = ''; }, [query]);
  useEffect(() => {
    if (text.trim() === query.trim()) return;
    const timer = window.setTimeout(() => navigate({ q: text.trim() }), 300);
    return () => window.clearTimeout(timer);
    // Other filter values are URL state; a new render cancels the old debounce.
  }, [text, query, status, overdue, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable=true]')) return;
      if ((event.key === '/' && !event.metaKey && !event.ctrlKey) || (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey))) { event.preventDefault(); input.current?.focus(); input.current?.select(); }
    };
    const back = () => { setText(new URLSearchParams(window.location.search).get('q') ?? ''); lastRequested.current = ''; };
    window.addEventListener('keydown', shortcut); window.addEventListener('popstate', back);
    return () => { window.removeEventListener('keydown', shortcut); window.removeEventListener('popstate', back); };
  }, []);
  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { event.preventDefault(); input.current?.blur(); }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const first = suggestions.current?.querySelector<HTMLButtonElement>('button') ?? document.querySelector<HTMLAnchorElement>('[data-horse-result]');
      first?.focus();
    }
  }
  function submit(event: FormEvent) { event.preventDefault(); navigate(); }
  return <form className="reinwell-form premium-card mb-6 grid gap-4 rounded-2xl p-4 sm:grid-cols-2" action="/horses" onSubmit={submit} aria-label="Find horses">
    <div>
      <label htmlFor="horse-search">Search horses <span className="font-normal text-[#7b837c]">/ to focus</span></label>
      <input ref={input} id="horse-search" type="search" name="q" value={text} onChange={event => setText(event.target.value)} onKeyDown={keyboard} maxLength={100} placeholder="Name or breed — typos welcome" autoComplete="off" aria-controls="horse-results" aria-describedby="horse-search-status" className="mt-2" />

    </div>
    <label>Status<select name="status" value={status} onChange={event => navigate({ status: event.target.value }, false)}><option value="">All statuses</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Care needs<select name="overdue" value={overdue} onChange={event => navigate({ overdue: event.target.value }, false)}><option value="">All horses</option><option value="yes">Overdue ride or grooming</option></select></label>
    <label>Sort by<select name="sort" value={sort} onChange={event => navigate({ sort: event.target.value }, false)}><option value="">{text.trim() ? 'Best match' : 'Name A–Z'}</option><option value="name-desc">Name Z–A</option><option value="recent">Most recent ride</option></select></label>
    <div className="flex flex-wrap items-end gap-3"><button className="button-primary" disabled={pending}>Search</button><a className="button-secondary" href="/horses">Clear filters</a></div>
    <p id="horse-search-status" role="status" className="min-h-12 self-end text-xs text-[#68736b]">{pending ? 'Searching…' : 'Search updates as you type. Enter searches now; ↓ moves to suggestions or results.'}</p>
    <div className="col-span-full min-h-10">
      {recent.length > 0 ? <div ref={suggestions} className="flex min-h-10 items-center gap-2 overflow-x-auto whitespace-nowrap" aria-label="Recent searches">
        <p className="px-2 py-1 text-xs text-[#68736b]">Recent searches</p>
        {recent.map((value, index) => <button key={value} type="button" className="shrink-0 rounded-lg bg-[#e8ede5] px-3 py-2 text-left text-xs hover:bg-[#dbe5d8] focus:bg-[#dbe5d8]" onClick={() => { setText(value); navigate({ q: value }); input.current?.focus(); }} onKeyDown={event => {
          if (event.key === 'Escape') { input.current?.focus(); }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const buttons = suggestions.current?.querySelectorAll('button'); buttons?.[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
        }}>{value}</button>)}
        <button type="button" className="px-3 py-2 text-xs underline" onClick={() => { setRecent([]); try { sessionStorage.removeItem(storageKey); } catch {} input.current?.focus(); }}>Clear recent searches</button>
      </div> : <p className="min-h-10 py-2 text-xs text-[#7b837c]">Recent searches stay in this tab.</p>}
    </div>
  </form>;
}
