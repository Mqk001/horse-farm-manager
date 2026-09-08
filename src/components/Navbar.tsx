'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, ChevronRight, Home, LogOut, Menu, Plus, Settings, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const navigation = [
  { href: '/dashboard', label: 'Overview', icon: Home },
  { href: '/horses', label: 'Horses', icon: Sparkles },
  { href: '/care', label: 'Care schedule', icon: CalendarDays },
];

function SidebarContents({ pathname, close, signOut, farmName }: { pathname: string; close: () => void; signOut: () => void; farmName: string }) {
  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  return (
    <>
      <div className="px-6 pb-8 pt-7">
        <Link href="/dashboard" onClick={close} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 font-display text-xl text-[#d6b77b]">R</div>
          <div><p className="font-display text-xl leading-none text-white">Reinwell</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[.2em] text-white/45">Stable management</p></div>
        </Link>
      </div>
      <nav className="flex-1 px-3">
        <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[.2em] text-white/35">Workspace</p>
        <div className="space-y-1">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return <Link key={href} href={href} onClick={close} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${active ? 'bg-white/10 text-white shadow-inner' : 'text-white/60 hover:bg-white/[.06] hover:text-white'}`}><Icon className={`h-[18px] w-[18px] ${active ? 'text-[#d6b77b]' : 'text-white/40 group-hover:text-white/70'}`} strokeWidth={1.8} /><span>{label}</span>{active ? <ChevronRight className="ml-auto h-4 w-4 text-white/35" /> : null}</Link>;
          })}
        </div>
        <div className="my-6 h-px bg-white/[.08]" />
        <Link href="/horses/new" onClick={close} className="mx-1 flex items-center justify-center gap-2 rounded-xl bg-[#d6b77b] px-4 py-3 text-sm font-bold text-[#153126] shadow-lg shadow-black/10 transition hover:bg-[#e2c892]"><Plus className="h-4 w-4" /> Add a horse</Link>
      </nav>
      <div className="m-4 space-y-2"><div className="rounded-2xl border border-white/[.08] bg-white/[.04] p-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d6b77b]/15 text-[#d6b77b]"><Settings className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-xs font-semibold text-white/85">{farmName || 'Stable workspace'}</p><p className="mt-0.5 text-[11px] text-white/40">Active farm</p></div></div></div><Link href="/onboarding" onClick={close} className="block px-3 py-2 text-xs text-white/70">Switch farm</Link><button onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-white/50 transition hover:bg-white/[.06] hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button></div>
    </>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [farmName, setFarmName] = useState('');

  useEffect(() => { fetch('/api/me').then((response) => response.ok ? response.json() : null).then((data) => setFarmName(data?.farm?.name ?? '')).catch(() => undefined); }, [pathname]);

  if (['/login', '/signup', '/verify-email', '/terms', '/privacy', '/onboarding'].includes(pathname)) return null;

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-black/5 bg-[#f5f2ea]/90 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" className="font-display text-xl text-[#183d2f]">Reinwell</Link>
        <button onClick={() => setOpen(true)} aria-label="Open navigation" className="rounded-lg border border-black/10 bg-white/60 p-2 text-[#183d2f]"><Menu className="h-5 w-5" /></button>
      </header>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[17.5rem] flex-col overflow-hidden bg-[#112b21] lg:flex"><SidebarContents pathname={pathname} close={() => setOpen(false)} signOut={signOut} farmName={farmName} /></aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[18rem] flex-col bg-[#112b21] shadow-2xl">
            <button onClick={() => setOpen(false)} aria-label="Close navigation" className="absolute right-3 top-3 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            <SidebarContents pathname={pathname} close={() => setOpen(false)} signOut={signOut} farmName={farmName} />
          </aside>
        </div>
      )}
    </>
  );
}
