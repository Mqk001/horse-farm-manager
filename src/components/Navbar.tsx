'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, ChevronRight, Home, Loader2, LogOut, Menu, Plus, Building2, Sparkles, Users, X } from 'lucide-react';
import { canManageFarm } from '@/lib/permissions';
import { useEffect, useState } from 'react';

const navigation = [
  { href: '/dashboard', label: 'Overview', icon: Home },
  { href: '/horses', label: 'Horses', icon: Sparkles },
  { href: '/care', label: 'Care schedule', icon: CalendarDays },
  { href: '/team', label: 'Team', icon: Users },
];

function SidebarContents({ pathname, close, signOut, farmName, navigate, canManage }: { pathname: string; close: () => void; signOut: () => void; farmName: string; canManage: boolean; navigate: (href: string, label: string) => void }) {
  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  return (
    <>
      <div className="px-6 pb-8 pt-7">
        <Link href="/dashboard" onClick={close} onNavigate={() => navigate('/dashboard', 'Overview')} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 font-display text-xl text-[#d6b77b]">R</div>
          <div><p className="font-display text-xl leading-none text-white">Reinwell</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[.2em] text-white/45">Stable management</p></div>
        </Link>
      </div>
      <nav className="flex-1 px-3">
        <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[.2em] text-white/35">Workspace</p>
        <div className="space-y-1">
          {navigation.filter(item => item.href !== '/team' || canManage).map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return <Link key={href} href={href} onClick={close} onNavigate={() => navigate(href, label)} aria-current={active ? 'page' : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${active ? 'bg-white/10 text-white shadow-inner' : 'text-white/60 hover:bg-white/[.06] hover:text-white'}`}><Icon className={`h-[18px] w-[18px] ${active ? 'text-[#d6b77b]' : 'text-white/40 group-hover:text-white/70'}`} strokeWidth={1.8} /><span>{label}</span>{active ? <ChevronRight className="ml-auto h-4 w-4 text-white/35" /> : null}</Link>;
          })}
        </div>
        <div className="my-6 h-px bg-white/[.08]" />
        {canManage && <Link href="/horses/new" onClick={close} onNavigate={() => navigate('/horses/new', 'Add a horse')} className="mx-1 flex items-center justify-center gap-2 rounded-xl bg-[#d6b77b] px-4 py-3 text-sm font-bold text-[#153126] shadow-lg shadow-black/10 transition hover:bg-[#e2c892]"><Plus className="h-4 w-4" /> Add a horse</Link>}
      </nav>
      <div className="m-4 space-y-2"><div className="rounded-2xl border border-white/[.08] bg-white/[.04] p-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d6b77b]/15 text-[#d6b77b]"><Building2 className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-xs font-semibold text-white/85">{farmName || 'Stable workspace'}</p><p className="mt-0.5 text-[11px] text-white/40">Active farm</p></div></div></div><Link href="/onboarding" onClick={close} onNavigate={() => navigate('/onboarding', 'Switch farm')} className="block px-3 py-2 text-xs text-white/70">Switch farm</Link><button onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-white/50 transition hover:bg-white/[.06] hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button></div>
    </>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [farmName, setFarmName] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<{ href: string; label: string; from: string } | null>(null);
  const [slowTarget, setSlowTarget] = useState<typeof navigationTarget>(null);
  const pending = navigationTarget?.from === pathname ? navigationTarget : null;

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/me', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!controller.signal.aborted) { setFarmName(data?.farm?.name ?? ''); setCanManage(canManageFarm(data?.farm?.role)); } })
      .catch(() => undefined);
    return () => controller.abort();
  }, [pathname]);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setSlowTarget(pending), 8000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    if (navigationTarget && navigationTarget.from !== pathname) setNavigationTarget(null);
  }, [pathname, navigationTarget]);

  function navigate(href: string, label: string) {
    setSlowTarget(null);
    setNavigationTarget(href === pathname ? null : { href, label, from: pathname });
  }

  if (['/', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/invite', '/terms', '/privacy', '/onboarding', '/auth/google/complete'].includes(pathname)) return null;

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-black/5 bg-[#f5f2ea]/90 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" onNavigate={() => navigate('/dashboard', 'Overview')} className="font-display text-xl text-[#183d2f]">Reinwell</Link>
        <button onClick={() => setOpen(true)} aria-label="Open navigation" className="rounded-lg border border-black/10 bg-white/60 p-2 text-[#183d2f]"><Menu className="h-5 w-5" /></button>
      </header>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[17.5rem] flex-col overflow-hidden bg-[#112b21] lg:flex"><SidebarContents pathname={pathname} close={() => setOpen(false)} signOut={signOut} farmName={farmName} canManage={canManage} navigate={navigate} /></aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[18rem] flex-col bg-[#112b21] shadow-2xl">
            <button onClick={() => setOpen(false)} aria-label="Close navigation" className="absolute right-3 top-3 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            <SidebarContents pathname={pathname} close={() => setOpen(false)} signOut={signOut} farmName={farmName} canManage={canManage} navigate={navigate} />
          </aside>
        </div>
      )}
      {pending && <div role="status" className="fixed bottom-4 right-4 z-40 max-w-[calc(100%-2rem)] rounded-2xl border border-[#dedbd1] bg-[#fbfaf6] p-4 text-sm text-[#183d2f] shadow-xl">
        <p className="flex items-center gap-2"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Opening {pending.label}…</p>
        {slowTarget === pending && <p className="mt-2">Taking longer than usual. <a href={pending.href} className="font-semibold underline">Open this page directly</a></p>}
      </div>}
    </>
  );
}
