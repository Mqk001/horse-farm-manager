import Link from 'next/link';

export default function HomePage() {
  return <main className="landing-page flex min-h-screen flex-col">
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-7 sm:px-10">
      <Link href="/" className="font-display text-2xl text-[#183d2f]">Reinwell</Link>
      <Link href="/login" className="text-sm font-semibold text-[#183d2f] underline underline-offset-4">Sign in</Link>
    </header>
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16 sm:px-10 sm:py-24">
      <p className="eyebrow">For the people caring for horses</p>
      <h1 className="mt-5 font-display text-7xl text-[#183d2f] sm:text-8xl lg:text-9xl">Reinwell</h1>
      <p className="mt-6 max-w-2xl font-display text-3xl leading-tight text-[#374b3e] sm:text-5xl">Stable care for farm teams.</p>
      <Link href="/signup" className="button-primary mt-10 self-start px-7 py-4">Create your account <span aria-hidden="true">→</span></Link>
      <div aria-label="Horses, care, and team" className="mt-16 grid max-w-3xl gap-5 border-t border-[#d6d9ce] pt-7 sm:grid-cols-3 sm:gap-10">
        <div><h2 className="font-display text-xl">Horses</h2><p className="mt-2 text-sm leading-6 text-[#657067]">Record rides and grooming.</p></div>
        <div><h2 className="font-display text-xl">Care</h2><p className="mt-2 text-sm leading-6 text-[#657067]">Track due dates and completed care.</p></div>
        <div><h2 className="font-display text-xl">Team</h2><p className="mt-2 text-sm leading-6 text-[#657067]">Invite teammates to your farm.</p></div>
      </div>
    </section>
    <footer className="mx-auto flex w-full max-w-6xl gap-6 px-6 py-7 text-xs text-[#657067] sm:px-10"><Link href="/privacy" className="underline">Privacy</Link><Link href="/terms" className="underline">Terms</Link></footer>
  </main>;
}
